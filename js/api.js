// ==========================================
// API : TOUS les appels vers Apps Script passent ici
// ==========================================
// Les pages ne connaissent ni l'URL, ni le format des requêtes.
// Le jour où tu ajoutes des comptes (jeton de connexion), ou que tu
// migres vers une autre base de données, c'est ce fichier qui change.
//
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
        getHallOfFame: () => get({ page: 'halloffame' }),

        // Stats NBA (ESPN) : relayées par Apps Script, le navigateur ne peut plus
        // appeler ESPN directement (CORS / bloqueurs de pub -> "Failed to fetch").
        // Stats & Awards NBA réels, saisis à la main dans l'onglet "NBA DATA" du Sheet.
        getNbaData: () => get({ page: 'nba-data' }),

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
