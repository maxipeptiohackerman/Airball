// ==========================================
// RÈGLES DU JEU (page rules.html)
// Affiche les maillots déjà remportés, à partir de l'onglet Hall of Fame.
// Dépend de : common.js (escapeHtml) et api.js (Api)
// ==========================================
async function showPastJerseys() {
    const block = document.getElementById('lot-history');
    const list = document.getElementById('lot-history-list');
    if (!block || !list) return;

    try {
        const seasons = await Api.getHallOfFame();
        const won = (Array.isArray(seasons) ? seasons : [])
            .filter(item => item && String(item.maillot || '').trim())
            .sort((a, b) => String(b.saison || '').localeCompare(String(a.saison || '')))
            .slice(0, 3);

        if (won.length === 0) return; // rien à montrer : le bloc reste masqué

        list.innerHTML = won.map(item => `
            <li class="rules-row">
                <span class="rules-label">${escapeHtml(item.maillot)}
                    <small>Saison ${escapeHtml(item.saison || '')} · remporté par ${escapeHtml(item.vainqueur || '')}</small>
                </span>
                <svg class="lot-jersey-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 2h1.5a2.5 2.5 0 0 0 5 0H16c0 3 1 5 3 6v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8c2-1 3-3 3-6Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
            </li>`).join('');
        block.hidden = false;
    } catch (error) {
        // Bloc facultatif : en cas d'erreur, la page reste lisible sans lui
        console.warn("Maillots déjà remportés indisponibles :", error);
    }
}

document.addEventListener('DOMContentLoaded', showPastJerseys);
