// ==========================================
// PAGE PRONOSTICS (pronostics.html)
// Dépend de : config.js, common.js, api.js, teams.js, scoring.js
// Deux modes : fiche d'un joueur, ou duel entre deux joueurs.
// ==========================================

// CATEGORY_LABELS, STAT_KEYS, AWARD_KEYS sont définis dans common.js (partagés avec standings.js)

const SCORE_PILLS = [
    { key: 'est', label: 'Est', tab: 'est' },
    { key: 'ouest', label: 'Ouest', tab: 'ouest' },
    { key: 'stats', label: 'Stats', tab: 'stats' },
    { key: 'awards', label: 'Awards', tab: 'stats' }
];
const VALID_TABS = ['resume', 'est', 'ouest', 'stats', 'evolution'];
const OLD_TABS = { classements: 'est' }; // anciens liens partagés
const STORAGE_KEY = 'airball:lastPlayer';

const state = {
    data: null, players: [], current: null, opponent: null,
    tab: 'resume', streaks: {}, records: {}, lastTen: {}, evoObserver: null, evolutionToken: 0
};

// ---------- petits utilitaires ----------
const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const ordinal = n => (!n ? '—' : n === 1 ? '1er' : n + 'e');
const esc = escapeHtml;
const isDuel = () => Boolean(state.current && state.opponent && state.opponent.id !== state.current.id);

const teamLogo = team => Teams.logoHtml(team); // logos communs à tout le site (teams.js)

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
        <button type="button" class="score-pill" data-tab="${pill.tab}">
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

// ---------- onglets Est / Ouest ----------
const ICON_HIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>';
const ICON_MISS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const teamShortName = key => { const t = Teams.find(key); return t ? t.name.split(' ').pop() : key; };

// Fiche d'un joueur : une ligne par équipe, dans l'ordre du classement réel,
// avec les séparations playoffs (après le 6e) et play-in (après le 10e)
const gapClass = gap => gap === 0 ? 'is-hit' : gap === 1 ? 'is-close' : gap === null ? '' : 'is-miss';
// Écart avec un sens : ▲ l'équipe est mieux classée que le prono (sous-estimée), ▼ moins bien (surestimée)
const ICON_UP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 6l7 10H5z"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 18 5 8h14z"/></svg>';
function gapCell(r) {
    if (r.gap === null) return '—';
    if (r.gap === 0) return `<span class="gap-mark" title="Rang exact">${ICON_HIT}</span>`;
    const up = r.real < r.predicted;
    const tip = up ? `Mieux classée que ton prono (${r.predicted}e)` : `Moins bien classée que ton prono (${r.predicted}e)`;
    return `<span class="gap-mark" title="${tip}">${up ? ICON_UP : ICON_DOWN}${r.gap}</span>`;
}
// Équipe : logo, nom, puis bilan et série en petit (ex. « 12-5 · W2 »)
function teamCell(teamValue) {
    const team = Teams.find(teamValue);
    const key = team ? team.key : teamValue;
    const meta = [state.records[key], state.streaks[key]].filter(Boolean).join(' · ');
    return `<td class="c-team"><span class="team-inline">${teamLogo(teamValue)}<span class="team-text"><span class="team-name">${esc(teamShortName(teamValue))}</span>${meta ? `<span class="team-meta">${esc(meta)}</span>` : ''}</span></span></td>`;
}
const GAP_LEGEND = '<p class="sheet-legend">▲ équipe mieux classée que ton prono · ▼ moins bien classée · ✓ rang exact</p>';
const dividerRow = (label, cols) => `<tr class="sheet-divider"><td colspan="${cols}"><span>${label}</span></td></tr>`;

