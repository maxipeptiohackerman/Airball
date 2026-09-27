// ==========================================
// GESTION DES PRONOSTICS ET DE LA FICHE JOUEUR (page pronostics.html)
// ==========================================

let rankChartInstance = null;
let cachedLeaderboardData = null;

const teamAbbrs = {
    "Hawks": "atl", "Atlanta Hawks": "atl", "Celtics": "bos", "Boston Celtics": "bos",
    "Nets": "bkn", "Brooklyn Nets": "bkn", "Hornets": "cha", "Charlotte Hornets": "cha",
    "Bulls": "chi", "Chicago Bulls": "chi", "Cavs": "cle", "Cleveland Cavaliers": "cle",
    "Pistons": "det", "Detroit Pistons": "det", "Pacers": "ind", "Indiana Pacers": "ind",
    "Heat": "mia", "Miami Heat": "mia", "Bucks": "mil", "Milwaukee Bucks": "mil",
    "Knicks": "nyk", "New York Knicks": "nyk", "Magic": "orl", "Orlando Magic": "orl",
    "76ers": "phi", "Philadelphia 76ers": "phi", "Raptors": "tor", "Toronto Raptors": "tor",
    "Wizards": "wsh", "Washington Wizards": "wsh", "Nuggets": "den", "Denver Nuggets": "den",
    "Wolves": "min", "Minnesota Timberwolves": "min", "Thunder": "okc", "Oklahoma City Thunder": "okc",
    "Blazers": "por", "Portland Trail Blazers": "por", "Jazz": "utah", "Utah Jazz": "utah",
    "Warriors": "gs", "Golden State Warriors": "gs", "Clippers": "lac", "LA Clippers": "lac",
    "Lakers": "lal", "Los Angeles Lakers": "lal", "Suns": "phx", "Phoenix Suns": "phx",
    "Kings": "sac", "Sacramento Kings": "sac", "Mavericks": "dal", "Dallas Mavericks": "dal",
    "Rockets": "hou", "Houston Rockets": "hou", "Grizzlies": "mem", "Memphis Grizzlies": "mem",
    "Pelicans": "no", "New Orleans Pelicans": "no", "Spurs": "sas", "San Antonio Spurs": "sas"
};

function getTeamLogoHtml(teamName) {
    const cleanName = String(teamName).trim();
    const abbr = teamAbbrs[cleanName];
    if (abbr) {
        return `<img src="https://a.espncdn.com/i/teamlogos/nba/500/${abbr}.png" alt="${cleanName}" class="team-logo" title="${cleanName}">`;
    }
    return '';
}

function getPtsStyle(ptsVal) {
    const num = parseFloat(ptsVal);
    if (isNaN(num) || num <= 0) return { rowClass: '', ptsClass: 'pts-badge' };
    if (num < 1) return { rowClass: 'row-tier-05', ptsClass: 'pts-badge pts-tier-05' };
    if (num < 1.5) return { rowClass: 'row-tier-1', ptsClass: 'pts-badge pts-tier-1' };
    return { rowClass: 'row-tier-2', ptsClass: 'pts-badge pts-tier-2' };
}

function renderPlayerChart(historyData) {
    const chartCard = document.getElementById('chart-card');
    const ctx = document.getElementById('playerRankChart');
    if (!ctx || !chartCard) return;

    if (!historyData || historyData.length === 0) {
        chartCard.style.display = 'none';
        return;
    }

    chartCard.style.display = 'flex';

    const labels = historyData.map(item => {
        let rawDate = item.semaine;
        if (!rawDate) return "";
        if (String(rawDate).includes('T')) {
            return rawDate.split('T')[0];
        }
        return rawDate;
    });

    const ranks = historyData.map(item => item.classement);

    if (rankChartInstance) {
        rankChartInstance.destroy();
    }

    rankChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Classement',
                data: ranks,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#f59e0b',
                pointRadius: 5,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    reverse: true,
                    beginAtZero: false,
                    ticks: { stepSize: 1, color: '#9ca3af' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    ticks: { color: '#9ca3af' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` Classement : ${context.parsed.y}e`;
                        }
                    }
                }
            }
        }
    });
}

