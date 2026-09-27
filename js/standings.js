// ==========================================
// STATS NBA & STANDINGS ESPN (page standings.html)
// ==========================================
async function fetchNBAStandings() {
    const eastTable = document.getElementById('east-standings');
    const westTable = document.getElementById('west-standings');
    if (!eastTable || !westTable) return;

    try {
        const response = await fetch('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings');
        const data = await response.json();
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
                            <img src="${logoUrl}" class="team-logo-img" alt="${shortName}" onerror="this.src='https://a.espncdn.com/i/teamlogos/nba/500/default.png'">
                            ${teamName}
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
    }
}

async function fetchNbaLeadersAndAwards() {
    const statsLeadersBody = document.getElementById('stats-leaders-body');
    const mvpBody = document.getElementById('mvp-ladder-body');
    const dpoyBody = document.getElementById('dpoy-ladder-body');

    if (!statsLeadersBody && !mvpBody && !dpoyBody) return;

    try {
        const response = await fetch('https://site.api.espn.com/apis/v2/sports/basketball/nba/leaders');
        const data = await response.json();

        if (statsLeadersBody && data.categories) {
            let html = '';
            data.categories.forEach(cat => {
                const catName = cat.displayName || cat.name;
                const leader = cat.leaders && cat.leaders[0] ? cat.leaders[0] : null;
                if (leader) {
                    const playerName = leader.athlete ? leader.athlete.displayName : 'Inconnu';
                    const teamName = leader.team ? leader.team.abbreviation : '';
                    const value = leader.displayValue || '';
                    html += `
                        <tr>
                            <td><strong>${catName}</strong></td>
                            <td>${playerName}</td>
                            <td>${teamName}</td>
                            <td class="text-right"><strong>${value}</strong></td>
                        </tr>
                    `;
                }
            });
            statsLeadersBody.innerHTML = html || `<tr><td colspan="4" class="text-center" style="padding: 20px;">Aucune donnée disponible.</td></tr>`;
        }

        // TODO: Remplacer par de vraies données dynamiques (ESPN ne fournit pas de ladder
        // MVP/DPOY tout fait) le jour où une source fiable sera branchée.
        if (mvpBody) {
            mvpBody.innerHTML = `
                <tr><td class="text-center"><strong>1</strong></td><td>Shai Gilgeous-Alexander</td><td>OKC</td></tr>
                <tr><td class="text-center"><strong>2</strong></td><td>Nikola Jokic</td><td>DEN</td></tr>
                <tr><td class="text-center"><strong>3</strong></td><td>Luka Doncic</td><td>DAL</td></tr>
            `;
        }
        if (dpoyBody) {
            dpoyBody.innerHTML = `
                <tr><td class="text-center"><strong>1</strong></td><td>Victor Wembanyama</td><td>SAS</td></tr>
                <tr><td class="text-center"><strong>2</strong></td><td>Evan Mobley</td><td>CLE</td></tr>
                <tr><td class="text-center"><strong>3</strong></td><td>Anthony Davis</td><td>LAL</td></tr>
            `;
        }

    } catch (error) {
        console.error("Erreur lors du chargement des leaders stats ESPN :", error);
        if (statsLeadersBody) statsLeadersBody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 20px; color: #cc0000;">Erreur de chargement des statistiques.</td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchNBAStandings();
    fetchNbaLeadersAndAwards();
});