// Fiche d'un joueur, façon tableaux ESPN : lignes fines, chiffres alignés à droite,
// deux groupes de colonnes titrés (Saison NBA | Mon prono), séparations playoffs / play-in en trait
function soloConferenceTable(title, rows) {
    const known = rows.some(r => r.real !== null);
    const sorted = [...rows].sort((a, b) => known ? (a.real || 99) - (b.real || 99) : a.predicted - b.predicted);
    const body = sorted.map((r, i) => {
        const team = Teams.find(r.team);
        const key = team ? team.key : r.team;
        const cls = gapClass(r.gap);
        const cut = known && i === 5 ? ' cut-playoffs' : known && i === 9 ? ' cut-playin' : '';
        return `<tr class="${cut.trim()}">
            <td class="pt-rank">${r.real === null ? '—' : r.real}</td>
            <td class="pt-team"><span class="team-inline">${teamLogo(r.team)}<span class="team-name"><span class="name-full">${esc(team ? team.name : r.team)}</span><span class="name-short">${esc(teamShortName(r.team))}</span></span></span></td>
            <td class="pt-num">${esc(state.records[key] || '—')}</td>
            <td class="pt-num pt-l10">${esc(state.lastTen[key] || '—')}</td>
            <td class="pt-num">${esc(state.streaks[key] || '—')}</td>
            <td class="pt-num pt-prono pt-sep">${r.predicted}</td>
            <td class="pt-num pt-ecart ${cls}">${gapCell(r)}</td>
            <td class="pt-num pt-pts ${cls}">${r.pts === null ? '—' : r.pts > 0 ? `<span class="pt-pill">${fmt(r.pts)}</span>` : fmt(r.pts)}</td>
        </tr>`;
    }).join('');

    const [word, conf] = title.split(' ');
    return `<h3 class="pt-title">${esc(word)} <span>${esc((conf || '').toUpperCase())}</span></h3>
        <div class="table-responsive"><table class="pt-table" aria-label="${esc(title)}">
            <thead>
                <tr class="pt-labels">
                    <th class="pt-rank">Rk</th>
                    <th class="pt-team">Équipe</th>
                    <th class="pt-num">Bilan</th>
                    <th class="pt-num pt-l10" title="Bilan des 10 derniers matchs">L10</th>
                    <th class="pt-num">Streak</th>
                    <th class="pt-num pt-sep">Prono</th>
                    <th class="pt-num">Écart</th>
                    <th class="pt-num">Pts</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table></div>
        <ul class="pt-legend">
            <li><span class="pt-key pt-key--playoffs"></span>Qualifiées pour les playoffs (1 à 6)</li>
            <li><span class="pt-key pt-key--playin"></span>Play-in (7 à 10)</li>
            <li><span class="pt-sym is-up">▲</span>Équipe mieux classée que ton prono</li>
            <li><span class="pt-sym is-down">▼</span>Équipe moins bien classée que ton prono</li>
            <li><span class="pt-sym is-hit">✓</span>Rang exact</li>
        </ul>`;
}

// Duel : bandeau de score (points de l'onglet, barre partagée, pronos identiques)
function duelScoreBanner(a, b, ptsA, ptsB, sameText) {
    const total = ptsA + ptsB;
    const share = total > 0 ? Math.round(ptsA / total * 100) : 50;
    const gap = Math.abs(ptsA - ptsB);
    const lead = gap === 0 ? 'Égalité' : `${esc((ptsA > ptsB ? a : b).pseudo)} mène de ${fmt(gap)} pt${gap > 1 ? 's' : ''}`;
    return `<div class="duel-score">
        <p class="duel-score-pts is-a"><b>${fmt(ptsA)}</b> Pts</p>
        <div class="duel-score-mid">
            <p class="duel-score-lead">${lead}</p>
            <div class="duel-score-bar" aria-hidden="true"><span style="width:${share}%"></span></div>
            <p class="duel-score-same">${sameText}</p>
        </div>
        <p class="duel-score-pts is-b"><b>${fmt(ptsB)}</b> Pts</p>
    </div>`;
}

