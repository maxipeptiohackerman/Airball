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

document.addEventListener('DOMContentLoaded', () => {
    fetchHallOfFame();
});
