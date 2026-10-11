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

    return {
        getLeaderboard: () => get({ page: 'leaderboard' }),
        getPronos: () => cached('pronos', { page: 'pronos' }),
        getHistory: () => cached('historique', { page: 'historique' }),
        getHallOfFame: () => cached('halloffame', { page: 'halloffame' }),

        // Stats & awards NBA réels, saisis à la main dans l'onglet "NBA DATA" du Sheet
        getNbaData: () => get({ page: 'nba-data' }),

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
