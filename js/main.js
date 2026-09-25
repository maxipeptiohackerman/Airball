// ==========================================
// 1. HEADER DYNAMIQUE & COMPTE A REBOURS
// ==========================================
async function loadHeader() {
    const container = document.getElementById('header-container');
    if (!container) return;

    try {
        const response = await fetch('header.html');
        const html = await response.text();
        container.innerHTML = html;

        // Détection automatique de la page active (Version ultra-robuste pour l'accueil/leaderboard)
        const rawPath = window.location.pathname;
        const currentFileName = rawPath.split('/').pop().toLowerCase();
        const isHome = rawPath === '/' || currentFileName === '' || currentFileName === 'index.html';

        const navLinks = container.querySelectorAll('a');

        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            
            const cleanHref = href.split('/').pop().toLowerCase();
            const isLinkHome = href === '/' || href === './' || cleanHref === '' || cleanHref === 'index.html';

            // Si on est sur l'accueil et que le lien pointe vers l'accueil, OU si les noms de fichiers correspondent
            if ((isHome && isLinkHome) || (cleanHref && cleanHref === currentFileName)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Lancement du compte à rebours une fois le header injecté
        startCountdown();

    } catch (error) {
        console.error("Erreur lors du chargement du header commun :", error);
    }
}

function startCountdown() {
    const seasonStartDate = new Date('2026-10-20T00:00:00').getTime();
    const timerElement = document.getElementById('timer');

    if (!timerElement) return;

    function updateTimer() {
        const now = new Date().getTime();
        const distance = seasonStartDate - now;

        if (distance < 0) {
            timerElement.innerHTML = "C'est la saison ! 🏀";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        timerElement.innerHTML = `${days}j ${hours}h ${minutes}m ${seconds}s`;
    }

    updateTimer();
    setInterval(updateTimer, 1000);
}


// ==========================================
// 2. LEADERBOARD (Uniquement pour index.html)
// ==========================================
async function fetchLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;

    try {
        const scriptUrl = 'https://script.google.com/macros/s/AKfycbxHwqLOe_S1_j-V9mGdn_OjeBuqRU5b10tWBydlL_3L-k9UH5Fxwk607si7di5D/exec?page=leaderboard';
        const response = await fetch(scriptUrl);
        const data = await response.json();

        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: #707070;">Aucune donnée disponible.</td></tr>`;
            return;
        }

        const validRows = data.filter(row => {
            const joueur = row[2];
            return joueur && String(joueur).trim() !== "" && String(joueur).toUpperCase() !== "JOUEUR";
        });

        if (validRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: #707070;">Aucun joueur trouvé dans le tableau.</td></tr>`;
            return;
        }

        validRows.sort((a, b) => parseFloat(b[7] || 0) - parseFloat(a[7] || 0));

        validRows.forEach((row, index) => {
            const joueur = row[2] || "Inconnu";
            const ptsEst = parseFloat(row[3] || 0);
            const ptsOuest = parseFloat(row[4] || 0);
            const ptsStats = parseFloat(row[5] || 0);
            const ptsAwards = parseFloat(row[6] || 0);
            const total = parseFloat(row[7] || 0);
            const avatarContent = row[8];

            let avatarHtml = '';
            if (avatarContent) {
                const avatarStr = String(avatarContent).trim();
                if (avatarStr.startsWith('http') || avatarStr.startsWith('data:image')) {
                    avatarHtml = `<img src="${avatarStr}" alt="${joueur}">`;
                } else {
                    avatarHtml = avatarStr;
                }
            } else {
                avatarHtml = String(joueur).charAt(0).toUpperCase();
            }

            const htmlRow = `
                <tr>
                    <td class="col-rank"><span class="rank-badge">${index + 1}</span></td>
                    <td class="col-player">
                        <div class="player-avatar">${avatarHtml}</div> ${joueur}
                    </td>
                    <td class="text-right"><span>${ptsEst}</span></td>
                    <td class="text-right"><span>${ptsOuest}</span></td>
                    <td class="text-right"><span>${ptsStats}</span></td>
                    <td class="text-right"><span>${ptsAwards}</span></td>
                    <td class="score-total text-right">${total}</td>
                </tr>
            `;
            tbody.innerHTML += htmlRow;
        });

    } catch (error) {
        console.error("Erreur de chargement du leaderboard:", error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: #cc0000;">Erreur lors de la récupération des données.</td></tr>`;
    }
}


// ==========================================
// 3. STATS NBA & STANDINGS ESPN (Pour standings.html)
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

// ==========================================
// 4. HALL OF FAME / PALMARES
// ==========================================
async function fetchHallOfFame() {
    const hallBody = document.getElementById('hall-of-fame-body');
    if (!hallBody) return;

    try {
        const scriptUrl = 'https://script.google.com/macros/s/AKfycbxHwqLOe_S1_j-V9mGdn_OjeBuqRU5b10tWBydlL_3L-k9UH5Fxwk607si7di5D/exec?page=halloffame';
        const response = await fetch(scriptUrl);
        const data = await response.json();

        hallBody.innerHTML = '';

        if (!data || data.length === 0) {
            hallBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px; color: var(--text-sub);">Aucun vainqueur enregistré pour le moment.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const htmlRow = `
                <tr>
                    <td><strong>${item.saison || ''}</strong></td>
                    <td>🏆 ${item.vainqueur || ''}</td>
                    <td class="text-right">${item.ptsVainqueur || ''}</td>
                    <td>🥈 ${item.deuxieme || ''}</td>
                    <td class="text-right">${item.ptsDeuxieme || ''}</td>
                    <td>👕 ${item.maillot || ''}</td>
                </tr>
            `;
            hallBody.innerHTML += htmlRow;
        });
    } catch (error) {
        console.error("Erreur lors du chargement du Hall of Fame:", error);
        hallBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 20px; color: #cc0000;">Erreur lors du chargement.</td></tr>`;
    }
}

// ==========================================
// 5. LANCEMENT GLOBAL AU CHARGEMENT DE LA PAGE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadHeader(); 
    fetchLeaderboard();
    fetchNBAStandings();
    fetchNbaLeadersAndAwards();
    initPronostics();
    fetchHallOfFame();
});

