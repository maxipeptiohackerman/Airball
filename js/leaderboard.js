// ==========================================
// LEADERBOARD (page index.html)
// Dépend de : common.js (escapeHtml, renderAvatarHtml) et api.js (Api)
// ==========================================

// Flèches d'évolution (icônes de la maquette, couleur pilotée par le CSS)
const TREND_ICONS = {
    up: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17 17V7H7M17 7L7 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5.834 5.834l8.333 8.333M14.167 5.834v8.333H5.834" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    same: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.166 10h11.667M10 4.166l5.833 5.833L10 15.833" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const TREND_LABELS = { up: 'En progression', down: 'En recul', same: 'Stable' };

// "+2 ↗", "−1 ↘" ou "0 →", avec une phrase complète au survol et pour les lecteurs d'écran
function trendHtml(trend) {
    const places = Math.abs(trend.delta);
    const detail = trend.delta === 0
        ? (trend.since ? `même place que le ${trend.since}` : 'pas encore d’historique')
        : `${trend.delta > 0 ? '+' : '−'}${places} place${places > 1 ? 's' : ''} depuis le ${trend.since}`;
    const label = `${TREND_LABELS[trend.kind]} : ${detail}`;
    const value = trend.delta > 0 ? `+${places}` : trend.delta < 0 ? `−${places}` : '0';
    return `<span class="trend trend--${trend.kind}" title="${label}">
        <span class="visually-hidden">${label}</span>
        <span class="trend-value" aria-hidden="true">${value}</span>${TREND_ICONS[trend.kind]}
    </span>`;
}

/**
 * Relevés de chaque joueur, du plus récent au plus ancien :
 * { "identifiant du joueur": [{ date, rank, points }, ...] }
 * Les dates invalides ou dans le futur sont ignorées (parseWeek : common.js).
 */
function historyByPlayer(history, now = new Date()) {
    const byPlayer = {};
    (history || []).forEach(item => {
        if (!item || !item.id) return;
        const date = parseWeek(item.semaine);
        const rank = Number(item.classement);
        if (!date || date > now || !rank) return;
        (byPlayer[item.id] = byPlayer[item.id] || []).push({ date, rank, points: Number(item.points) });
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

// Médailles du podium (images de la maquette). Si l'image manque, un insigne de secours s'affiche.
const MEDALS = {
    1: { cls: 'gold', img: 'img/home/medal-gold.png', label: '1re place' },
    2: { cls: 'silver', img: 'img/home/medal-silver.png', label: '2e place' },
    3: { cls: 'bronze', img: 'img/home/medal-bronze.png', label: '3e place' }
};
const medalFallback = rank => `<svg class="medal-fallback" viewBox="0 0 80 80" aria-hidden="true"><path d="M40 6l29 17v34L40 74 11 57V23z" fill="none" stroke="currentColor" stroke-width="3"/><text x="40" y="50" text-anchor="middle" font-size="28" font-weight="700" fill="currentColor">${rank}</text></svg>`;

const fmt = value => (Math.round((Number(value) || 0) * 10) / 10).toLocaleString('fr-FR');

function playerStats(player) {
    const s = player.scores;
    return { est: fmt(s.est), ouest: fmt(s.ouest), stats: fmt(s.stats), awards: fmt(s.awards), total: fmt(s.total) };
}

function podiumCard({ rank, player, trend }) {
    const medal = MEDALS[rank];
    const name = escapeHtml(player.pseudo);
    const st = playerStats(player);
    return `
        <article class="podium-card podium-card--${medal.cls}" aria-label="${medal.label} : ${name}, ${st.total} points">
            <div class="podium-medal">
                <img src="${medal.img}" alt="" onerror="this.outerHTML=medalFallback(${rank})">
            </div>
            <div class="podium-body">
                <dl class="podium-stats">
                    <div><dt>Pts Est</dt><dd>${st.est}</dd></div>
                    <div><dt>Pts Ouest</dt><dd>${st.ouest}</dd></div>
                    <div><dt>Stats</dt><dd>${st.stats}</dd></div>
                    <div><dt>Awards</dt><dd>${st.awards}</dd></div>
                    <div><dt>Total</dt><dd>${st.total}</dd></div>
                </dl>
                <div class="podium-player">
                    <span class="podium-avatar">${renderAvatarHtml(player.avatar, player.pseudo)}</span>
                    <span class="podium-name">${name}</span>
                    ${trendHtml(trend)}
                </div>
            </div>
        </article>`;
}

function showMessage(list, text, isError = false) {
    list.innerHTML = `<tr><td colspan="8" class="rank-message${isError ? ' rank-message--error' : ''}">${text}</td></tr>`;
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

        RevealLock.remember(json.revealed, 'home');
        const card = list.closest('.rank-card');
        if (!json.revealed) {
            RevealLock.show(card, REVEAL_TEXTS.home);
            return;
        }
        RevealLock.hide(card);

        // Réponse au mauvais format = l'ancien script Apps Script est encore en ligne
        if (!Array.isArray(json.players)) {
            throw new Error('réponse inattendue du script : nouvelle version à déployer dans Apps Script ?');
        }
        if (json.players.length === 0) {
            showMessage(list, 'Aucun joueur inscrit pour le moment.');
            return;
        }

        // Joueurs déjà triés par total décroissant par le script
        const past = historyByPlayer(history);
        const ranked = json.players.map((player, index) => {
            const rank = index + 1;
            return { rank, player, trend: trendFor(rank, referenceFor(past[player.id], rank, player.scores.total)) };
        });

        // Podium : 2e à gauche, 1er au centre (plus haut), 3e à droite
        const podium = document.getElementById('podium');
        const top3 = ranked.slice(0, 3);
        podium.innerHTML = [top3[1], top3[0], top3[2]].filter(Boolean).map(podiumCard).join('');
        podium.hidden = top3.length === 0;

        const rest = ranked.slice(3);
        list.innerHTML = rest.length
            ? rest.map(({ rank, player, trend }) => {
                const st = playerStats(player);
                return `
                <tr>
                    <td class="rank-col-rk">${rank}</td>
                    <td class="rank-col-player">
                        <span class="rank-player">
                            <span class="rank-avatar">${renderAvatarHtml(player.avatar, player.pseudo)}</span>
                            <span class="rank-name">${escapeHtml(player.pseudo)}</span>
                        </span>
                    </td>
                    <td>${st.est}</td>
                    <td>${st.ouest}</td>
                    <td>${st.stats}</td>
                    <td>${st.awards}</td>
                    <td>${st.total}</td>
                    <td>${trendHtml(trend)}</td>
                </tr>`;
            }).join('')
            : `<tr><td colspan="8" class="rank-message">Les autres joueurs apparaîtront ici dès la 4e place.</td></tr>`;

    } catch (error) {
        console.error("Erreur de chargement du leaderboard :", error);
        // Le détail technique aide à diagnostiquer (fichier api.js manquant, Apps Script en erreur...)
        const detail = typeof Api === 'undefined' ? 'le fichier js/api.js n’est pas chargé' : (error && error.message) || 'erreur inconnue';
        showMessage(list, `Le classement n’a pas pu être chargé (${escapeHtml(detail)}). Recharge la page dans quelques instants.`, true);
    }
}

// Le script est chargé en bas de page : le tableau existe déjà, on peut décider tout de suite
(() => {
    const list = document.getElementById('leaderboard-body');
    if (list && RevealLock.shouldLockNow('home')) RevealLock.show(list.closest('.rank-card'), REVEAL_TEXTS.home);
})();

document.addEventListener('DOMContentLoaded', fetchLeaderboard);
