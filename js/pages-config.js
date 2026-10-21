// ==========================================
// AFFICHAGE DES PAGES (géré depuis l'onglet CONFIG du Google Sheet)
// ==========================================
// Dans l'onglet CONFIG, une case à cocher « Masquer "…" » par page. Case cochée :
//   le lien disparaît du menu, et la page affiche un message de maintenance si on y accède.
// Aperçu pour l'organisateur : les pages masquées restent visibles
//   - automatiquement quand le site tourne sur ton ordinateur (localhost, 127.0.0.1, fichier ouvert) ;
//   - en ligne, en ajoutant ?apercu=1 à l'adresse d'une page (?apercu=0 pour arrêter).
//
// Le site ne bloque jamais l'affichage en attendant le Sheet : il applique tout de suite le
// dernier statut connu, puis interroge le Sheet à chaque page et se met à jour si besoin.
// Si le Sheet ne répond pas, tout reste en ligne.
// Dépend de : config.js (SEASON_START) et api.js (Api)
const PageConfig = (() => {
    const CACHE_KEY = 'airball:pages';
    const PREVIEW_KEY = 'airball:apercu';

    // Nom du fichier -> clé dans l'onglet CONFIG
    const KEYS = {
        'index.html': 'home', '': 'home',
        'pronostics.html': 'pronostics',
        'standings.html': 'stats',
        'rules.html': 'regles',
        'palmares.html': 'halloffame',
        'register.html': 'inscription',
        'reveal.html': 'reveal'
    };

    // Valeurs envoyées par le Sheet ("masquée" / "en ligne"), accents et majuscules ignorés
    function normalize(value) {
        const v = String(value === undefined || value === null ? '' : value)
            .normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
        return v.startsWith('masque') ? 'hidden' : 'online';
    }

    // Site ouvert sur ton ordinateur : jamais de page en maintenance
    const isLocal = () => window.location.protocol === 'file:'
        || ['localhost', '127.0.0.1', '[::1]', ''].includes(window.location.hostname)
        || window.location.hostname.endsWith('.local');

    // Aperçu : toujours en local ; en ligne, ?apercu=1 l'active pour la session du navigateur, ?apercu=0 l'arrête
    function isPreview() {
        if (isLocal()) return true;
        try {
            const param = new URLSearchParams(window.location.search).get('apercu');
            if (param === '1') sessionStorage.setItem(PREVIEW_KEY, '1');
            if (param === '0') sessionStorage.removeItem(PREVIEW_KEY);
            return sessionStorage.getItem(PREVIEW_KEY) === '1';
        } catch (e) { return false; }
    }

    function readCache() {
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            return cached && cached.pages ? cached : null;
        } catch (e) { return null; }
    }

    // Les dates de début de saison du site (config.js) et du script doivent être identiques
    function checkSeasonStart(serverDate) {
        if (!serverDate) return;
        const local = [SEASON_START.getFullYear(), SEASON_START.getMonth() + 1, SEASON_START.getDate()]
            .map(n => String(n).padStart(2, '0')).join('-');
        if (local !== serverDate) {
            console.warn(`Début de saison différent : ${local} dans js/config.js, ${serverDate} dans Apps Script. Aligne les deux.`);
        }
    }

    async function fetchFresh() {
        const json = await Api.getConfig();
        if (!json || !json.pages) throw new Error('réponse sans "pages"');
        checkSeasonStart(json.seasonStart);
        const pages = {};
        Object.keys(json.pages).forEach(key => { pages[key.toLowerCase()] = normalize(json.pages[key]); });
        // État du reveal (inscriptions closes, reveal lancé) : sert à la Home et au lien du menu
        const reveal = { closed: !!(json.reveal && json.reveal.closed), launched: !!(json.reveal && json.reveal.launched) };
        // Pronos visibles (reveal lancé ou aperçu forcé) : absent des anciennes versions du script
        if (json.reveal && json.reveal.pronos !== undefined) reveal.pronos = !!json.reveal.pronos;
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), pages, reveal })); } catch (e) { /* stockage indisponible */ }
        return { pages, reveal };
    }

    /**
     * Appelle onChange(statuts, reveal) avec le dernier état connu (si disponible), puis à nouveau
     * avec l'état frais du Sheet s'il est différent (vérifié à chaque chargement de page).
     */
    function watch(onChange) {
        const cached = readCache();
        if (cached) onChange(cached.pages, cached.reveal || {});
        fetchFresh()
            .then(fresh => {
                const changed = !cached || JSON.stringify(fresh.pages) !== JSON.stringify(cached.pages)
                    || JSON.stringify(fresh.reveal) !== JSON.stringify(cached.reveal || {});
                if (changed) onChange(fresh.pages, fresh.reveal);
            })
            .catch(error => console.warn('Configuration des pages indisponible (tout reste en ligne) :', error));
    }

    const keyOfFile = file => KEYS[String(file || '').toLowerCase()] || null;
    const statusOf = (pages, key) => (pages && key && pages[key]) || 'online';

    return { watch, isPreview, isLocal, keyOfFile, statusOf };
})();
