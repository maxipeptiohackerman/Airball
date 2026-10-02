// ==========================================
// HALL OF FAME / PALMARÈS (page palmares.html)
// ==========================================
async function fetchHallOfFame() {
    const hallBody = document.getElementById('hall-of-fame-body');
    if (!hallBody) return;

    try {
        const scriptUrl = APPS_SCRIPT_URL + '?page=halloffame';
        const response = await fetch(scriptUrl);
        const data = await response.json();

        hallBody.innerHTML = '';

        if (!data || data.length === 0) {
            hallBody.innerHTML = `<tr><td colspan="6" class="table-message">Aucun vainqueur enregistré pour le moment.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const htmlRow = `
                <tr>
                    <td class="hof-season">${escapeHtml(item.saison || '')}</td>
                    <td>🏆 ${escapeHtml(item.vainqueur || '')}</td>
                    <td class="text-right">${escapeHtml(item.ptsVainqueur || '')}</td>
                    <td>🥈 ${escapeHtml(item.deuxieme || '')}</td>
                    <td class="text-right hof-sub">${escapeHtml(item.ptsDeuxieme || '')}</td>
                    <td>👕 ${escapeHtml(item.maillot || '')}</td>
                </tr>
            `;
            hallBody.innerHTML += htmlRow;
        });
    } catch (error) {
        console.error("Erreur lors du chargement du Hall of Fame:", error);
        hallBody.innerHTML = `<tr><td colspan="6" class="table-message table-message--error">Le palmarès n’a pas pu être chargé. Recharge la page dans quelques instants.</td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchHallOfFame();
});
