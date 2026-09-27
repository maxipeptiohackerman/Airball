// ==========================================
// LEADERBOARD (page index.html)
// ==========================================
async function fetchLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;

    try {
        const scriptUrl = APPS_SCRIPT_URL + '?page=leaderboard';
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
            const avatarHtml = renderAvatarHtml(row[8], joueur);

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

document.addEventListener('DOMContentLoaded', () => {
    fetchLeaderboard();
});
