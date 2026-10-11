// ==========================================
// STATS NBA & STANDINGS ESPN (page standings.html)
// Dépend de : common.js (escapeHtml, STAT_KEYS, AWARD_KEYS, CATEGORY_LABELS), api.js (Api, Espn) et teams.js (Teams)
// ==========================================
function standingsRow(entry, index) {
    return `
        <tr>
            <td class="col-rank">${index + 1}</td>
            <td class="col-team">
                <span class="team-inline">
                    ${Teams.logoHtml(entry.team.abbreviation)}
                    ${escapeHtml(entry.team.displayName)}
                </span>
            </td>
            <td class="text-right">${Espn.statDisplay(entry, 'wins', '0')}</td>
            <td class="text-right">${Espn.statDisplay(entry, 'losses', '0')}</td>
            <td class="text-right">${Espn.statDisplay(entry, 'winPercent', '.000')}</td>
        </tr>`;
}

async function fetchNBAStandings() {
    const tables = { east: document.getElementById('east-standings'), west: document.getElementById('west-standings') };
    if (!tables.east || !tables.west) return;

    try {
        // On demande explicitement la SAISON RÉGULIÈRE en cours, sinon ESPN renvoie
        // la présaison ou la saison précédente selon la période de l'année.
        const standings = await Espn.getStandings({ season: Espn.currentSeason(), seasonType: 2 })
            .catch(error => {
                console.warn("Saison régulière indisponible, classement ESPN par défaut :", error);
                return Espn.getStandings();
            });

        ['east', 'west'].forEach(conf => {
            const { label, seasonType, entries } = standings[conf];
            tables[conf].innerHTML = entries.map(standingsRow).join('');

            // Sous-titre de la carte : saison réellement affichée (ex. "Saison régulière 2026-27")
            const subtitle = tables[conf].closest('.card').querySelector('.table-title span');
            if (subtitle && label) subtitle.textContent = `${seasonType === 1 ? 'Présaison' : 'Saison régulière'} ${label}`;
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des classements NBA :", error);
        const message = `<tr><td colspan="5" class="table-message table-message--error">Le classement n’a pas pu être chargé (${escapeHtml(error.message)}).</td></tr>`;
        tables.east.innerHTML = message;
        tables.west.innerHTML = message;
    }
}

/**
 * Statistiques & Awards : saisis à la main dans l'onglet "NBA DATA" du Sheet.
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