// Duel Est / Ouest : rang réel, équipe, série, puis Prono / Écart / Pts de chacun
function duelConferenceTable(conf, a, b) {
    const realList = state.data.real[conf];
    const rowsA = Scoring.conferenceRows(a[conf], realList);
    const byTeamB = {};
    Scoring.conferenceRows(b[conf], realList).forEach(r => { byTeamB[r.team] = r; });
    const rows = rowsA.filter(r => byTeamB[r.team]).map(r => ({ team: r.team, real: r.real, a: r, b: byTeamB[r.team] }));
    const known = rows.some(r => r.real !== null);
    rows.sort((x, y) => known ? (x.real || 99) - (y.real || 99) : x.a.predicted - y.a.predicted);

    const side = (r, who) => {
        const cls = gapClass(r.gap);
        return `<td class="c-mid ${cls}${who === 'a' ? ' is-first' : ''}">${r.predicted}</td>
            <td class="c-mid ${cls} c-gap">${gapCell(r)}</td>
            <td class="c-mid ${cls} c-pts">${r.pts === null ? '—' : fmt(r.pts)}</td>`;
    };
    const body = rows.map((r, i) => {
        const line = `<tr>
            <td class="c-rank">${r.real === null ? '—' : r.real}</td>
            ${teamCell(r.team)}
            ${side(r.a, 'a')}${side(r.b, 'b')}
        </tr>`;
        return line + (known && i === 5 ? dividerRow('Playoffs', 8) : known && i === 9 ? dividerRow('Play-in', 8) : '');
    }).join('');

    const same = rows.filter(r => r.a.predicted === r.b.predicted).length;
    const key = conf === 'east' ? 'est' : 'ouest';
    return duelScoreBanner(a, b, a.scores[key] || 0, b.scores[key] || 0,
            `${same} prono${same > 1 ? 's' : ''} identique${same > 1 ? 's' : ''} sur ${rows.length}`) +
        `<div class="table-responsive sheet-table-wrap">
        <table class="sheet-table sheet-table--duel">
            <thead>
                <tr class="duel-names">
                    <th class="c-rank"></th><th class="c-team"></th>
                    <th colspan="3" class="is-a is-first">${esc(a.pseudo)}</th>
                    <th colspan="3" class="is-b">${esc(b.pseudo)}</th>
                </tr>
                <tr>
                    <th class="c-rank">Rank</th><th class="c-team">Équipe</th>
                    <th class="c-mid is-first">Prono</th><th class="c-mid">Écart</th><th class="c-mid">Pts</th>
                    <th class="c-mid is-first">Prono</th><th class="c-mid">Écart</th><th class="c-mid">Pts</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
        </div>${GAP_LEGEND}`;
}

function renderConferences() {
    const real = state.data.real;
    const a = state.current;
    if (isDuel()) {
        const b = state.opponent;
        $('conf-east').innerHTML = duelConferenceTable('east', a, b);
        $('conf-west').innerHTML = duelConferenceTable('west', a, b);
    } else {
        $('conf-east').innerHTML = soloConferenceTable('Conférence Est', Scoring.conferenceRows(a.east, real.east));
        $('conf-west').innerHTML = soloConferenceTable('Conférence Ouest', Scoring.conferenceRows(a.west, real.west));
    }
}

// Bilan (12-5) et série en cours (W2, L1...) de chaque équipe : classement ESPN, chargé une fois en arrière-plan.
// En mode démo, les séries sont fournies avec les fausses données.
async function loadStreaks() {
    if (state.data.real.streaks) { state.streaks = state.data.real.streaks; state.records = state.data.real.records || {}; state.lastTen = state.data.real.lastTen || {}; return; }
    try {
        const standings = await Espn.getStandings({ season: Espn.currentSeason(), seasonType: 2, timeoutMs: 8000 });
        const streaks = {}, records = {}, lastTen = {};
        ['east', 'west'].forEach(conf => standings[conf].entries.forEach(entry => {
            const team = Teams.find(entry.team.abbreviation) || Teams.find(entry.team.displayName);
            const value = Espn.statDisplay(entry, 'streak', '');
            if (team && value) streaks[team.key] = value;
            const wins = Espn.statDisplay(entry, 'wins', ''), losses = Espn.statDisplay(entry, 'losses', '');
            if (team && wins !== '' && losses !== '') records[team.key] = `${wins}-${losses}`;
            // Bilan des 10 derniers matchs (ESPN : « Last Ten Games », abrégé L10)
            const l10 = (entry.stats || []).find(st => st.type === 'lasttengames' || st.abbreviation === 'L10' || /last\s*ten/i.test(`${st.name} ${st.displayName}`));
            if (team && l10) lastTen[team.key] = l10.summary || l10.displayValue;
        }));
        state.streaks = streaks;
        state.records = records;
        state.lastTen = lastTen;
        if (state.current) renderConferences();
    } catch (e) {
        console.warn('Séries ESPN indisponibles :', e);
    }
}

