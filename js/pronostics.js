// ==========================================
// PAGE PRONOSTICS (pronostics.html)
// Dépend de : config.js, common.js, api.js, scoring.js
// Deux modes : fiche d'un joueur, ou duel entre deux joueurs.
// ==========================================

// CATEGORY_LABELS, STAT_KEYS, AWARD_KEYS sont définis dans common.js (partagés avec standings.js)

// Codes ESPN des logos, par nom court d'équipe (celui utilisé dans le Sheet)
const TEAM_LOGO_CODES = {
    Hawks: 'atl', Celtics: 'bos', Nets: 'bkn', Hornets: 'cha', Bulls: 'chi', Cavs: 'cle',
    Pistons: 'det', Pacers: 'ind', Heat: 'mia', Bucks: 'mil', Knicks: 'nyk', Magic: 'orl',
    '76ers': 'phi', Raptors: 'tor', Wizards: 'wsh', Mavericks: 'dal', Nuggets: 'den',
    Warriors: 'gs', Rockets: 'hou', Clippers: 'lac', Lakers: 'lal', Grizzlies: 'mem',
    Wolves: 'min', Pelicans: 'no', Thunder: 'okc', Suns: 'phx', Blazers: 'por',
    Kings: 'sac', Spurs: 'sas', Jazz: 'utah'
};

const SCORE_PILLS = [
    { key: 'est', label: 'Est', tab: 'classements', conf: 'east' },
    { key: 'ouest', label: 'Ouest', tab: 'classements', conf: 'west' },
    { key: 'stats', label: 'Stats', tab: 'stats' },
    { key: 'awards', label: 'Awards', tab: 'stats' }
];
const VALID_TABS = ['classements', 'stats', 'evolution'];
const STORAGE_KEY = 'airball:lastPlayer';
const CHART_COLORS = ['#ffa136', '#dcff5f'];

const state = {
    data: null, players: [], current: null, opponent: null,
    tab: 'classements', conf: 'east', chart: null, evolutionToken: 0
};

// ---------- petits utilitaires ----------
const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const ordinal = n => (n === 1 ? '1er' : n + 'e');
const esc = escapeHtml;
const isDuel = () => Boolean(state.current && state.opponent && state.opponent.id !== state.current.id);

function tierFor(pts) {
    const n = parseFloat(pts);
    if (isNaN(n) || n <= 0) return { row: '', badge: 'pts-badge' };
    if (n < 1) return { row: 'row-tier-05', badge: 'pts-badge pts-tier-05' };
    if (n < 1.5) return { row: 'row-tier-1', badge: 'pts-badge pts-tier-1' };
    return { row: 'row-tier-2', badge: 'pts-badge pts-tier-2' };
}

function teamLogo(team) {
    const code = TEAM_LOGO_CODES[team];
    if (!code) return '';
    return `<img src="https://a.espncdn.com/i/teamlogos/nba/500/${code}.png" alt="" class="team-logo">`;
}

function gapBadge(gap) {
    if (gap === null) return '<span class="gap-badge gap-none">—</span>';
    if (gap === 0) return '<span class="gap-badge gap-exact">✅ exact</span>';
    if (gap === 1) return '<span class="gap-badge gap-close">🟡 ±1</span>';
    return `<span class="gap-badge gap-miss">❌ ±${gap}</span>`;
}

// Un rang n'a de sens que si au moins un joueur a déjà des points
function rankLabel(key, player) {
    const anyPoints = state.players.some(p => (p.scores[key] || 0) > 0);
    return anyPoints ? ordinal(Scoring.rankOf(state.players, player, key)) : '—';
}

function showMessage(text, detail) {
    $('pronos-message').hidden = false;
    $('pronos-message').textContent = detail ? `${text} (${detail})` : text;
    $('pronos-content').hidden = true;
}

// ---------- en-tête, pastilles, bandeau de duel ----------
function renderHeader(player, rival) {
    $('profile-avatar').innerHTML = renderAvatarHtml(player.avatar, player.pseudo);
    $('profile-name').textContent = player.pseudo;
    $('profile-rank').textContent = rankLabel('total', player);
    $('profile-total-pts').textContent = fmt(player.scores.total);

    $('score-pills').innerHTML = SCORE_PILLS.map(pill => `
        <button type="button" class="score-pill" data-tab="${pill.tab}" ${pill.conf ? `data-conf="${pill.conf}"` : ''}>
            <span class="pill-label">${pill.label}${rankLabel(pill.key, player) !== '—' ? ` <span class="pill-rank">· ${rankLabel(pill.key, player)}</span>` : ''}</span>
            <span class="pill-value">${fmt(player.scores[pill.key])}${rival ? ` <span class="pill-vs">vs ${fmt(rival.scores[pill.key])}</span>` : ''}</span>
        </button>`).join('');
}

