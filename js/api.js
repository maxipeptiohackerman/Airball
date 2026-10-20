// ==========================================
// API : TOUS les appels vers Apps Script passent ici
// ==========================================
// Les pages ne connaissent ni l'URL, ni le format des requêtes.
// Le jour où tu ajoutes des comptes (jeton de connexion), ou que tu
// migres vers une autre base de données, c'est ce fichier qui change.
// Dépend de : config.js (APPS_SCRIPT_URL)
const Api = (() => {
    const cache = {};

    async function get(params) {
        const query = new URLSearchParams(params).toString();
        const response = await fetch(APPS_SCRIPT_URL + (query ? '?' + query : ''));
        if (!response.ok) throw new Error('Erreur réseau (' + response.status + ')');
        const json = await response.json();
        if (json && json.error) throw new Error(json.error);
        return json;
    }

    // Mémorise la réponse pendant la visite : changer de joueur devient instantané.
    function cached(key, params) {
        if (!cache[key]) {
            cache[key] = get(params).catch(err => { delete cache[key]; throw err; });
        }
        return cache[key];
    }

    // ---------- Mémoire entre les visites (Apps Script met ~2 s à répondre) ----------
    // La page s'affiche tout de suite avec les données de la visite précédente, pendant que le
    // Sheet est interrogé en arrière-plan. Si la réponse fraîche est différente, les pages
    // abonnées via Api.onUpdate se redessinent. Données de plus de MAX_AGE : on attend le Sheet.
    const STORE = 'airball:data:v1:';
    const MAX_AGE = 7 * 24 * 3600 * 1000;
    const listeners = [];

    function readStore(key) {
        try {
            const item = JSON.parse(localStorage.getItem(STORE + key) || 'null');
            return item && 'data' in item && Date.now() - item.time < MAX_AGE ? item : null;
        } catch (e) { return null; }
    }
    function writeStore(key, data) {
        try { localStorage.setItem(STORE + key, JSON.stringify({ time: Date.now(), data })); } catch (e) { /* stockage plein ou indisponible */ }
    }
    function notify(key) {
        listeners.filter(l => l.keys.includes(key)).forEach(l => {
            try { l.fn(key); } catch (e) { console.error('Mise à jour impossible :', e); }
        });
    }

    function remembered(key, params) {
        if (cache[key]) return cache[key];
        const stored = readStore(key);
        const fresh = get(params).then(data => {
            cache[key] = Promise.resolve(data);
            writeStore(key, data);
            if (stored && JSON.stringify(stored.data) !== JSON.stringify(data)) notify(key);
            return data;
        });
        if (stored) {
            // On garde la version mémorisée si le Sheet ne répond pas
            fresh.catch(err => console.warn(`Données « ${key} » non rafraîchies :`, err));
            cache[key] = Promise.resolve(stored.data);
        } else {
            cache[key] = fresh.catch(err => { delete cache[key]; throw err; });
        }
        return cache[key];
    }

    return {
        getLeaderboard: () => remembered('leaderboard', { page: 'leaderboard' }),
        getPronos: () => remembered('pronos', { page: 'pronos' }),
        getHistory: () => remembered('historique', { page: 'historique' }),
        getHallOfFame: () => remembered('halloffame', { page: 'halloffame' }),

        // Stats & awards NBA réels, saisis à la main dans l'onglet "NBA DATA" du Sheet
        getNbaData: () => remembered('nba-data', { page: 'nba-data' }),

        /** Appelle fn(clé) quand la réponse fraîche du Sheet diffère de celle déjà affichée. */
        onUpdate: (keys, fn) => { listeners.push({ keys: [].concat(keys), fn }); },

        // Pages masquées (onglet CONFIG) et état du reveal : { pages, reveal: { closed, launched }, seasonStart }
        getConfig: () => cached('config', { page: 'config' }),

        // Pronos de tous les joueurs pour la page Reveal. key : mot de passe d'aperçu (facultatif)
        getReveal: key => get(key ? { page: 'reveal', cle: key } : { page: 'reveal' }),

        // Inscriptions : jamais mis en mémoire, la réponse dépend de l'instant
        // ({ open, pseudo: { status }, registered }). Sans option : les inscriptions sont-elles ouvertes ?
        getRegistrationStatus: (options = {}) => get(Object.assign({ page: 'inscription' }, options)),

        // Envoi de l'inscription. Google ne permet pas de lire la réponse d'un POST depuis le site :
        // on ne se fie donc pas à cet envoi, on vérifie ensuite avec getRegistrationStatus({ id }).
        postRegistration: payload => fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        })
    };
})();

// ==========================================
// ESPN : classements NBA réels
// ==========================================
// Appelé directement depuis le navigateur, pas via Apps Script :
// ESPN refuse les requêtes venant des serveurs Google (403), pas celles d'un vrai navigateur.
const Espn = (() => {
    const STANDINGS_URL = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';

    // ESPN numérote une saison NBA par l'année où elle se termine : 2026-27 = 2027.
    // À partir de juillet, on regarde donc la saison qui commence à l'automne.
    const currentSeason = (now = new Date()) => (now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear());

    const statValue = (entry, name) => {
        const stat = (entry.stats || []).find(s => s.name === name);
        return stat ? Number(stat.value) : NaN;
    };
    const statDisplay = (entry, name, fallback) => {
        const stat = (entry.stats || []).find(s => s.name === name);
        return stat ? stat.displayValue : fallback;
    };

    // ESPN ne renvoie PAS les équipes dans l'ordre : position (playoffSeed),
    // à défaut pourcentage de victoires, puis victoires, puis nom
    function sortEntries(entries) {
        return [...entries].sort((a, b) => {
            const seedA = statValue(a, 'playoffSeed'), seedB = statValue(b, 'playoffSeed');
            if (seedA > 0 && seedB > 0 && seedA !== seedB) return seedA - seedB;
            const pct = (statValue(b, 'winPercent') || 0) - (statValue(a, 'winPercent') || 0);
            if (pct) return pct;
            const wins = (statValue(b, 'wins') || 0) - (statValue(a, 'wins') || 0);
            if (wins) return wins;
            return String(a.team.displayName).localeCompare(String(b.team.displayName));
        });
    }

    /**
     * Classement des deux conférences, équipes déjà triées :
     * { east: { label, seasonType, entries }, west: { ... } }
     * season : année ESPN (ex. 2027) ; sans saison, ESPN choisit lui-même.
     * seasonType : 1 = présaison, 2 = saison régulière.
     */
    async function getStandings({ season, seasonType = 2, timeoutMs = 0 } = {}) {
        const controller = new AbortController();
        const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
            const params = season ? `?season=${season}&seasontype=${seasonType}` : '';
            const response = await fetch(STANDINGS_URL + params, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json().catch(() => { throw new Error('réponse illisible (pas du JSON)'); });

            const result = {};
            (data.children || []).forEach(group => {
                const standings = group.standings || {};
                if (!(standings.entries || []).length) return;
                const conf = /east/i.test(group.name || group.abbreviation || '') ? 'east' : 'west';
                result[conf] = {
                    label: standings.seasonDisplayName || '',
                    seasonType: standings.seasonType,
                    entries: sortEntries(standings.entries)
                };
            });
            if (!result.east || !result.west) throw new Error('format de réponse inattendu (pas de classement)');
            return result;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    return { currentSeason, getStandings, statDisplay };
})();