// ---------- onglet Stats & Awards ----------
// Fiche d'un joueur : une carte par catégorie, les 3 picks en maillots (équipe du joueur ou du coach)
const normName = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const PICK_BADGE = ['+2', '+1', '+0,5'];

// Joueurs et coachs (players.json, coaches.json) : équipe de chaque pick. Chargés une fois, en arrière-plan.
async function loadRoster() {
    try {
        const [players, coaches] = await Promise.all(['players.json', 'coaches.json'].map(f => fetch(f).then(r => r.ok ? r.json() : [])));
        const roster = {};
        players.forEach(p => { roster[normName(p.name)] = { team: p.team, num: p.num || '' }; });
        coaches.forEach(c => { roster[normName(c.name)] = { team: c.team, coach: true }; });
        state.roster = roster;
        if (state.current) renderStats();
    } catch (e) {
        console.warn('Listes des joueurs et coachs indisponibles :', e);
    }
}

function pickCard(key, picks, realFirst) {
    const row = Scoring.pickRow(picks, realFirst);
    const pill = row.pts === null ? ''
        : row.pts > 0 ? `<span class="sa-pill is-scored">+${fmt(row.pts)} pt${row.pts > 1 ? 's' : ''}</span>`
        : '<span class="sa-pill">0 pt</span>';
    const cells = [0, 1, 2].map(i => {
        const name = row.picks[i] || '';
        const info = (state.roster || {})[normName(name)] || {};
        const team = Teams.find(info.team);
        const sub = !name ? '' : info.coach ? `Coach · ${team ? team.name.split(' ').pop() : ''}` : (team ? team.name : '');
        const badge = row.hits[i] ? `<span class="sa-badge sa-badge--${i + 1}">${PICK_BADGE[i]}</span>` : '';
        return `<div class="sa-pick${row.hits[i] ? ' is-hit' : ''}">
            <span class="sa-pick-label">Pick ${i + 1}</span>
            <span class="sa-jersey">${Jersey.svg(info.team || '', { className: 'sa-jersey-svg', name: name || ' ', number: info.coach ? '' : (info.num || '') })}${badge}</span>
            <span class="sa-name">${name ? esc(name) : '—'}</span>
            <span class="sa-team">${esc(sub)}</span>
        </div>`;
    }).join('');
    return `<article class="sa-card${row.pts > 0 ? ' is-scored' : ''}">
        <header class="sa-head"><h4>${esc(CATEGORY_LABELS[key])}</h4>${pill}</header>
        <p class="sa-leader">Leader actuel : <b>${realFirst ? esc(realFirst) : 'à venir'}</b></p>
        <div class="sa-picks">${cells}</div>
    </article>`;
}

function pickCards(title, keys, picksByKey, realByKey) {
    return `<h3 class="sa-title">${title}</h3>
        <div class="sa-grid">${keys.map(k => pickCard(k, picksByKey[k], (realByKey[k] || [])[0] || '')).join('')}</div>`;
}

// Duel : les cartes des deux joueurs côte à côte, catégorie par catégorie
function duelPickCards(title, keys, a, b, source, realByKey) {
    const cells = keys.map(k => {
        const real = (realByKey[k] || [])[0] || '';
        return pickCard(k, a[source][k], real) + pickCard(k, b[source][k], real);
    }).join('');
    return `<div class="sa-duel">
        <h3 class="sa-duel-title is-a">${title} ${esc(a.pseudo)}</h3>
        <h3 class="sa-duel-title is-b">${title} ${esc(b.pseudo)}</h3>
        ${cells}
    </div>`;
}