function duelSide(player) {
    return `<div class="duel-side">
        <div class="profile-avatar-large">${renderAvatarHtml(player.avatar, player.pseudo)}</div>
        <div>
            <div class="duel-name">${esc(player.pseudo)}</div>
            <div class="duel-meta">${rankLabel('total', player)} · ${fmt(player.scores.total)} pts</div>
        </div>
    </div>`;
}

function renderDuelBanner(a, b) {
    const s = Scoring.duelSummary(a, b, STAT_KEYS.concat(AWARD_KEYS));
    const chips = [
        `🏀 <b>${s.sameTeams}/${s.totalTeams}</b> même rang`,
        `🎯 <b>${s.samePick1}/${s.totalCats}</b> même Pick 1`
    ];
    if (s.biggest) {
        chips.push(`⚡ Plus gros écart : <b>${esc(s.biggest.team)}</b> (${esc(a.pseudo)} ${ordinal(s.biggest.a)} · ${esc(b.pseudo)} ${ordinal(s.biggest.b)})`);
    }
    if (s.pointsGap !== 0) {
        chips.push(`📊 <b>${esc((s.pointsGap > 0 ? a : b).pseudo)}</b> +${fmt(Math.abs(s.pointsGap))} pt${Math.abs(s.pointsGap) > 1 ? 's' : ''}`);
    }

    $('duel-banner').innerHTML = `
        <div class="player-profile-card duel-card">
            ${duelSide(a)}
            <div class="duel-vs">VS<button type="button" class="link-btn copy-link-btn">🔗 Copier le lien</button></div>
            ${duelSide(b)}
        </div>
        <div class="duel-chips">${chips.map(chip => `<span class="duel-chip">${chip}</span>`).join('')}</div>`;
}

// ---------- onglet Classements ----------
function conferencePanel(id, title, rows) {
    const body = rows.map(r => {
        const tier = tierFor(r.pts);
        return `<tr class="${tier.row}">
            <td class="text-center"><strong>${r.predicted}</strong></td>
            <td class="team-cell"><span class="team-inline">${teamLogo(r.team)}<span>${esc(r.team)}</span></span></td>
            <td class="text-center">${r.real === null ? '—' : r.real}</td>
            <td class="gap-cell">${gapBadge(r.gap)}</td>
            <td class="text-right ${tier.badge}">${r.pts === null ? '-' : fmt(r.pts)}</td>
        </tr>`;
    }).join('');

    return `<div class="conf-panel" data-conf-panel="${id}">
        <h3>${title}</h3>
        <div class="table-responsive">
        <table>
            <thead><tr>
                <th class="text-center" style="width: 55px;">Prono</th>
                <th>Équipe</th>
                <th class="text-center" style="width: 50px;">Réel</th>
                <th>Écart</th>
                <th class="text-right" style="width: 50px;">Pts</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
        </div>
    </div>`;
}

function duelConferencePanel(id, title, a, b, realList) {
    const rows = Scoring.duelConferenceRows(a[id], b[id], realList);
    const cell = (rank, pts) => `<td class="text-center ${tierFor(pts).row}"><strong>${rank}</strong></td>`;

    const body = rows.map(r => {
        const diffCell = r.diff === 0
            ? '<span class="gap-badge gap-exact">=</span>'
            : r.diff >= 5 ? `<span class="gap-badge gap-miss">±${r.diff}</span>` : `<span class="gap-badge">±${r.diff}</span>`;
        return `<tr>
            <td class="team-cell"><span class="team-inline">${teamLogo(r.team)}<span>${esc(r.team)}</span></span></td>
            ${cell(r.a, r.aPts)}${cell(r.b, r.bPts)}
            <td class="text-center">${diffCell}</td>
            <td class="text-center real-rank">${r.real === null ? '—' : r.real}</td>
        </tr>`;
    }).join('');

    return `<div class="conf-panel" data-conf-panel="${id}">
        <h3>${title}</h3>
        <div class="table-responsive">
        <table class="duel-table">
            <thead><tr>
                <th>Équipe</th>
                <th class="text-center duel-col" title="${esc(a.pseudo)}">${esc(a.pseudo)}</th>
                <th class="text-center duel-col" title="${esc(b.pseudo)}">${esc(b.pseudo)}</th>
                <th class="text-center">Écart</th>
                <th class="text-center">Réel</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
        </div>
    </div>`;
}

