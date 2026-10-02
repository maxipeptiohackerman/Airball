// ==========================================
// STATS NBA & STANDINGS ESPN (page standings.html)
// ==========================================
async function fetchNBAStandings() {
    const eastTable = document.getElementById('east-standings');
    const westTable = document.getElementById('west-standings');
    if (!eastTable || !westTable) return;

    try {
        // Appel direct depuis le navigateur (pas via Apps Script) : ESPN bloque les
        // requêtes venant de serveurs Google (403), mais n'a jamais bloqué un vrai
        // navigateur. Voir TODO.md pour le détail.
        const response = await fetch('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (parseError) {
            console.error("Réponse ESPN non-JSON (aperçu) :", rawText.slice(0, 300));
            throw new Error("réponse illisible (pas du JSON)");
        }

        if (!data.children) {
            console.error("Réponse ESPN reçue mais sans 'children' :", data);
            throw new Error("format de réponse inattendu (plus de 'children')");
        }

        eastTable.innerHTML = '';
        westTable.innerHTML = '';

        data.children.forEach(conference => {
            const confName = conference.name;
            const teams = conference.standings.entries;

            let tbody = confName.includes('Eastern') ? eastTable : westTable;

            teams.forEach((entry, index) => {
                const teamName = entry.team.displayName;
                const shortName = entry.team.abbreviation.toLowerCase();
                let logoSlug = shortName === 'uta' ? 'utah' : shortName;
                const logoUrl = `https://a.espncdn.com/i/teamlogos/nba/500/${logoSlug}.png`;

                const stats = entry.stats;
                const wins = stats.find(s => s.name === 'wins')?.displayValue || '0';
                const losses = stats.find(s => s.name === 'losses')?.displayValue || '0';
                const pct = stats.find(s => s.name === 'winPercent')?.displayValue || '.000';

                const row = `
                    <tr>
                        <td class="col-rank">${index + 1}</td>
                        <td class="col-team">
                            <span class="team-inline">
                                <img src="${logoUrl}" class="team-logo-img" alt="" onerror="this.onerror=null; this.src='https://a.espncdn.com/i/teamlogos/nba/500/default.png'">
                                ${teamName}
                            </span>
                        </td>
                        <td class="text-right">${wins}</td>
                        <td class="text-right">${losses}</td>
                        <td class="text-right">${pct}</td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des classements NBA:", error);
        const message = `<tr><td colspan="5" class="table-message table-message--error">Le classement n’a pas pu être chargé (${escapeHtml(error.message)}).</td></tr>`;
        eastTable.innerHTML = message;
        westTable.innerHTML = message;
    }
}

/**
 * Statistiques & Awards : saisis à la main dans l'onglet "NBA DATA" du Sheet
 * (dépend de : common.js pour STAT_KEYS / AWARD_KEYS / CATEGORY_LABELS).
 * Information NBA réelle, sans rapport avec les pronos des joueurs : reste
 * visible même avant la révélation.
 */
async function fetchNbaDataStatsAwards() {
    const statsBody = document.getElementById('nba-stats-body');
    const awardsBody = document.getElementById('nba-awards-body');
    if (!statsBody && !awardsBody) return;

    const podiumRow = (label, picks) => {
        const cell = name => name ? escapeHtml(name) : '—';
        return `<tr>
            <td>${label}</td>
            <td>${cell(picks[0])}</td>
            <td>${cell(picks[1])}</td>
            <td>${cell(picks[2])}</td>
        </tr>`;
    };

    try {
        const data = await Api.getNbaData();

        if (!data.stats || !data.awards) {
            console.error("Réponse 'nba-data' reçue mais sans 'stats'/'awards' :", data);
            throw new Error("format de réponse inattendu (plus de 'stats'/'awards')");
        }

        if (statsBody) {
            statsBody.innerHTML = STAT_KEYS.map(key => podiumRow(CATEGORY_LABELS[key], data.stats[key] || [])).join('');
        }
        if (awardsBody) {
            awardsBody.innerHTML = AWARD_KEYS.map(key => podiumRow(CATEGORY_LABELS[key], data.awards[key] || [])).join('');
        }
    } catch (error) {
        console.error("Erreur lors du chargement de NBA DATA :", error);
        const message = `<tr><td colspan="4" class="table-message table-message--error">Les données n’ont pas pu être chargées (${escapeHtml(error.message)}).</td></tr>`;
        if (statsBody) statsBody.innerHTML = message;
        if (awardsBody) awardsBody.innerHTML = message;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchNBAStandings();
    fetchNbaDataStatsAwards();
});
