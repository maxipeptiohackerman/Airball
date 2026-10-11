// ==========================================
// RÈGLES DU JEU (page rules.html)
// Affiche les 3 derniers maillots remportés, à partir de l'onglet Hall of Fame.
// Photo d'un maillot : img/maillots/<nom-du-maillot>.webp (ex. "Ivica Zubac" -> ivica-zubac.webp).
// Sans photo (maillot pas encore choisi, "TBA"...), une silhouette de maillot s'affiche.
// Dépend de : common.js (escapeHtml) et api.js (Api)
// ==========================================
const JERSEY_PLACEHOLDER = '<svg viewBox="0 0 31 40" fill="none" aria-hidden="true"><path d="M3.25 0h5.17c.38 3.83 2.87 6.79 6.89 6.79S21.82 3.83 22.2 0h5.17v8.33c0 3.35 1.05 5.84 3.25 8.13V40H0V16.46c2.2-2.29 3.25-4.78 3.25-8.13V0Z" transform="translate(.6 .6) scale(.96)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

// "Victor Wembanyama" -> "victor-wembanyama" (accents et ponctuation retirés)
const jerseySlug = name => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "2025-26" ou "2025/2026" -> "2025-2026"
function seasonLabel(value) {
    const m = String(value || '').match(/(\d{4})\D+(\d{2,4})/);
    if (!m) return String(value || '');
    return `${m[1]}-${m[2].length === 2 ? m[1].slice(0, 2) + m[2] : m[2]}`;
}

// Photo du maillot ; la silhouette ne s'affiche que s'il n'y a pas de photo
function jerseyThumb(name) {
    const slug = jerseySlug(name);
    if (!slug || slug === 'tba') return `<span class="lot-thumb-empty">${JERSEY_PLACEHOLDER}</span>`;
    return `<img src="img/maillots/${slug}.webp" alt="" loading="lazy" onerror="this.nextElementSibling.hidden = false; this.remove();">`
        + `<span class="lot-thumb-empty" hidden>${JERSEY_PLACEHOLDER}</span>`;
}

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
            <li class="lot-history-item">
                <span class="lot-thumb">${jerseyThumb(item.maillot)}</span>
                <span class="lot-history-text">
                    <span class="lot-history-name">${escapeHtml(item.maillot)}</span>
                    <span class="lot-history-meta">Saison ${escapeHtml(seasonLabel(item.saison))} · remporté par ${escapeHtml(item.vainqueur || '')}</span>
                </span>
            </li>`).join('');
        block.hidden = false;
    } catch (error) {
        // Bloc facultatif : en cas d'erreur, la page reste lisible sans lui
        console.warn("Maillots déjà remportés indisponibles :", error);
    }
}

document.addEventListener('DOMContentLoaded', showPastJerseys);