function renderConferences() {
    const real = state.data.real;
    const a = state.current;
    if (isDuel()) {
        const b = state.opponent;
        $('conf-grid').innerHTML =
            duelConferencePanel('east', 'Conférence Est', a, b, real.east) +
            duelConferencePanel('west', 'Conférence Ouest', a, b, real.west);
    } else {
        $('conf-grid').innerHTML =
            conferencePanel('east', 'Conférence Est', Scoring.conferenceRows(a.east, real.east)) +
            conferencePanel('west', 'Conférence Ouest', Scoring.conferenceRows(a.west, real.west));
    }
}

// ---------- onglet Stats & Awards ----------
function picksTable(title, keys, picksByKey, realByKey) {
    const rows = keys.map(key => ({
        key,
        real: (realByKey[key] || [])[0] || '',
        ...Scoring.pickRow(picksByKey[key], (realByKey[key] || [])[0])
    }));

    const body = rows.map(r => {
        const tier = tierFor(r.pts);
        const cells = [0, 1, 2].map(i => {
            const name = esc(r.picks[i] || '—');
            return r.hits[i] ? `<td class="pick-hit">⭐ ${name}</td>` : `<td>${name}</td>`;
        }).join('');
        return `<tr class="${tier.row}">
            <td><strong>${CATEGORY_LABELS[r.key]}</strong></td>
            ${cells}
            <td class="real-cell">${r.real ? esc(r.real) : '—'}</td>
            <td class="text-right ${tier.badge}">${r.pts === null ? '-' : fmt(r.pts)}</td>
        </tr>`;
    }).join('');

    return `<h3>${title}</h3>
        <div class="table-responsive">
        <table>
            <thead><tr>
                <th>Catégorie</th><th>Pick 1</th><th>Pick 2</th><th>Pick 3</th>
                <th>Réel</th><th class="text-right" style="width: 50px;">Pts</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
        </div>`;
}

// Les 3 picks d'un joueur, un par ligne : ⭐ = pick gagnant, surligné = pick aussi choisi par l'adversaire
function duelPickLines(row, otherPicks) {
    const others = new Set(otherPicks.filter(Boolean).map(Scoring.norm));
    return [0, 1, 2].map(i => {
        const pick = row.picks[i] || '';
        const classes = ['pick-line'];
        if (row.hits[i]) classes.push('pick-hit');
        if (pick && others.has(Scoring.norm(pick))) classes.push('pick-common');
        return `<div class="${classes.join(' ')}">${i + 1}. ${row.hits[i] ? '⭐ ' : ''}${esc(pick || '—')}</div>`;
    }).join('');
}

function duelPicksTable(title, keys, a, b, source, realByKey) {
    const rows = keys.map(key => {
        const realFirst = (realByKey[key] || [])[0] || '';
        return { key, realFirst, a: Scoring.pickRow(a[source][key], realFirst), b: Scoring.pickRow(b[source][key], realFirst) };
    });

    const body = rows.map(r => {
        const pts = (r.a.pts === null) ? '-' : `${fmt(r.a.pts)} / ${fmt(r.b.pts)}`;
        return `<tr>
            <td><strong>${CATEGORY_LABELS[r.key]}</strong></td>
            <td>${duelPickLines(r.a, r.b.picks)}</td>
            <td>${duelPickLines(r.b, r.a.picks)}</td>
            <td class="real-cell">${r.realFirst ? esc(r.realFirst) : '—'}</td>
            <td class="text-right"><strong>${pts}</strong></td>
        </tr>`;
    }).join('');

    return `<h3>${title}</h3>
        <div class="table-responsive">
        <table>
            <thead><tr>
                <th>Catégorie</th><th>${esc(a.pseudo)}</th><th>${esc(b.pseudo)}</th>
                <th>Réel</th><th class="text-right" style="width: 70px;">Pts</th>
            </tr></thead>
            <tbody>${body}</tbody>
        </table>
        </div>`;
}