let rankChartInstance = null;
let cachedLeaderboardData = null;

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


// ==========================================
// 6. GESTION DES PRONOSTICS
// ==========================================
function initPronostics() {
    const playerSelect = document.getElementById('player-select');
    if (!playerSelect) return;

    const scriptUrl = 'https://script.google.com/macros/s/AKfycbxHwqLOe_S1_j-V9mGdn_OjeBuqRU5b10tWBydlL_3L-k9UH5Fxwk607si7di5D/exec';
    const leaderboardUrl = scriptUrl + '?page=leaderboard';

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

            if (cachedLeaderboardData && Array.isArray(cachedLeaderboardData)) {
                const validRows = cachedLeaderboardData.filter(row => {
                    const j = row[2];
                    return j && String(j).trim() !== "" && String(j).toUpperCase() !== "JOUEUR";
                });
                validRows.sort((a, b) => parseFloat(b[7] || 0) - parseFloat(a[7] || 0));

                const playerIndex = validRows.findIndex(row => String(row[2]).trim().toLowerCase() === playerName.trim().toLowerCase());
                if (playerIndex !== -1) {
                    const pRow = validRows[playerIndex];
                    document.getElementById('profile-rank').textContent = `${playerIndex + 1}${playerIndex === 0 ? 'er' : 'e'}`;
                    document.getElementById('profile-total-pts').textContent = parseFloat(pRow[7] || 0);

                    const avatarContent = pRow[8];
                    if (avatarContent) {
                        const avatarStr = String(avatarContent).trim();
                        if (avatarStr.startsWith('http') || avatarStr.startsWith('data:image')) {
                            document.getElementById('profile-avatar').innerHTML = `<img src="${avatarStr}" alt="${playerName}">`;
                        } else {
                            document.getElementById('profile-avatar').innerHTML = avatarStr;
                        }
                    }
                }
            }

            const histUrl = `${scriptUrl}?page=historique&joueur=${encodeURIComponent(playerName)}`;
            const pronosUrl = `${scriptUrl}?joueur=${encodeURIComponent(playerName)}`;

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

            const data = await pronosRes.json();

            if (Array.isArray(histData) && histData.length > 0) {
                renderPlayerChart(histData);
            } else {
                if (chartCard) chartCard.style.display = 'none';
                if (rankChartInstance) rankChartInstance.destroy();
            }

            if (data.error) {
                estBody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px; color: #cc0000;">${data.error}</td></tr>`;
                ouestBody.innerHTML = `<tr><td colspan="3" class="text-center" style="padding: 20px; color: #cc0000;">${data.error}</td></tr>`;
                statsBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: #cc0000;">${data.error}</td></tr>`;
                tropheeBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: #cc0000;">${data.error}</td></tr>`;
                return;
            }

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

    if (playerSelect.value) {
        loadPlayerData(playerSelect.value);
    }
}