function initPronostics() {
    const playerSelect = document.getElementById('player-select');
    if (!playerSelect) return;

    const leaderboardUrl = APPS_SCRIPT_URL + '?page=leaderboard';

    /**
     * Remplit dynamiquement le menu déroulant avec les joueurs du Leaderboard
     */
    async function populatePlayerSelect() {
        try {
            if (!cachedLeaderboardData) {
                const lbResponse = await fetch(leaderboardUrl);
                cachedLeaderboardData = await lbResponse.json();
            }

            if (!cachedLeaderboardData.revealed) {
                playerSelect.innerHTML = '<option value="">🔒 Pronostics non révélés</option>';
                playerSelect.disabled = true;
                return;
            }

            playerSelect.disabled = false;
            const rows = cachedLeaderboardData.rows || [];

            const validRows = rows.filter(row => {
                const j = row[2];
                return j && String(j).trim() !== "" && String(j).toUpperCase() !== "JOUEUR";
            });

            playerSelect.innerHTML = '<option value="">-- Choisir un joueur --</option>';

            validRows.forEach(row => {
                const playerName = String(row[2]).trim();
                const option = document.createElement('option');
                option.value = playerName;
                option.textContent = playerName;
                playerSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Erreur lors du chargement de la liste des joueurs :", error);
        }
    }

    async function loadPlayerData(playerName) {
        const profileCard = document.getElementById('player-profile');
        const chartCard = document.getElementById('chart-card');
        const estBody = document.getElementById('est-body');
        const ouestBody = document.getElementById('ouest-body');
        const statsBody = document.getElementById('stats-body');
        const tropheeBody = document.getElementById('trophee-body');

        if (!playerName) {
            if (profileCard) profileCard.style.display = 'none';
            if (chartCard) chartCard.style.display = 'none';
            if (rankChartInstance) rankChartInstance.destroy();

            estBody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px; color: var(--text-sub);">Sélectionnez un joueur pour voir ses pronostics.</td></tr>`;
            ouestBody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px; color: var(--text-sub);">Sélectionnez un joueur pour voir ses pronostics.</td></tr>`;
            statsBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: var(--text-sub);">En attente de sélection...</td></tr>`;
            tropheeBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: var(--text-sub);">En attente de sélection...</td></tr>`;
            return;
        }

        if (profileCard) profileCard.style.display = 'flex';
        document.getElementById('profile-name').textContent = playerName;
        document.getElementById('profile-rank').textContent = '...';
        document.getElementById('profile-total-pts').textContent = '...';
        document.getElementById('profile-avatar').innerHTML = playerName.charAt(0).toUpperCase();

        estBody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px;">Chargement...</td></tr>`;
        ouestBody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px;">Chargement...</td></tr>`;
        statsBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px;">Chargement...</td></tr>`;
        tropheeBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px;">Chargement...</td></tr>`;

        try {
            if (!cachedLeaderboardData) {
                const lbResponse = await fetch(leaderboardUrl);
                cachedLeaderboardData = await lbResponse.json();
            }

            if (cachedLeaderboardData && cachedLeaderboardData.revealed && Array.isArray(cachedLeaderboardData.rows)) {
                const validRows = cachedLeaderboardData.rows.filter(row => {
                    const j = row[2];
                    return j && String(j).trim() !== "" && String(j).toUpperCase() !== "JOUEUR";
                });
                validRows.sort((a, b) => parseFloat(b[7] || 0) - parseFloat(a[7] || 0));

                const playerIndex = validRows.findIndex(row => String(row[2]).trim().toLowerCase() === playerName.trim().toLowerCase());
                if (playerIndex !== -1) {
                    const pRow = validRows[playerIndex];
                    document.getElementById('profile-rank').textContent = `${playerIndex + 1}${playerIndex === 0 ? 'er' : 'e'}`;
                    document.getElementById('profile-total-pts').textContent = parseFloat(pRow[7] || 0);
                    document.getElementById('profile-avatar').innerHTML = renderAvatarHtml(pRow[8], playerName);
                }
            }

            const histUrl = `${APPS_SCRIPT_URL}?page=historique&joueur=${encodeURIComponent(playerName)}`;
            const pronosUrl = `${APPS_SCRIPT_URL}?joueur=${encodeURIComponent(playerName)}`;

            const [histRes, pronosRes] = await Promise.all([
                fetch(histUrl),
                fetch(pronosUrl)
            ]);

            let histData = [];
            try {
                histData = await histRes.json();
            } catch (e) {
                console.warn("Pas d'historique valide ou erreur de parsing JSON :", e);
            }

            const responseJson = await pronosRes.json();

            if (Array.isArray(histData) && histData.length > 0) {
                renderPlayerChart(histData);
            } else {
                if (chartCard) chartCard.style.display = 'none';
                if (rankChartInstance) rankChartInstance.destroy();
            }

            if (responseJson.error) {
                estBody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px; color: #cc0000;">${responseJson.error}</td></tr>`;
                ouestBody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px; color: #cc0000;">${responseJson.error}</td></tr>`;
                statsBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: #cc0000;">${responseJson.error}</td></tr>`;
                tropheeBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: #cc0000;">${responseJson.error}</td></tr>`;
                return;
            }

            if (!responseJson.revealed) {
                const lockedMsg = "🔒 Les pronostics de ce joueur seront révélés au lancement de la saison.";
                estBody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px; color: var(--text-sub);">${lockedMsg}</td></tr>`;
                ouestBody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px; color: var(--text-sub);">${lockedMsg}</td></tr>`;
                statsBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: var(--text-sub);">${lockedMsg}</td></tr>`;
                tropheeBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: var(--text-sub);">${lockedMsg}</td></tr>`;
                return;
            }

            const data = responseJson.data;

            let estHtml = '';
            for (let i = 5; i <= 19; i++) {
                if (data[i]) {
                    const rank = i - 4;
                    const team = data[i][2] || '-';
                    const pts = data[i][4] !== undefined && data[i][4] !== "" ? data[i][4] : '-';
                    const logoHtml = getTeamLogoHtml(team);
                    const style = getPtsStyle(pts);
                    estHtml += `<tr class="${style.rowClass}"><td class="text-center"><strong>${rank}</strong></td><td class="team-cell">${logoHtml} <span>${team}</span></td><td class="text-right ${style.ptsClass}">${pts}</td></tr>`;
                }
            }
            estBody.innerHTML = estHtml;

            let ouestHtml = '';
            for (let i = 5; i <= 19; i++) {
                if (data[i]) {
                    const rank = i - 4;
                    const team = data[i][5] || '-';
                    const pts = data[i][7] !== undefined && data[i][7] !== "" ? data[i][7] : '-';
                    const logoHtml = getTeamLogoHtml(team);
                    const style = getPtsStyle(pts);
                    ouestHtml += `<tr class="${style.rowClass}"><td class="text-center"><strong>${rank}</strong></td><td class="team-cell">${logoHtml} <span>${team}</span></td><td class="text-right ${style.ptsClass}">${pts}</td></tr>`;
                }
            }
            ouestBody.innerHTML = ouestHtml;

            let statsHtml = '';
            for (let i = 5; i <= 9; i++) {
                if (data[i] && data[i][9]) {
                    const statName = data[i][9];
                    const pick1 = data[i][11] || '-';
                    const pick2 = data[i][13] || '-';
                    const pick3 = data[i][15] || '-';
                    const pts = data[i][17] !== undefined && data[i][17] !== "" ? data[i][17] : '-';
                    const style = getPtsStyle(pts);
                    statsHtml += `<tr class="${style.rowClass}"><td><strong>${statName}</strong></td><td>${pick1}</td><td>${pick2}</td><td>${pick3}</td><td class="text-right ${style.ptsClass}">${pts}</td></tr>`;
                }
            }
            statsBody.innerHTML = statsHtml;

            let tropheeHtml = '';
            for (let i = 14; i <= 19; i++) {
                if (data[i] && data[i][9]) {
                    const statName = data[i][9];
                    const pick1 = data[i][11] || '-';
                    const pick2 = data[i][13] || '-';
                    const pick3 = data[i][15] || '-';
                    const pts = data[i][17] !== undefined && data[i][17] !== "" ? data[i][17] : '-';
                    const style = getPtsStyle(pts);
                    tropheeHtml += `<tr class="${style.rowClass}"><td><strong>${statName}</strong></td><td>${pick1}</td><td>${pick2}</td><td>${pick3}</td><td class="text-right ${style.ptsClass}">${pts}</td></tr>`;
                }
            }
            tropheeBody.innerHTML = tropheeHtml;

        } catch (error) {
            console.error("Erreur lors de la récupération:", error);
        }
    }

    playerSelect.addEventListener('change', function() {
        loadPlayerData(this.value);
    });

    // Lancement : on peuple le menu déroulant dès l'ouverture de la page
    populatePlayerSelect().then(() => {
        if (playerSelect.value) {
            loadPlayerData(playerSelect.value);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initPronostics();
});