function renderStats() {
    const real = state.data.real;
    const a = state.current;
    if (isDuel()) {
        const b = state.opponent;
        $('stats-panel').innerHTML =
            '<div class="duel-legend"><span class="pick-common">Pick choisi par les deux</span> · ⭐ Pick gagnant</div>' +
            duelPicksTable('Statistiques', STAT_KEYS, a, b, 'stats', real.stats) +
            '<div class="trophies-spacer"></div>' +
            duelPicksTable('Trophées', AWARD_KEYS, a, b, 'awards', real.awards);
    } else {
        $('stats-panel').innerHTML =
            picksTable('Statistiques', STAT_KEYS, a.stats, real.stats) +
            '<div class="trophies-spacer"></div>' +
            picksTable('Trophées', AWARD_KEYS, a.awards, real.awards);
    }
}

// ---------- onglet Évolution ----------
function renderEvolution() {
    const a = state.current;
    const b = isDuel() ? state.opponent : null;
    const token = ++state.evolutionToken;
    const message = $('evolution-message');
    const wrap = $('chart-wrap');

    message.hidden = false;
    message.textContent = 'Chargement de l\'historique...';
    wrap.hidden = true;
    if (state.chart) { state.chart.destroy(); state.chart = null; }

    Api.getHistory().then(history => {
        if (token !== state.evolutionToken) return; // l'utilisateur a changé entre-temps

        const dateOf = item => String(item.semaine || '').split('T')[0];
        const nameOf = item => String(item.joueur).trim().toLowerCase();
        const wanted = [a, b].filter(Boolean);
        const rows = (history || []).filter(item => wanted.some(p => p.pseudo.toLowerCase() === nameOf(item)));

        if (rows.length === 0) {
            message.textContent = 'Le graphique apparaîtra après la première semaine de jeu.';
            return;
        }
        if (typeof Chart === 'undefined') {
            message.textContent = 'Le graphique est indisponible pour le moment.';
            return;
        }

        const labels = [...new Set(rows.map(dateOf))];
        const datasets = wanted.map((player, i) => {
            const byDate = {};
            rows.filter(item => nameOf(item) === player.pseudo.toLowerCase()).forEach(item => { byDate[dateOf(item)] = item.classement; });
            return {
                label: player.pseudo,
                data: labels.map(label => (label in byDate ? byDate[label] : null)),
                borderColor: CHART_COLORS[i],
                backgroundColor: CHART_COLORS[i] + '1f',
                borderWidth: 3,
                pointBackgroundColor: CHART_COLORS[i],
                pointRadius: 5,
                fill: !b,
                spanGaps: true,
                tension: 0.2
            };
        }).filter(dataset => dataset.data.some(value => value !== null));

        message.hidden = true;
        wrap.hidden = false;

        state.chart = new Chart($('playerRankChart'), {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        reverse: true,
                        min: 1,
                        suggestedMax: state.players.length,
                        ticks: { stepSize: 1, color: '#8e8d91' },
                        grid: { color: 'rgba(255, 255, 255, 0.06)' }
                    },
                    x: { ticks: { color: '#8e8d91' }, grid: { display: false } }
                },
                plugins: {
                    legend: { display: Boolean(b), labels: { color: '#ffffff' } },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label} : ${ctx.parsed.y}e` } }
                }
            }
        });
    }).catch(error => {
        console.error('Erreur historique :', error);
        if (token === state.evolutionToken) message.textContent = 'Impossible de charger l\'historique.';
    });
}

// ---------- navigation (onglets, conférence, URL) ----------
function syncUrl() {
    if (!state.current) return;
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('joueur', state.current.id);
        url.searchParams.set('tab', state.tab);
        if (isDuel()) url.searchParams.set('vs', state.opponent.id); else url.searchParams.delete('vs');
        window.history.replaceState(null, '', url);
    } catch (e) { /* page ouverte en local : on ignore */ }
}

function setConf(conf) {
    state.conf = conf;
    document.querySelectorAll('.conf-switch button').forEach(b => b.classList.toggle('active', b.dataset.conf === conf));
    document.querySelectorAll('.conf-panel').forEach(p => p.classList.toggle('active', p.dataset.confPanel === conf));
}

function setTab(tab) {
    state.tab = VALID_TABS.includes(tab) ? tab : 'classements';
    document.querySelectorAll('.tab-btn').forEach(b => {
        const active = b.dataset.tab === state.tab;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.dataset.panel !== state.tab; });
    if (state.tab === 'evolution') renderEvolution();
    syncUrl();
}

function fillCompareSelect() {
    const select = $('compare-select');
    const others = state.players.filter(p => !state.current || p.id !== state.current.id);
    select.innerHTML = '<option value="">Personne</option>' +
        others.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}</option>`).join('');
    select.value = state.opponent ? state.opponent.id : '';
    select.disabled = !state.current;
}

function renderAll() {
    const duel = isDuel();
    $('profile-card').hidden = duel;
    $('duel-banner').hidden = !duel;

    renderHeader(state.current, duel ? state.opponent : null);
    if (duel) renderDuelBanner(state.current, state.opponent);
    renderConferences();
    renderStats();
    setConf(state.conf);
    setTab(state.tab); // relance aussi l'Évolution si on est sur cet onglet, et met l'URL à jour
}

function showPlayer(player) {
    state.current = player;
    if (state.opponent && state.opponent.id === player.id) state.opponent = null;

    $('pronos-message').hidden = true;
    $('pronos-content').hidden = false;

    fillCompareSelect();
    renderAll();

    try { localStorage.setItem(STORAGE_KEY, player.id); } catch (e) { /* stockage indisponible */ }
}

function setOpponent(player) {
    state.opponent = player;
    renderAll();
}

function clearPlayer() {
    state.current = null;
    state.opponent = null;
    fillCompareSelect();
    showMessage('Choisis un joueur dans le menu pour voir ses pronostics.');
}

function findPlayer(value) {
    if (!value) return null;
    return state.players.find(p => p.id === value)
        || state.players.find(p => p.pseudo.toLowerCase() === value.toLowerCase())
        || null;
}

function findInitialPlayer() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') && VALID_TABS.includes(params.get('tab'))) state.tab = params.get('tab');

    const fromUrl = findPlayer(params.get('joueur'));
    if (fromUrl) {
        const rival = findPlayer(params.get('vs'));
        if (rival && rival.id !== fromUrl.id) state.opponent = rival;
        return fromUrl;
    }
    try {
        return findPlayer(localStorage.getItem(STORAGE_KEY));
    } catch (e) { return null; }
}