function renderStats() {
    const real = state.data.real;
    const a = state.current;
    if (isDuel()) {
        const b = state.opponent;
        const keys = STAT_KEYS.concat(AWARD_KEYS);
        const pick1 = (p, k) => normName(((p.stats[k] || p.awards[k]) || [])[0]);
        const same = keys.filter(k => pick1(a, k) && pick1(a, k) === pick1(b, k)).length;
        const pts = p => (p.scores.stats || 0) + (p.scores.awards || 0);
        $('stats-panel').innerHTML =
            duelScoreBanner(a, b, pts(a), pts(b), `${same} Pick 1 identique${same > 1 ? 's' : ''} sur ${keys.length}`) +
            duelPickCards('Statistiques', STAT_KEYS, a, b, 'stats', real.stats) +
            duelPickCards('Awards', AWARD_KEYS, a, b, 'awards', real.awards);
    } else {
        $('stats-panel').innerHTML =
            pickCards('Statistiques', STAT_KEYS, a.stats, real.stats) +
            pickCards('Awards', AWARD_KEYS, a.awards, real.awards);
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

function setTab(tab) {
    tab = OLD_TABS[tab] || tab;
    state.tab = VALID_TABS.includes(tab) ? tab : 'resume';
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
    const others = state.players.filter(p => !state.current || p.id !== state.current.id);
    ['compare-select', 'rival-select'].forEach(id => {
        const select = $(id);
        select.innerHTML = `<option value="">${id === 'rival-select' ? 'Personne (fin du duel)' : 'Personne'}</option>` +
            others.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}</option>`).join('');
        select.value = state.opponent ? state.opponent.id : '';
        select.disabled = !state.current;
    });
}

function renderAll() {
    const duel = isDuel();
    // Duel : 2e menu « vs » dans la barre du haut
    $('rival-picker').hidden = !duel;
    $('picker-vs').hidden = !duel;
    $('compare-row').hidden = duel;
    if (duel) {
        $('rival-avatar').innerHTML = renderAvatarHtml(state.opponent.avatar, state.opponent.pseudo);
        $('rival-name').textContent = state.opponent.pseudo;
    }
    ['compare-select', 'rival-select'].forEach(id => { $(id).value = duel ? state.opponent.id : ''; });
    $('profile-card').hidden = duel;
    $('duel-banner').hidden = !duel;

    renderHeader(state.current, duel ? state.opponent : null);
    if (duel) renderDuelBanner(state.current, state.opponent);
    renderConferences();
    renderStats();
    setTab(state.tab); // relance aussi l'Évolution si on est sur cet onglet, et met l'URL à jour
}

function showPlayer(player) {
    state.current = player;
    if (state.opponent && state.opponent.id === player.id) state.opponent = null;

    $('pronos-message').hidden = true;
    $('pronos-content').hidden = false;
    $('picker-avatar').innerHTML = renderAvatarHtml(player.avatar, player.pseudo);
    $('picker-name').textContent = player.pseudo;
    showView('detail');

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
    const tab = OLD_TABS[params.get('tab')] || params.get('tab');
    if (tab && VALID_TABS.includes(tab)) state.tab = tab;

    const fromUrl = findPlayer(params.get('joueur'));
    if (fromUrl) {
        const rival = findPlayer(params.get('vs'));
        if (rival && rival.id !== fromUrl.id) state.opponent = rival;
        return fromUrl;
    }
    return null; // sans joueur dans l'adresse : on commence par la liste des joueurs
}

// ---------- liste des joueurs (cards) et sélection pour le comparatif ----------
const compareSel = []; // ids des joueurs sélectionnés pour le comparatif (2 au maximum)
const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.25"/><path d="m8.5 12.2 2.4 2.4 4.6-4.9"/></svg>';

function renderPlayerCards() {
    $('players-grid').innerHTML = state.players.map(p => `
        <article class="player-card" data-id="${esc(p.id)}">
            <button type="button" class="player-card-open" aria-label="Voir les pronos de ${esc(p.pseudo)}">
                <span class="player-card-photo">${renderAvatarHtml(p.avatar, p.pseudo)}</span>
            </button>
            <span class="player-card-check" aria-hidden="true">${CHECK_ICON}</span>
            <span class="player-card-name">${esc(p.pseudo)}</span>
            <button type="button" class="player-card-compare" aria-pressed="false">Comparer</button>
        </article>`).join('');
    refreshCompareSelection();
}

function refreshCompareSelection() {
    document.querySelectorAll('.player-card').forEach(card => {
        const on = compareSel.includes(card.dataset.id);
        card.classList.toggle('is-selected', on);
        const btn = card.querySelector('.player-card-compare');
        btn.setAttribute('aria-pressed', String(on));
        btn.textContent = on ? 'Retirer' : 'Comparer';
    });
    // Dès qu'un 1er joueur est choisi, toute la card sert à sélectionner (plus besoin de « Comparer »)
    $('players-grid').classList.toggle('is-comparing', compareSel.length > 0);
    const go = $('compare-go');
    go.disabled = compareSel.length < 2;
    const names = compareSel.map(id => findPlayer(id).pseudo);
    const text = compareSel.length === 0 ? ''
        : compareSel.length === 1 ? `${esc(names[0])} sélectionné : clique sur un 2e joueur.`
        : `${esc(names[0])} vs ${esc(names[1])}`;
    $('players-hint').innerHTML = text && `${text} <button type="button" class="players-cancel">Annuler</button>`;
}

function toggleCompare(id) {
    const i = compareSel.indexOf(id);
    if (i >= 0) compareSel.splice(i, 1);
    else {
        if (compareSel.length === 2) compareSel.pop(); // un 3e choix remplace le 2e joueur (le 1er reste)
        compareSel.push(id);
    }
    refreshCompareSelection();
}

function showView(view) {
    $('players-view').hidden = view !== 'list';
    $('pronos-detail').hidden = view !== 'detail';
    document.body.classList.toggle('pronos-detail-open', view === 'detail');
    if (view === 'list') {
        state.current = null;
        state.opponent = null;
        try {
            const url = new URL(window.location.href);
            ['joueur', 'vs', 'tab'].forEach(k => url.searchParams.delete(k));
            window.history.replaceState(null, '', url);
        } catch (e) { /* page ouverte en local : on ignore */ }
    }
    window.scrollTo({ top: 0 });
}

function bindEvents() {
    $('players-grid').addEventListener('click', event => {
        const card = event.target.closest('.player-card');
        if (!card) return;
        // Bouton « Comparer », ou n'importe où sur la card quand une comparaison est commencée
        if (event.target.closest('.player-card-compare') || compareSel.length > 0) { toggleCompare(card.dataset.id); return; }
        const player = findPlayer(card.dataset.id);
        if (player) { state.opponent = null; state.tab = 'resume'; $('player-select').value = player.id; showPlayer(player); }
    });
    $('players-hint').addEventListener('click', event => {
        if (!event.target.closest('.players-cancel')) return;
        compareSel.length = 0;
        refreshCompareSelection();
    });
    $('compare-go').addEventListener('click', () => {
        if (compareSel.length < 2) return;
        const [a, b] = compareSel.map(findPlayer);
        $('player-select').value = a.id;
        state.opponent = b;
        state.tab = 'resume';
        showPlayer(a);
    });
    $('pronos-back').addEventListener('click', () => {
        compareSel.length = 0;
        refreshCompareSelection();
        showView('list');
    });

    $('player-select').addEventListener('change', event => {
        const player = findPlayer(event.target.value);
        if (player) showPlayer(player); else clearPlayer();
    });

    ['compare-select', 'rival-select'].forEach(id => $(id).addEventListener('change', event => {
        if (state.current) setOpponent(findPlayer(event.target.value));
    }));

    document.querySelector('.tabs').addEventListener('click', event => {
        const button = event.target.closest('.tab-btn');
        if (button) setTab(button.dataset.tab);
    });

    $('score-pills').addEventListener('click', event => {
        const pill = event.target.closest('.score-pill');
        if (!pill) return;
        setTab(pill.dataset.tab);
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
        const card = $('pronos-wrap');
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
        loadStreaks();
        loadRoster();

        renderPlayerCards();
        const start = findInitialPlayer();
        if (start) {
            select.value = start.id;
            showPlayer(start);
        } else {
            clearPlayer();
            showView('list');
        }
    } catch (error) {
        console.error('Erreur de chargement des pronostics :', error);
        select.innerHTML = '<option value="">Erreur</option>';
        showMessage('Impossible de charger les pronostics.', error.message);
    }
}

// Avant la saison : fausse popin affichée tout de suite (script chargé en bas de page)
(() => {
    const card = document.getElementById('pronos-wrap');
    if (card && RevealLock.shouldLockNow('pronos')) RevealLock.show(card, REVEAL_TEXTS.pronostics);
})();

document.addEventListener('DOMContentLoaded', initPronostics);
