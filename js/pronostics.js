// ==========================================
// PAGE PRONOSTICS (pronostics.html)
// Dépend de : config.js, common.js, api.js, teams.js, scoring.js
// Deux modes : fiche d'un joueur, ou duel entre deux joueurs.
// ==========================================

// CATEGORY_LABELS, STAT_KEYS, AWARD_KEYS sont définis dans common.js (partagés avec standings.js)

const SCORE_PILLS = [
    { key: 'est', label: 'Est', tab: 'classements', conf: 'east' },
    { key: 'ouest', label: 'Ouest', tab: 'classements', conf: 'west' },
    { key: 'stats', label: 'Stats', tab: 'stats' },
    { key: 'awards', label: 'Awards', tab: 'stats' }
];
const VALID_TABS = ['classements', 'stats', 'evolution'];
const STORAGE_KEY = 'airball:lastPlayer';

const state = {
    data: null, players: [], current: null, opponent: null,
    tab: 'classements', conf: 'east', evoObserver: null, evolutionToken: 0
};

// ---------- petits utilitaires ----------
const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const ordinal = n => (!n ? '—' : n === 1 ? '1er' : n + 'e');
const esc = escapeHtml;
const isDuel = () => Boolean(state.current && state.opponent && state.opponent.id !== state.current.id);

function tierFor(pts) {
    const n = parseFloat(pts);
    if (isNaN(n) || n <= 0) return { row: '', badge: 'pts-badge' };
    if (n < 1) return { row: 'row-tier-05', badge: 'pts-badge pts-tier-05' };
    if (n < 1.5) return { row: 'row-tier-1', badge: 'pts-badge pts-tier-1' };
    return { row: 'row-tier-2', badge: 'pts-badge pts-tier-2' };
}

const teamLogo = team => Teams.logoHtml(team); // logos communs à tout le site (teams.js)

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
            <div class="duel-vs">VS<button type="button" class="btn-secondary btn--small copy-link-btn">🔗 Copier le lien</button></div>
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
// Total de points semaine après semaine (style "Tendances").
// Le total peut baisser : les points dépendent du classement NBA du moment.
//  Seul : courbe orange = le joueur, courbe grise = le meilleur des AUTRES joueurs à chaque
//  semaine (le leader du moment, ou le 2e quand le joueur est lui-même en tête).
//  Duel : orange = joueur A, citron = joueur B.
const EVO_COLORS = { a: '#f87822', b: '#dcff5f', rival: '#6b6b73', rest: '#4a4a52', grid: '#3a3a42', ink: '#8e8d91' };

// Relevés valides (dates lisibles, pas dans le futur), par date croissante :
// [{ date, key, players: { "identifiant": { name, rank, points } } }]
function evolutionSnapshots(history) {
    const byDate = {};
    const now = new Date();
    (history || []).forEach(item => {
        if (!item || !item.id) return;
        const date = parseWeek(item.semaine);
        const points = Number(item.points);
        if (!date || date > now || isNaN(points)) return;
        const key = date.toISOString().slice(0, 10);
        const snap = byDate[key] || (byDate[key] = { date, key, players: {} });
        snap.players[item.id] = { name: String(item.joueur || '').trim(), rank: Number(item.classement) || null, points };
    });
    return Object.values(byDate).sort((x, y) => x.date - y.date);
}

function buildEvolutionSeries(snapshots, a, b) {
    const keyA = a.id;
    const keyB = b ? b.id : null;
    const weeks = snapshots.filter(s => s.players[keyA] || (keyB && s.players[keyB]));
    return weeks.map(s => {
        const week = { date: s.date, a: s.players[keyA] || null, b: null, rival: null };
        if (keyB) {
            week.b = s.players[keyB] || null;
        } else {
            // Meilleur score parmi les autres joueurs cette semaine-là
            Object.entries(s.players).forEach(([key, p]) => {
                if (key !== keyA && (!week.rival || p.points > week.rival.points)) week.rival = p;
            });
        }
        return week;
    });
}