function bindEvents() {
    $('player-select').addEventListener('change', event => {
        const player = findPlayer(event.target.value);
        if (player) showPlayer(player); else clearPlayer();
    });

    $('compare-select').addEventListener('change', event => {
        if (state.current) setOpponent(findPlayer(event.target.value));
    });

    document.querySelector('.tabs').addEventListener('click', event => {
        const button = event.target.closest('.tab-btn');
        if (button) setTab(button.dataset.tab);
    });

    $('score-pills').addEventListener('click', event => {
        const pill = event.target.closest('.score-pill');
        if (!pill) return;
        if (pill.dataset.conf) setConf(pill.dataset.conf);
        setTab(pill.dataset.tab);
    });

    document.querySelector('.conf-switch').addEventListener('click', event => {
        const button = event.target.closest('button');
        if (button) setConf(button.dataset.conf);
    });

    // Le bouton "Copier le lien" existe dans la carte joueur ET dans le bandeau de duel
    document.addEventListener('click', async event => {
        const button = event.target.closest('.copy-link-btn');
        if (!button) return;
        try {
            await navigator.clipboard.writeText(window.location.href);
            button.textContent = '✅ Lien copié';
        } catch (e) {
            button.textContent = 'Copie impossible';
        }
        setTimeout(() => { button.textContent = '🔗 Copier le lien'; }, 1800);
    });
}

async function initPronostics() {
    const select = $('player-select');
    if (!select) return;

    try {
        const data = await Api.getPronos();

        if (!data.revealed) {
            select.innerHTML = '<option value="">🔒 Pronostics non révélés</option>';
            showMessage('🔒 Les pronostics seront révélés au lancement de la saison (ou avant, lors d\'une soirée reveal !).');
            return;
        }

        // Réponse au mauvais format = l'ancien script Apps Script est encore en ligne
        if (!Array.isArray(data.players) || !data.real) {
            throw new Error('réponse inattendue du script : nouvelle version à déployer dans Apps Script ?');
        }

        state.data = data;
        state.players = [...data.players].sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));

        if (state.players.length === 0) {
            select.innerHTML = '<option value="">Aucun joueur</option>';
            showMessage('Aucun joueur inscrit pour le moment.');
            return;
        }

        select.innerHTML = '<option value="">-- Choisir un joueur --</option>' +
            state.players.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}</option>`).join('');
        select.disabled = false;

        bindEvents();

        const start = findInitialPlayer();
        if (start) {
            select.value = start.id;
            showPlayer(start);
        } else {
            clearPlayer();
        }
    } catch (error) {
        console.error('Erreur de chargement des pronostics :', error);
        select.innerHTML = '<option value="">Erreur</option>';
        showMessage('Impossible de charger les pronostics.', error.message);
    }
}

document.addEventListener('DOMContentLoaded', initPronostics);
