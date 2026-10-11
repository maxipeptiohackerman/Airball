// ==========================================
// HALL OF FAME / PALMARÈS (page palmares.html)
// Dépend de : common.js (escapeHtml) et api.js (Api)
// ==========================================
async function fetchHallOfFame() {
    const hallBody = document.getElementById('hall-of-fame-body');
    if (!hallBody) return;

    try {
        const seasons = await Api.getHallOfFame();

        if (!Array.isArray(seasons) || seasons.length === 0) {
            hallBody.innerHTML = `<tr><td colspan="6" class="table-message">Aucun vainqueur enregistré pour le moment.</td></tr>`;
            return;
        }

        hallBody.innerHTML = seasons.map(item => `
            <tr>
                <td class="hof-season">${escapeHtml(item.saison || '')}</td>
                <td>🏆 ${escapeHtml(item.vainqueur || '')}</td>
                <td class="text-right">${escapeHtml(item.ptsVainqueur || '')}</td>
                <td>🥈 ${escapeHtml(item.deuxieme || '')}</td>
                <td class="text-right hof-sub">${escapeHtml(item.ptsDeuxieme || '')}</td>
                <td>👕 ${escapeHtml(item.maillot || '')}</td>
            </tr>`).join('');
    } catch (error) {
        console.error("Erreur lors du chargement du Hall of Fame :", error);
        hallBody.innerHTML = `<tr><td colspan="6" class="table-message table-message--error">Le palmarès n’a pas pu être chargé. Recharge la page dans quelques instants.</td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', fetchHallOfFame);
