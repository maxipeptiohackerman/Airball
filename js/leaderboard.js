// ==========================================
// LEADERBOARD (page index.html)
// Dépend de : common.js (escapeHtml, renderAvatarHtml) et api.js (Api)
// ==========================================

// Flèches de tendance (icônes Lucide de la maquette, couleur pilotée par le CSS)
const TREND_ICONS = {
    up: '<path d="M19 12L12 5L5 12M12 5V19"/>',
    down: '<path d="M5 12L12 19L19 12M12 19L12 5"/>',
    same: '<path d="M12 19L19 12L12 5M19 12L5 12"/>'
};
const TREND_LABELS = { up: 'En progression', down: 'En recul', same: 'Stable' };

function trendHtml(trend) {
    const places = Math.abs(trend.delta);
    const detail = trend.delta === 0
        ? (trend.since ? `même place que le ${trend.since}` : 'pas encore d’historique')
        : `${trend.delta > 0 ? '+' : '−'}${places} place${places > 1 ? 's' : ''} depuis le ${trend.since}`;
    const label = `${TREND_LABELS[trend.kind]} : ${detail}`;
    return `<span class="lb-trend lb-trend--${trend.kind}" role="img" aria-label="${label}" title="${label}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TREND_ICONS[trend.kind]}</svg>
    </span>`;
}

const keyOf = name => String(name || '').trim().toLowerCase();

/**
 * Lit une date de l'onglet historique, quel que soit son format :
 * "2026-11-08", "2026-11-08T23:00:00.000Z", "08/11/2026" ou "08/11/26" (jour/mois/année).
 * Renvoie null si la date est invalide (ex. "20/20/26").
 */
function parseWeek(value) {
    const text = String(value || '').trim();
    let year, month, day;
    let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        // Date ISO envoyée par Apps Script : on la ramène à midi, heure locale, pour éviter les décalages de fuseau
        const parsed = new Date(text);
        if (isNaN(parsed)) return null;
        year = parsed.getFullYear(); month = parsed.getMonth() + 1; day = parsed.getDate();
        if (text.length === 10) { year = +m[1]; month = +m[2]; day = +m[3]; }
    } else if ((m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {
        day = +m[1]; month = +m[2]; year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    } else {
        return null;
    }
    const date = new Date(year, month - 1, day, 12);
    // Refuse les dates impossibles (mois 20, 31 février...)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
}

/**
 * Relevés de chaque joueur, du plus récent au plus ancien :
 * { "pseudo en minuscules": [{ date, rank, points }, ...] }
 * Les dates invalides ou dans le futur sont ignorées.
 */
function historyByPlayer(history, now = new Date()) {
    const byPlayer = {};
    (history || []).forEach(item => {
        if (!item || !item.joueur) return;
        const date = parseWeek(item.semaine);
        const rank = Number(item.classement);
        if (!date || date > now || !rank) return;
        const key = keyOf(item.joueur);
        (byPlayer[key] = byPlayer[key] || []).push({ date, rank, points: Number(item.points) });
    });
    Object.values(byPlayer).forEach(list => list.sort((a, b) => b.date - a.date));
    return byPlayer;
}

/**
 * Relevé auquel comparer le classement actuel d'un joueur.
 * Si son dernier relevé correspond exactement à la situation actuelle (même rang
 * et mêmes points), c'est qu'il a été pris après la dernière mise à jour :
 * on compare alors au relevé d'avant, pour montrer l'évolution de la semaine.
 */
function referenceFor(entries, currentRank, currentPoints) {
    if (!entries || entries.length === 0) return null;
    const last = entries[0];
    const isNow = last.rank === currentRank && last.points === currentPoints;
    return isNow ? (entries[1] || null) : last;
}

const shortDate = date => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// delta > 0 : le joueur a gagné des places (rang plus petit qu'avant)
function trendFor(currentRank, reference) {
    if (!reference) return { kind: 'same', delta: 0, since: null };
    const delta = reference.rank - currentRank;
    return { kind: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same', delta, since: shortDate(reference.date) };
}

function showMessage(list, text, isError = false) {
    list.innerHTML = `<li class="lb-message${isError ? ' lb-message--error' : ''}">${text}</li>`;
}

async function fetchLeaderboard() {
    const list = document.getElementById('leaderboard-body');
    if (!list) return;

    try {
        // L'historique ne sert qu'aux flèches : s'il échoue, le classement s'affiche quand même.
        const [json, history] = await Promise.all([
            Api.getLeaderboard(),
            Api.getHistory().catch(error => {
                console.warn("Historique indisponible, flèches de tendance masquées :", error);
                return [];
            })
        ]);

        if (!json.revealed) {
            showMessage(list, '🔒 Le classement sera révélé au lancement de la saison (ou avant, si une soirée reveal est organisée !).');
            return;
        }

        const validRows = (json.rows || []).filter(row => {
            const joueur = row[2];
            return joueur && String(joueur).trim() !== '' && String(joueur).toUpperCase() !== 'JOUEUR';
        });

        if (validRows.length === 0) {
            showMessage(list, 'Aucun joueur inscrit pour le moment.');
            return;
        }

        validRows.sort((a, b) => parseFloat(b[7] || 0) - parseFloat(a[7] || 0));

        const past = historyByPlayer(history);

        list.innerHTML = validRows.map((row, index) => {
            const joueur = String(row[2]).trim();
            const rank = index + 1;
            const points = parseFloat(row[7] || 0);
            const trend = trendFor(rank, referenceFor(past[keyOf(joueur)], rank, points));

            return `
                <li class="lb-row">
                    <span class="lb-rank">${rank}</span>
                    <span class="lb-avatar">${renderAvatarHtml(row[8], joueur)}</span>
                    <span class="lb-name">${escapeHtml(joueur)}</span>
                    ${trendHtml(trend)}
                </li>`;
        }).join('');

    } catch (error) {
        console.error("Erreur de chargement du leaderboard :", error);
        // Le détail technique aide à diagnostiquer (fichier api.js manquant, Apps Script en erreur...)
        const detail = typeof Api === 'undefined' ? 'le fichier js/api.js n’est pas chargé' : (error && error.message) || 'erreur inconnue';
        showMessage(list, `Le classement n’a pas pu être chargé (${escapeHtml(detail)}). Recharge la page dans quelques instants.`, true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchLeaderboard();
});
