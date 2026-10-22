// ==========================================
// CONFIGURATION GLOBALE DU SITE
// ==========================================
// Tout ce qui change d'une saison à l'autre, ou lors d'un redéploiement, se règle ICI.

// Adresse du script Apps Script. Nouvelle version d'un déploiement existant = même URL ;
// nouveau déploiement = nouvelle URL, à recopier ici.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxHwqLOe_S1_j-V9mGdn_OjeBuqRU5b10tWBydlL_3L-k9UH5Fxwk607si7di5D/exec';

// Saison régulière NBA (dates officielles), à mettre à jour chaque été.
// SEASON_START doit être identique à celui du script Apps Script (fermeture des inscriptions,
// révélation des pronos) : la console du navigateur signale un écart entre les deux.
const SEASON_LABEL = '2026-27';
const SEASON_START = new Date(2026, 9, 20); // 20 octobre 2026 (les mois commencent à 0)
const SEASON_END = new Date(2027, 3, 11);   // 11 avril 2027

// ==========================================
// MESURE D'AUDIENCE (GoatCounter : gratuit, sans cookie, sans bandeau de consentement)
// ==========================================
// 1. Crée un compte sur https://www.goatcounter.com et choisis un code (ex. « airball »)
// 2. Recopie ce code ci-dessous. Laisse vide pour désactiver la mesure.
// Rien n'est compté en local, en mode démo, ni sur les pages du dossier outils/.
// Tes propres visites : ouvre une fois une page outils/ sur chacun de tes appareils et navigateurs
// (ou le site avec #toggle-goatcounter à la fin de l'adresse) : ce navigateur ne sera plus compté.
const GOATCOUNTER_CODE = 'airball';

// Track.event('nom', 'libellé') : compte une action (ouverture d'une story, d'un comparatif...)
const Track = (() => {
    const local = ['localhost', '127.0.0.1', '[::1]', ''].includes(window.location.hostname) || window.location.protocol === 'file:';
    let demo = false;
    try { demo = sessionStorage.getItem('airball:demo') === '1' || new URLSearchParams(window.location.search).get('demo') === '1'; } catch (e) { /* rien */ }
    const tool = /\/outils\//.test(window.location.pathname);
    // L'organisateur : ouvrir une page outils/ (ou le site avec #toggle-goatcounter) exclut ce navigateur des statistiques
    if (tool) { try { localStorage.setItem('skipgc', 't'); } catch (e) { /* rien */ } }
    let me = false;
    try { me = localStorage.getItem('skipgc') === 't'; } catch (e) { /* rien */ }
    const embedded = new URLSearchParams(window.location.search).get('embed') === '1'; // reveal dans la page Pronostics : déjà compté
    const on = Boolean(GOATCOUNTER_CODE) && !local && !demo && !tool && !me;

    if (on && !embedded) {
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://gc.zgo.at/count.js';
        s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
        document.head.appendChild(s);
    }

    const queue = [];
    function flush() {
        if (!window.goatcounter || !window.goatcounter.count) return setTimeout(flush, 500);
        while (queue.length) window.goatcounter.count(queue.shift());
    }
    function event(name, title = '') {
        if (!on) return;
        queue.push({ path: name, title: title || name, event: true });
        if (queue.length === 1) flush();
    }
    return { event, enabled: on };
})();