const shortDay = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function drawEvolution(box, weeks, a, b) {
    const W = Math.max(300, box.clientWidth);
    const compact = W < 520;
    const gutter = compact ? 40 : 52, left = 12, right = W - gutter;
    const top = { y0: 28, y1: compact ? 260 : 340 };
    const H = top.y1 + 30;
    const n = weeks.length;
    const xAt = i => (n === 1 ? (left + right) / 2 : left + 10 + i * ((right - left - 20) / (n - 1)));

    const values = weeks.flatMap(w => [w.a && w.a.points, w.b && w.b.points, w.rival && w.rival.points].filter(v => v != null));
    // Graduations rondes (pas de 1, 2, 5, 10, 20…) : 0, 10, 20, 30 plutôt que 6,3 ou 18,8
    const rawStep = Math.max(...values, 1) / 4;
    const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const tickStep = [1, 2, 5, 10].map(m => m * pow).find(v => v >= rawStep);
    const maxTop = Math.ceil(Math.max(...values, 1) / tickStep) * tickStep;
    const ticks = Array.from({ length: Math.round(maxTop / tickStep) + 1 }, (_, i) => i * tickStep);
    const yTop = v => top.y1 - (v / maxTop) * (top.y1 - top.y0);

    const grid = ys => ys.map(v => `
        <line x1="${left}" x2="${right}" y1="${yTop(v)}" y2="${yTop(v)}" stroke="${EVO_COLORS.grid}" stroke-dasharray="1 4"/>
        <text x="${right + 10}" y="${yTop(v) + 4}" class="evo-tick">${fmt(v)}</text>`).join('');

    const path = (pick, color, width) => {
        let d = '', open = false;
        weeks.forEach((w, i) => {
            const v = pick(w);
            if (v == null) { open = false; return; }
            d += `${open ? 'L' : 'M'}${xAt(i).toFixed(1)},${yTop(v).toFixed(1)} `;
            open = true;
        });
        return d ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>` : '';
    };

    box.innerHTML = `
        <svg class="evo-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" tabindex="0" role="img"
             aria-label="Évolution du total de points de ${esc(a.pseudo)}${b ? ' et de ' + esc(b.pseudo) : ''}. Flèches gauche et droite pour parcourir les semaines.">
            <text x="${left}" y="14" class="evo-title">Total de points</text>
            ${grid(ticks)}
            ${b ? path(w => w.b && w.b.points, EVO_COLORS.b, 2.5) : path(w => w.rival && w.rival.points, EVO_COLORS.rival, 2)}
            ${path(w => w.a && w.a.points, EVO_COLORS.a, 2.5)}

            <text x="${xAt(0)}" y="${H - 8}" class="evo-tick" text-anchor="${n === 1 ? 'middle' : 'start'}">${shortDay(weeks[0].date)}</text>
            ${n > 1 ? `<text x="${xAt(n - 1)}" y="${H - 8}" class="evo-tick" text-anchor="end">${shortDay(weeks[n - 1].date)}</text>` : ''}

            <g class="evo-cursor">
                <line class="evo-cursor-line" y1="${top.y0 - 6}" y2="${top.y1}" stroke="#c0bec3" stroke-width="1"/>
                <circle class="evo-dot-b" r="4.5" fill="${b ? EVO_COLORS.b : EVO_COLORS.rival}"/>
                <circle class="evo-dot-a" r="7" fill="#17171b" stroke="${EVO_COLORS.a}" stroke-width="2.5"/>
            </g>
        </svg>
        <div class="evo-tip" aria-live="polite"></div>`;

    const svg = box.querySelector('svg');
    const tip = box.querySelector('.evo-tip');
    const line = svg.querySelector('.evo-cursor-line');
    const dotA = svg.querySelector('.evo-dot-a');
    const dotB = svg.querySelector('.evo-dot-b');

    const select = i => {
        const w = weeks[i];
        const x = xAt(i);
        line.setAttribute('x1', x); line.setAttribute('x2', x);
        const placeDot = (dot, p) => {
            dot.style.display = p ? '' : 'none';
            if (p) { dot.setAttribute('cx', x); dot.setAttribute('cy', yTop(p.points)); }
        };
        placeDot(dotA, w.a);
        placeDot(dotB, b ? w.b : w.rival);

        const lineA = w.a ? `<b style="color:${EVO_COLORS.a}">${esc(a.pseudo)} : ${fmt(w.a.points)} pts · ${ordinal(w.a.rank)}</b>` : '';
        let lineB = '';
        if (b && w.b) {
            lineB = `<span style="color:${EVO_COLORS.b}">${esc(b.pseudo)} : ${fmt(w.b.points)} pts · ${ordinal(w.b.rank)}</span>`;
            if (w.a) {
                const gap = w.a.points - w.b.points;
                lineB += `<span>${gap === 0 ? 'À égalité' : `${esc(gap > 0 ? a.pseudo : b.pseudo)} devant de ${fmt(Math.abs(gap))} pt${Math.abs(gap) > 1 ? 's' : ''}`}</span>`;
            }
        }
        if (!b && w.rival) {
            const role = w.a && w.a.rank === 1 ? '2e' : 'Leader';
            lineB = `<span>${role} : ${fmt(w.rival.points)} pts (${esc(w.rival.name)})</span>`;
        }
        tip.innerHTML = `<span class="evo-tip-date">Semaine du ${shortDay(w.date)}</span>${lineA}${lineB}`;
        const tipW = tip.offsetWidth;
        tip.style.left = `${Math.min(Math.max(0, x - tipW / 2), W - tipW)}px`;
        svg.dataset.sel = i;
    };

    const nearest = clientX => {
        const rect = svg.getBoundingClientRect();
        const px = (clientX - rect.left) * (W / rect.width);
        let best = 0;
        weeks.forEach((_, i) => { if (Math.abs(xAt(i) - px) < Math.abs(xAt(best) - px)) best = i; });
        return best;
    };
    svg.addEventListener('pointermove', e => select(nearest(e.clientX)));
    svg.addEventListener('pointerdown', e => select(nearest(e.clientX)));
    svg.addEventListener('keydown', e => {
        const cur = Number(svg.dataset.sel);
        if (e.key === 'ArrowLeft' && cur > 0) { select(cur - 1); e.preventDefault(); }
        if (e.key === 'ArrowRight' && cur < n - 1) { select(cur + 1); e.preventDefault(); }
    });

    select(n - 1); // dernière semaine sélectionnée par défaut
}

function renderEvolution() {
    const a = state.current;
    const b = isDuel() ? state.opponent : null;
    const token = ++state.evolutionToken;
    const message = $('evolution-message');
    const wrap = $('chart-wrap');
    const legend = $('evo-legend');
    const box = $('evo-chart');

    message.hidden = false;
    message.textContent = 'Chargement de l\'historique...';
    wrap.hidden = true;
    if (state.evoObserver) { state.evoObserver.disconnect(); state.evoObserver = null; }

    Api.getHistory().then(history => {
        if (token !== state.evolutionToken) return; // l'utilisateur a changé entre-temps

        const weeks = buildEvolutionSeries(evolutionSnapshots(history), a, b);
        if (!weeks.some(w => w.a)) {
            message.textContent = 'Le graphique apparaîtra après le premier relevé hebdomadaire.';
            return;
        }

        legend.innerHTML = `
            <span><i style="background:${EVO_COLORS.a}"></i>${esc(a.pseudo)}</span>
            ${b ? `<span><i style="background:${EVO_COLORS.b}"></i>${esc(b.pseudo)}</span>`
                : `<span><i style="background:${EVO_COLORS.rival}"></i>Meilleur adversaire (leader, ou 2e si ${esc(a.pseudo)} est en tête)</span>`}`;

        message.hidden = true;
        wrap.hidden = false;
        drawEvolution(box, weeks, a, b);

        // Redessine à la bonne largeur (rotation d'écran, menu réduit…)
        let lastWidth = box.clientWidth;
        state.evoObserver = new ResizeObserver(() => {
            if (Math.abs(box.clientWidth - lastWidth) < 4) return;
            lastWidth = box.clientWidth;
            drawEvolution(box, weeks, a, b);
        });
        state.evoObserver.observe(box);
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

        RevealLock.remember(data.revealed, 'pronos');
        const card = document.querySelector('.pronostics-card');
        if (!data.revealed) {
            select.innerHTML = '<option value="">🔒 Pronostics non révélés</option>';
            RevealLock.show(card, REVEAL_TEXTS.pronostics);
            return;
        }
        RevealLock.hide(card);

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

// Avant la saison : fausse popin affichée tout de suite (script chargé en bas de page)
(() => {
    const card = document.querySelector('.pronostics-card');
    if (card && RevealLock.shouldLockNow('pronos')) RevealLock.show(card, REVEAL_TEXTS.pronostics);
})();

document.addEventListener('DOMContentLoaded', initPronostics);
