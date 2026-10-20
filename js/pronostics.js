// ==========================================
// PAGE PRONOSTICS (pronostics.html)
// Dépend de : config.js, common.js, api.js, teams.js, scoring.js
// Deux modes : fiche d'un joueur, ou duel entre deux joueurs.
// ==========================================

// CATEGORY_LABELS, STAT_KEYS, AWARD_KEYS sont définis dans common.js (partagés avec standings.js)

const VALID_TABS = ['resume', 'est', 'ouest', 'stats', 'evolution'];
const OLD_TABS = { classements: 'est' }; // anciens liens partagés
const STORAGE_KEY = 'airball:lastPlayer';

const state = {
    data: null, players: [], current: null, opponent: null,
    tab: 'resume', sort: null, streaks: {}, records: {}, lastTen: {}, evoObserver: null, evolutionToken: 0
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

// ---------- tri des tableaux Est / Ouest (clic sur Rk, Streak, Prono, Écart, Pts) ----------
// state.sort = { col, dir } ; col = 'rank' | 'streak' | 'prono-a' | 'gap-a' | 'pts-a' | (duel) '…-b'.
// 1er clic : le tri le plus parlant, 2e : l'inverse, 3e : retour au classement réel.
// Les lignes playoffs / play-in restent à leur place (après la 6e et la 10e ligne).
const SORT_FIRST_DIR = { rank: 1, streak: -1, prono: 1, gap: 1, pts: -1 }; // 1 = croissant
const streakValue = key => {
    const m = /^([WL])\s*(\d+)$/i.exec(String(state.streaks[key] || '').trim());
    return m ? (m[1].toUpperCase() === 'W' ? 1 : -1) * Number(m[2]) : null;
};
function sortValue(col, row) {
    const [kind, who] = col.split('-');
    const side = row[who || 'a'] || row; // fiche solo : la ligne porte directement prono / écart / points
    const team = Teams.find(row.team);
    if (kind === 'rank') return row.real;
    if (kind === 'streak') return streakValue(team ? team.key : row.team);
    if (kind === 'prono') return side.predicted;
    if (kind === 'gap') return side.gap;
    if (kind === 'pts') return side.pts;
    return null;
}
function sortRows(rows, known) {
    const base = (x, y) => known ? (x.real || 99) - (y.real || 99) : (x.predicted || (x.a && x.a.predicted) || 0) - (y.predicted || (y.a && y.a.predicted) || 0);
    const sort = state.sort;
    return [...rows].sort((x, y) => {
        if (sort) {
            const vx = sortValue(sort.col, x), vy = sortValue(sort.col, y);
            if (vx === null && vy !== null) return 1;   // valeurs inconnues toujours en bas
            if (vy === null && vx !== null) return -1;
            if (vx !== null && vy !== null && vx !== vy) return (vx - vy) * sort.dir;
        }
        return base(x, y); // à égalité : ordre du classement réel
    });
}
const CHEVRON = '<svg class="pt-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
// En-tête triable : bouton + chevron (vers le bas = décroissant, vers le haut = croissant)
function sortTh(col, label, cls = '', title = '') {
    const sort = state.sort || { col: 'rank', dir: 1 };
    const active = sort.col === col;
    const aria = active ? ` aria-sort="${sort.dir > 0 ? 'ascending' : 'descending'}"` : '';
    const state_ = active ? (sort.dir > 0 ? ' is-asc' : ' is-desc') : '';
    return `<th class="${cls} is-sortable${state_}"${aria}${title ? ` title="${title}"` : ''}><button type="button" class="pt-sort" data-sort="${col}">${label}${CHEVRON}</button></th>`;
}
function onSortClick(event) {
    const button = event.target.closest('.pt-sort');
    if (!button) return;
    const col = button.dataset.sort;
    const first = SORT_FIRST_DIR[col.split('-')[0]];
    const cur = state.sort;
    if (col === 'rank') state.sort = cur && cur.col === 'rank' ? (cur.dir === 1 ? { col, dir: -1 } : null) : null;
    else if (!cur || cur.col !== col) state.sort = { col, dir: first };
    else if (cur.dir === first) state.sort = { col, dir: -first };
    else state.sort = null; // 3e clic : retour au classement réel
    if (state.sort && state.sort.col === 'rank' && state.sort.dir === 1) state.sort = null;
    renderConferences();
    // Garde le focus sur l'en-tête cliqué (clavier)
    const again = event.currentTarget.querySelector(`.pt-sort[data-sort="${col}"]`);
    if (again) again.focus({ preventScroll: true });
}

// Fiche d'un joueur, façon tableaux ESPN : lignes fines, chiffres alignés à droite,
// deux groupes de colonnes titrés (Saison NBA | Mon prono), séparations playoffs / play-in en trait
function soloConferenceTable(title, rows) {
    const known = rows.some(r => r.real !== null);
    const sorted = sortRows(rows, known);
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
                    ${sortTh('rank', 'Rk', 'pt-rank')}
                    <th class="pt-team">Équipe</th>
                    <th class="pt-num">Bilan</th>
                    <th class="pt-num pt-l10" title="Bilan des 10 derniers matchs">L10</th>
                    ${sortTh('streak', 'Streak', 'pt-num')}
                    ${sortTh('prono-a', 'Prono', 'pt-num pt-sep')}
                    ${sortTh('gap-a', 'Écart', 'pt-num')}
                    ${sortTh('pts-a', 'Pts', 'pt-num')}
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

// Duel Est / Ouest, même style que la fiche d'un joueur :
// Rk | Équipe | Bilan | L10 | Streak ‖ Prono · Écart · Pts (joueur A) ‖ Prono · Écart · Pts (joueur B)
function duelConferenceTable(conf, a, b) {
    const realList = state.data.real[conf];
    const rowsA = Scoring.conferenceRows(a[conf], realList);
    const byTeamB = {};
    Scoring.conferenceRows(b[conf], realList).forEach(r => { byTeamB[r.team] = r; });
    const rows = rowsA.filter(r => byTeamB[r.team]).map(r => ({ team: r.team, real: r.real, a: r, b: byTeamB[r.team] }));
    const known = rows.some(r => r.real !== null);
    const sortedRows = sortRows(rows, known);

    const pill = r => r.pts === null ? '—' : r.pts > 0 ? `<span class="pt-pill">${fmt(r.pts)}</span>` : fmt(r.pts);
    const side = (r, same) => {
        const cls = gapClass(r.gap);
        return `<td class="pt-num pt-prono pt-sep">${same ? `<span class="pt-same">${r.predicted}</span>` : r.predicted}</td>
            <td class="pt-num pt-ecart ${cls}">${gapCell(r)}</td>
            <td class="pt-num pt-pts pt-pts--duel ${cls}">${pill(r)}</td>`;
    };
    const body = sortedRows.map((r, i) => {
        const team = Teams.find(r.team);
        const key = team ? team.key : r.team;
        const cut = known && i === 5 ? 'cut-playoffs' : known && i === 9 ? 'cut-playin' : '';
        // Même prono pour les deux joueurs : ligne grisée + les deux pronos encadrés
        const same = r.a.predicted === r.b.predicted;
        return `<tr class="${[cut, same ? 'is-same' : ''].filter(Boolean).join(' ')}"${same ? ' title="Même prono pour les deux joueurs"' : ''}>
            <td class="pt-rank">${r.real === null ? '—' : r.real}</td>
            <td class="pt-team"><span class="team-inline">${teamLogo(r.team)}<span class="team-name"><span class="name-full">${esc(team ? team.name : r.team)}</span><span class="name-short">${esc(teamShortName(r.team))}</span></span></span></td>
            <td class="pt-num pt-nba">${esc(state.records[key] || '—')}</td>
            <td class="pt-num pt-nba pt-l10">${esc(state.lastTen[key] || '—')}</td>
            <td class="pt-num pt-nba">${esc(state.streaks[key] || '—')}</td>
            ${side(r.a, same)}${side(r.b, same)}
        </tr>`;
    }).join('');

    const same = rows.filter(r => r.a.predicted === r.b.predicted).length;
    const key = conf === 'east' ? 'est' : 'ouest';
    const label = conf === 'east' ? 'EST' : 'OUEST';
    const groupHead = (p, who) => `<th colspan="3" class="pt-who pt-who--${who} pt-sep">${esc(p.pseudo)}</th>`;
    const labels = who => sortTh(`prono-${who}`, 'Prono', 'pt-num pt-sep') + sortTh(`gap-${who}`, 'Écart', 'pt-num') + sortTh(`pts-${who}`, 'Pts', 'pt-num pt-pts--duel');
    return `<div class="pt-duel-banner">${duelScoreBanner(a, b, a.scores[key] || 0, b.scores[key] || 0,
            `${same} prono${same > 1 ? 's' : ''} identique${same > 1 ? 's' : ''} sur ${rows.length}`)}</div>
        <h3 class="pt-title">Conférence <span>${label}</span></h3>
        <div class="table-responsive"><table class="pt-table pt-table--duel" aria-label="Conférence ${label}">
            <thead>
                <tr class="pt-names">
                    <th colspan="2"></th><th colspan="3" class="pt-nba"></th>
                    ${groupHead(a, 'a')}${groupHead(b, 'b')}
                </tr>
                <tr class="pt-labels">
                    ${sortTh('rank', 'Rk', 'pt-rank')}
                    <th class="pt-team">Équipe</th>
                    <th class="pt-num pt-nba">Bilan</th>
                    <th class="pt-num pt-nba pt-l10" title="Bilan des 10 derniers matchs">L10</th>
                    ${sortTh('streak', 'Streak', 'pt-num pt-nba')}
                    ${labels('a')}${labels('b')}
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table></div>
        <ul class="pt-legend">
            <li><span class="pt-key pt-key--playoffs"></span>Qualifiées pour les playoffs (1 à 6)</li>
            <li><span class="pt-key pt-key--playin"></span>Play-in (7 à 10)</li>
            <li><span class="pt-sym is-up">▲</span>Équipe mieux classée que le prono</li>
            <li><span class="pt-sym is-down">▼</span>Équipe moins bien classée que le prono</li>
            <li><span class="pt-sym is-hit">✓</span>Rang exact</li>
        </ul>`;
}

function renderConferences() {
    const real = state.data.real;
    const a = state.current;
    if (!isDuel() && state.sort && /-b$/.test(state.sort.col)) state.sort = null; // tri sur le 2e joueur : plus de duel
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
// Maillots vus de face : nom de la franchise sur la poitrine (false = numéro seul)
let SA_TEAM_WORD = true;

// Joueurs et coachs (players.json, coaches.json) : équipe de chaque pick. Chargés une fois, en arrière-plan.
async function loadRoster() {
    try {
        const [players, coaches] = await Promise.all(['players.json', 'coaches.json'].map(f => fetch(f).then(r => r.ok ? r.json() : [])));
        const roster = {};
        players.forEach(p => { roster[normName(p.name)] = { team: p.team, num: p.num || '' }; });
        coaches.forEach(c => { roster[normName(c.name)] = { team: c.team, coach: true }; });
        state.roster = roster;
        if (state.current) { renderStats(); renderResume(); }
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
        const sub = name && team ? team.name : '';
        const badge = row.hits[i] ? `<span class="sa-badge sa-badge--${i + 1}">${PICK_BADGE[i]}</span>` : '';
        return `<div class="sa-pick${row.hits[i] ? ' is-hit' : ''}">
            <span class="sa-pick-label">Pick ${i + 1}</span>
            <span class="sa-jersey">${info.coach ? Jersey.coach(info.team || '', { className: 'sa-jersey-svg', word: SA_TEAM_WORD }) : Jersey.svg(info.team || '', { className: 'sa-jersey-svg', number: info.num || '', word: SA_TEAM_WORD })}${badge}</span>
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
// Couleurs des courbes : 1er joueur en violet (seul ou en duel), 2e joueur en corail, comme dans les comparatifs
const evoColorA = () => '#a99bff'; // 1er joueur : violet (seul ou en duel)
const EVO_COLORS = { b: '#f45d4f', rival: '#6b6b73', rest: '#4a4a52', grid: '#3a3a42', ink: '#8e8d91' };

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
            ${path(w => w.a && w.a.points, evoColorA(), 2.5)}

            <text x="${xAt(0)}" y="${H - 8}" class="evo-tick" text-anchor="${n === 1 ? 'middle' : 'start'}">${shortDay(weeks[0].date)}</text>
            ${n > 1 ? `<text x="${xAt(n - 1)}" y="${H - 8}" class="evo-tick" text-anchor="end">${shortDay(weeks[n - 1].date)}</text>` : ''}

            <g class="evo-cursor">
                <line class="evo-cursor-line" y1="${top.y0 - 6}" y2="${top.y1}" stroke="#c0bec3" stroke-width="1"/>
                <circle class="evo-dot-b" r="4.5" fill="${b ? EVO_COLORS.b : EVO_COLORS.rival}"/>
                <circle class="evo-dot-a" r="7" fill="#17171b" stroke="${evoColorA()}" stroke-width="2.5"/>
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

        const lineA = w.a ? `<b style="color:${evoColorA()}">${esc(a.pseudo)} : ${fmt(w.a.points)} pts · ${ordinal(w.a.rank)}</b>` : '';
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
            <span><i style="background:${evoColorA()}"></i>${esc(a.pseudo)}</span>
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
    ['rival-select'].forEach(id => {
        const select = $(id);
        select.innerHTML = '<option value="">Personne (fin du duel)</option>' +
            others.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}</option>`).join('');
        select.value = state.opponent ? state.opponent.id : '';
        select.disabled = !state.current;
    });
}

function renderAll() {
    const duel = isDuel();
    // Duel : 2e menu « vs » dans la barre du haut
    $('rival-picker').hidden = !duel;
    $('compare-add').hidden = duel;
    $('picker-vs').hidden = !duel;
    if (duel) {
        $('rival-avatar').innerHTML = renderAvatarHtml(state.opponent.avatar, state.opponent.pseudo);
        $('rival-name').textContent = state.opponent.pseudo;
    }
    $('rival-select').value = duel ? state.opponent.id : '';

    renderResume();
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
            <span class="player-card-name">${esc(p.pseudo)}${p.prenom ? `<small class="player-prenom">${esc(p.prenom)}</small>` : ''}</span>
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
    const names = compareSel.map(id => findPlayer(id).pseudo);
    const text = compareSel.length === 0 ? ''
        : compareSel.length === 1 ? `${esc(names[0])} sélectionné : clique sur un 2e joueur.`
        : `${esc(names[0])} vs ${esc(names[1])}`;
    $('players-hint').innerHTML = text && `${text} <button type="button" class="players-cancel">Annuler</button>`;
}

let compareTimer = null;
function toggleCompare(id) {
    if (compareTimer) return; // comparatif en train de s'ouvrir
    const i = compareSel.indexOf(id);
    if (i >= 0) compareSel.splice(i, 1);
    else compareSel.push(id);
    refreshCompareSelection();
    // 2e joueur choisi : on laisse voir les deux cards allumées un instant, puis on ouvre le comparatif
    if (compareSel.length === 2) {
        compareTimer = setTimeout(() => { compareTimer = null; openCompare(); }, 300);
    }
}

function openCompare() {
    if (compareSel.length < 2) return;
    const [a, b] = compareSel.map(findPlayer);
    if (!a || !b) return;
    $('player-select').value = a.id;
    state.opponent = b;
    state.tab = 'resume';
    showPlayer(a);
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

// ---------- panneau latéral « Comparer » ----------
const foldText = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function renderRivalResults() {
    const q = foldText($('rival-search').value.trim());
    const anyPoints = state.players.some(p => (p.scores.total || 0) > 0);
    const list = state.players
        .filter(p => state.current && p.id !== state.current.id)
        .filter(p => !q || foldText(p.pseudo).includes(q) || foldText(p.prenom || '').includes(q))
        .sort((a, b) => (b.scores.total || 0) - (a.scores.total || 0) || a.pseudo.localeCompare(b.pseudo, 'fr'));
    $('rival-results-count').textContent = `${list.length} résultat${list.length > 1 ? 's' : ''}`;
    $('rival-results').innerHTML = list.length ? list.map(p => `
        <button type="button" class="pick-result rival-result${state.opponent && state.opponent.id === p.id ? ' is-current' : ''}" role="option" data-id="${esc(p.id)}">
            <span class="rival-avatar">${renderAvatarHtml(p.avatar, p.pseudo)}</span>
            <span class="pick-result-text">
                <span class="pick-result-name">${esc(p.pseudo)}${p.prenom ? `<small class="player-prenom">${esc(p.prenom)}</small>` : ''}</span>
                <span class="pick-result-meta">${anyPoints ? `${ordinal(Scoring.rankOf(state.players, p, 'total'))} · ` : ''}${fmt(p.scores.total)} pts</span>
            </span>
        </button>`).join('')
        : '<p class="pick-results-empty">Aucun joueur ne correspond à ta recherche.</p>';
}

function openRivalPanel() {
    if (!state.current) return;
    const panel = $('rival-panel');
    $('rival-panel-hint').textContent = `Compare les pronos de ${state.current.pseudo} avec ceux d'un autre joueur.`;
    $('rival-search').value = '';
    renderRivalResults();
    panel.classList.remove('is-closing');
    panel.showModal();
    if (window.matchMedia('(hover: hover)').matches) $('rival-search').focus();
}

function closeRivalPanel() {
    const panel = $('rival-panel');
    if (!panel.open || panel.classList.contains('is-closing')) return;
    panel.classList.add('is-closing');
    setTimeout(() => { panel.classList.remove('is-closing'); panel.close(); }, 180);
}

function bindRivalPanel() {
    const panel = $('rival-panel');
    $('compare-add').addEventListener('click', openRivalPanel);
    $('rival-panel-close').addEventListener('click', closeRivalPanel);
    $('rival-search').addEventListener('input', renderRivalResults);
    panel.addEventListener('cancel', event => { event.preventDefault(); closeRivalPanel(); });
    panel.addEventListener('click', event => { if (event.target === panel) closeRivalPanel(); }); // clic sur le fond
    $('rival-results').addEventListener('click', event => {
        const row = event.target.closest('.rival-result');
        if (!row) return;
        const rival = findPlayer(row.dataset.id);
        closeRivalPanel();
        if (rival) setOpponent(rival);
    });
}

// ---------- menus « joueur » de la barre du haut : mini-classement ----------
const PLUS_ICON = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round"><path d="M3.33 2A1.33 1.33 0 0 0 2 3.33M12.67 2A1.33 1.33 0 0 1 14 3.33M14 12.67A1.33 1.33 0 0 1 12.67 14M3.33 14A1.33 1.33 0 0 1 2 12.67M6 2h.67M6 14h.67M9.33 2H10M9.33 14H10M2 6v.67M14 6v.67M2 9.33V10M14 9.33V10M5.33 8h5.34M8 5.33v5.34"/></svg>';
const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6L18 18"/></svg>';

function renderPickerPop(wrap) {
    const rival = wrap.dataset.picker === 'rival';
    const selectedId = rival ? (state.opponent && state.opponent.id) : (state.current && state.current.id);
    const anyPoints = state.players.some(p => (p.scores.total || 0) > 0);
    const list = state.players
        .filter(p => !rival || !state.current || p.id !== state.current.id)
        .sort((a, b) => (b.scores.total || 0) - (a.scores.total || 0) || a.pseudo.localeCompare(b.pseudo, 'fr'));
    const rows = list.map(p => `
        <button type="button" class="picker-row${p.id === selectedId ? ' is-selected' : ''}" role="option" aria-selected="${p.id === selectedId}" data-id="${esc(p.id)}">
            <span class="picker-rank">${anyPoints ? Scoring.rankOf(state.players, p, 'total') : '–'}</span>
            <span class="picker-avatar">${renderAvatarHtml(p.avatar, p.pseudo)}</span>
            <span class="picker-name">${esc(p.pseudo)}${p.prenom ? `<small class="player-prenom">${esc(p.prenom)}</small>` : ''}</span>
            <span class="picker-pts">${fmt(p.scores.total)} pts</span>
        </button>`).join('');
    const foot = rival || isDuel()
        ? `<button type="button" class="picker-foot" data-action="end-duel">${CLOSE_ICON}Retirer le comparatif</button>`
        : `<button type="button" class="picker-foot" data-action="compare">${PLUS_ICON}Comparer avec un autre joueur</button>`;
    wrap.querySelector('.picker-pop').innerHTML = `<p class="picker-label">Classement général</p><div class="picker-list">${rows}</div>${foot}`;
}

function closePickers(except) {
    document.querySelectorAll('.picker-wrap').forEach(wrap => {
        if (wrap === except) return;
        wrap.querySelector('.picker-pop').hidden = true;
        wrap.querySelector('.player-picker').setAttribute('aria-expanded', 'false');
    });
}

function togglePicker(wrap) {
    const pop = wrap.querySelector('.picker-pop');
    const open = pop.hidden;
    closePickers(wrap);
    if (!open) { pop.hidden = true; wrap.querySelector('.player-picker').setAttribute('aria-expanded', 'false'); return; }
    renderPickerPop(wrap);
    pop.hidden = false;
    wrap.querySelector('.player-picker').setAttribute('aria-expanded', 'true');
    const current = pop.querySelector('.picker-row.is-selected') || pop.querySelector('.picker-row');
    if (current) { current.scrollIntoView({ block: 'nearest' }); current.focus({ preventScroll: true }); }
}

// ---------- onglet Résumé : bandeau, cartes, évolution, meilleur coup ----------
const RS_CATS = [
    { key: 'est', title: 'EST', tab: 'est' },
    { key: 'ouest', title: 'OUEST', tab: 'ouest' },
    { key: 'stats', title: 'STATS', tab: 'stats' },
    { key: 'awards', title: 'AWARDS', tab: 'stats' }
];
const COLOR_A = '#a99bff', COLOR_B = '#f45d4f';
state.champions = null;   // { pseudo normalisé : [saisons] } (Hall of Fame)
state.history = null;     // relevés hebdomadaires (Évolution)

const anyPointsIn = key => state.players.some(p => (p.scores[key] || 0) > 0);
const rankOfKey = (p, key) => anyPointsIn(key) ? Scoring.rankOf(state.players, p, key) : null;

// Rangs exacts sur les 30 équipes
function exactCount(p) {
    const real = state.data.real;
    const rows = Scoring.conferenceRows(p.east, real.east).concat(Scoring.conferenceRows(p.west, real.west));
    return { hits: rows.filter(r => r.gap === 0).length, known: rows.some(r => r.real !== null), total: rows.length };
}

// Écart utile : au leader, ou d'avance sur le 2e quand on est en tête
function gapText(p) {
    if (!anyPointsIn('total')) return '';
    const sorted = [...state.players].sort((x, y) => (y.scores.total || 0) - (x.scores.total || 0));
    const leader = sorted[0];
    const me = p.scores.total || 0;
    if (leader.id === p.id || (leader.scores.total || 0) === me) {
        const second = sorted.find(x => x.id !== p.id && (x.scores.total || 0) < me);
        return second ? `${fmt(me - second.scores.total)} pt${me - second.scores.total > 1 ? 's' : ''} d'avance sur le 2e` : 'En tête';
    }
    const gap = (leader.scores.total || 0) - me;
    return `À ${fmt(gap)} pt${gap > 1 ? 's' : ''} du leader`;
}

// Tendance de la semaine (rang au dernier relevé comparé à aujourd'hui)
function weekTrend(p) {
    if (!state.history) return null;
    const snaps = evolutionSnapshots(state.history).filter(s => s.players[p.id]);
    const last = snaps[snaps.length - 1];
    const now = rankOfKey(p, 'total');
    if (!last || !now || !last.players[p.id].rank) return null;
    return last.players[p.id].rank - now;   // > 0 : gagne des places
}
const trendBadge = d => d === null || d === undefined ? ''
    : d > 0 ? `<span class="rs-trend is-up">▲ ${d}</span>` : d < 0 ? `<span class="rs-trend is-down">▼ ${-d}</span>` : '<span class="rs-trend is-eq">=</span>';

// Étiquettes de la card joueur : évolution de la semaine (à côté du nom), écart au leader (dessous)
const trendTag = d => d === null || d === undefined ? ''
    : d > 0 ? `<span class="rs-tag is-up">▲ ${d} place${d > 1 ? 's' : ''} cette semaine</span>`
    : d < 0 ? `<span class="rs-tag is-down">▼ ${-d} place${-d > 1 ? 's' : ''} cette semaine</span>`
    : '<span class="rs-tag">= Stable cette semaine</span>';

function championBadge(p) {
    const seasons = state.champions && state.champions[normName(p.pseudo)];
    if (!seasons || !seasons.length) return '';
    const s = seasons[0];
    return `<span class="rs-champ"${s.maillot ? ` title="Maillot remporté : ${esc(s.maillot)}"` : ''}>🏆 Champion ${esc(s.label)}</span>`;
}

// Meilleur coup : un Pick 1 qui mène sa catégorie (le plus prestigieux), sinon le rang exact le mieux classé
function bestMove(p) {
    const real = state.data.real;
    let best = null;
    [['stats', STAT_KEYS], ['awards', AWARD_KEYS]].forEach(([src, keys]) => keys.forEach(key => {
        const realFirst = ((real[src] || {})[key] || [])[0];
        const row = Scoring.pickRow((p[src] || {})[key], realFirst);
        const i = row.hits.indexOf(true);
        if (i < 0) return;
        const pts = [2, 1, 0.5][i];
        if (!best || pts > best.pts) best = { kind: 'pick', name: row.picks[i], cat: CATEGORY_LABELS[key], pick: i + 1, pts };
    }));
    if (best && best.pts === 2) return best;
    const exact = Scoring.conferenceRows(p.east, real.east).concat(Scoring.conferenceRows(p.west, real.west))
        .filter(r => r.gap === 0).sort((x, y) => x.real - y.real)[0];
    if (exact) return { kind: 'team', team: exact.team, rank: exact.real, pts: 2 };
    return best;
}

function bestMoveHtml(p) {
    const m = bestMove(p);
    if (!m) return '<p class="rs-empty">Pas encore de coup gagnant : réponse au premier classement.</p>';
    if (m.kind === 'team') {
        const t = Teams.find(m.team);
        return `<div class="rs-best">${Jersey.svg(m.team, { className: 'rs-best-jersey' })}
            <div><b>${esc(t ? t.name.split(' ').pop() : m.team)} ${ordinal(m.rank)}</b>
            <span>Pronostiqués ${ordinal(m.rank)}, ils sont ${ordinal(m.rank)}.</span>
            <span class="pt-pill rs-pill">+${fmt(m.pts)} pts</span></div></div>`;
    }
    const info = (state.roster || {})[normName(m.name)] || {};
    const jersey = info.coach ? Jersey.coach(info.team || '', { className: 'rs-best-jersey' }) : Jersey.svg(info.team || '', { className: 'rs-best-jersey', number: info.num || '' });
    return `<div class="rs-best">${jersey}
        <div><b>${esc(m.name)}</b>
        <span>Pick ${m.pick} · ${esc(m.cat)} : il mène la catégorie.</span>
        <span class="pt-pill rs-pill${m.pts < 2 ? ' is-close' : ''}">+${fmt(m.pts)} pt${m.pts > 1 ? 's' : ''}</span></div></div>`;
}

// Illustrations des cartes (mêmes dessins que la maquette), partie « allumée » propre au joueur
// Radar purement décoratif : la même forme pour tout le monde, simplement « allumée » en violet
function radarProfile(color = COLOR_A, fill = 'rgba(169,155,255,.14)') {
    const vals = [0.9, 0.55, 0.75, 0.45, 0.65];
    const cx = 240, cy = 190, R = 140;
    const d = vals.map((v, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return `${(cx + R * v * Math.cos(a)).toFixed(1)} ${(cy + R * v * Math.sin(a)).toFixed(1)}`; }).join(' L');
    return `<path d="M${d}Z" fill="${fill}" stroke="${color}" stroke-width="2.5"/>`;
}
function catIllustration(key, profiles) {
    const art = { est: 'carte-usa-simple.svg', ouest: 'carte-usa-simple.svg', stats: 'radar.svg', awards: 'laurier.svg' }[key];
    const img = extra => `<img class="rs-ill rs-ill--${key}${extra ? ' ' + extra : ''}" src="img/illustrations/${art}" alt="" aria-hidden="true">`;
    if (key === 'est' || key === 'ouest' || key === 'awards') return img() + img('is-lit');
    return img() + `<svg class="rs-ill rs-ill--stats" viewBox="0 0 480 360" aria-hidden="true">${profiles}</svg>`;
}

function soloCard(c, p) {
    const rank = rankOfKey(p, c.key);
    return `<button type="button" class="rs-card" data-goto="${c.tab}" aria-label="${c.title} : voir le détail">
        ${catIllustration(c.key, radarProfile())}
        <span class="rs-card-title">${c.title}</span>
        <span class="rs-card-v"><span class="rs-rank">${rank ? ordinal(rank) : '—'}</span><b>${fmt(p.scores[c.key])} pts</b></span>
    </button>`;
}

function duelCard(c, a, b) {
    const pa = a.scores[c.key] || 0, pb = b.scores[c.key] || 0;
    const ra = rankOfKey(a, c.key), rb = rankOfKey(b, c.key);
    const side = (rank, pts, cls, dim) => `<span class="rs-side ${cls}${dim ? ' is-behind' : ''}"><span class="rs-rank">${rank ? ordinal(rank) : '—'}</span><b>${fmt(pts)} pts</b></span>`;
    return `<button type="button" class="rs-card rs-card--duel" data-goto="${c.tab}" aria-label="${c.title} : voir le détail">
        ${catIllustration(c.key, radarProfile())}
        <span class="rs-card-title">${c.title}</span>
        <span class="rs-card-duel">${side(ra, pa, 'is-a', pa < pb)}<span class="rs-vs">vs</span>${side(rb, pb, 'is-b', pb < pa)}</span>
    </button>`;
}

// Mini-courbe du rang sur les derniers relevés
function sparkline(series) {
    const w = 560, h = 96;
    const all = series.flatMap(s => s.ranks.filter(Boolean));
    if (!all.length) return '<p class="rs-empty">La courbe apparaîtra après le premier relevé hebdomadaire.</p>';
    const n = Math.max(...series.map(s => s.ranks.length));
    const maxR = Math.max(10, ...all);
    const y = r => 12 + (r - 1) / (maxR - 1) * (h - 28);
    const x = i => 24 + (n > 1 ? i * (w - 40) / (n - 1) : (w - 40) / 2);
    const ticks = [1, Math.round((maxR + 1) / 2), maxR].map(r => `<text x="0" y="${y(r) + 4}" class="rs-tick">${r}</text>`).join('');
    const lines = series.map((s, si) => {
        const pts = s.ranks.map((r, i) => r ? [x(i), y(r)] : null).filter(Boolean);
        if (!pts.length) return '';
        const last = pts[pts.length - 1];
        const lastRank = s.ranks.filter(Boolean).pop();
        return `<path d="M${pts.map(q => q.join(' ')).join('L')}" stroke="${s.color}" stroke-width="2" fill="none"/>
            ${pts.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="${i === pts.length - 1 ? 5 : 3}" fill="${i === pts.length - 1 ? s.color : '#1e1e23'}" stroke="${s.color}" stroke-width="1.5"/>`).join('')}
            <text x="${last[0] - 10}" y="${last[1] + (si ? 18 : -9)}" text-anchor="end" fill="${s.color}" class="rs-last">${ordinal(lastRank)}</text>`;
    }).join('');
    return `<svg class="rs-spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Évolution du classement"><path d="M24 ${h - 12}H${w - 16}" stroke="#2c2c31"/>${ticks}${lines}</svg>`;
}
function rankSeries(p) {
    if (!state.history) return [];
    const snaps = evolutionSnapshots(state.history).slice(-6);
    const ranks = snaps.map(s => (s.players[p.id] || {}).rank || null);
    const now = rankOfKey(p, 'total');
    if (now) ranks.push(now);
    return ranks.slice(-6);
}

const LINK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';

function renderResume() {
    const a = state.current;
    if (!a) return;
    const panel = $('resume-panel');
    const evoBox = series => `<div class="rs-box">
        <div class="rs-box-h"><span class="rs-box-t">Évolution du classement</span><button type="button" class="rs-link" data-goto="evolution">Voir l'évolution</button></div>
        ${sparkline(series)}</div>`;

    if (!isDuel()) {
        const rank = rankOfKey(a, 'total');
        const ex = exactCount(a);
        panel.innerHTML = `
        <div class="rs-box rs-head">
            <span class="rs-avatar">${renderAvatarHtml(a.avatar, a.pseudo)}</span>
            <div class="rs-id">
                <div class="rs-name"><h2>${esc(a.pseudo)}</h2>${trendBadge(weekTrend(a))}</div>
                ${a.prenom ? `<span class="rs-prenom">${esc(a.prenom)}</span>` : ''}
                <div class="rs-meta">${gapText(a) ? `<span class="rs-tag">${esc(gapText(a))}</span>` : ''}${championBadge(a)}</div>
            </div>
            <div class="rs-stats">
                <div class="rs-stat is-lime"><b>${rank ? ordinal(rank) : '—'}</b><span>Classement</span></div>
                <div class="rs-stat"><b>${fmt(a.scores.total)}</b><span>Points</span></div>
                <div class="rs-stat"><b>${ex.known ? `${ex.hits}/${ex.total}` : '—'}</b><span>Rangs exacts</span></div>
            </div>
        </div>
        <div class="rs-cards">${RS_CATS.map(c => soloCard(c, a)).join('')}</div>
        <div class="rs-duo">
            ${evoBox([{ ranks: rankSeries(a), color: COLOR_A }])}
            <div class="rs-box"><div class="rs-box-h"><span class="rs-box-t">Meilleur coup</span></div>${bestMoveHtml(a)}</div>
        </div>`;
        return;
    }

    const b = state.opponent;
    const ta = a.scores.total || 0, tb = b.scores.total || 0;
    const share = ta + tb > 0 ? Math.round(ta / (ta + tb) * 100) : 50;
    const gap = Math.abs(ta - tb);
    const lead = gap === 0 ? 'Égalité' : `${esc((ta > tb ? a : b).pseudo)} mène de ${fmt(gap)} pt${gap > 1 ? 's' : ''}`;
    const s = Scoring.duelSummary(a, b, STAT_KEYS.concat(AWARD_KEYS));
    // Photo, puis pseudo, puis position au général (en colonne) ; les points à côté
    const side = (p, cls) => `<div class="rs-dside ${cls}">
        <div class="rs-dwho">
            <span class="rs-avatar">${renderAvatarHtml(p.avatar, p.pseudo)}</span>
            <h2>${esc(p.pseudo)}</h2>
            ${p.prenom ? `<span class="rs-prenom">${esc(p.prenom)}</span>` : ''}
            <span class="rs-dmeta">${rankOfKey(p, 'total') ? ordinal(rankOfKey(p, 'total')) + ' au général' : 'Classement à venir'}</span>
        </div></div>`;
    panel.innerHTML = `
        <div class="rs-box rs-dhead">
            ${side(a, 'is-a')}
            <div class="rs-dmid">
                <p class="rs-lead">${lead}</p>
                <div class="rs-score">
                    <span class="rs-dpts is-a">${fmt(ta)}</span>
                    <div class="rs-bar" aria-hidden="true"><span style="width:${share}%"></span></div>
                    <span class="rs-dpts is-b">${fmt(tb)}</span>
                </div>
                ${sameGrid(a, b, s)}
            </div>
            ${side(b, 'is-b')}
        </div>
        <div class="rs-cards">${RS_CATS.map(c => duelCard(c, a, b)).join('')}</div>
        <div class="rs-duo">
            ${evoBox([{ ranks: rankSeries(a), color: COLOR_A }, { ranks: rankSeries(b), color: COLOR_B }])}
            <div class="rs-box"><div class="rs-box-h"><span class="rs-box-t">Meilleurs coups</span></div>
                <div class="rs-bests">
                    <div><p class="rs-who is-a">${esc(a.pseudo)}</p>${bestMoveHtml(a)}</div>
                    <div><p class="rs-who is-b">${esc(b.pseudo)}</p>${bestMoveHtml(b)}</div>
                </div>
            </div>
        </div>`;
}

// Comparatif : une case par équipe (Est puis Ouest) et un point par catégorie Pick 1,
// allumés quand les deux joueurs ont fait exactement le même prono
function sameGrid(a, b, s) {
    const real = state.data.real;
    const teamRow = conf => {
        const rows = Scoring.conferenceRows(a[conf], real[conf]).filter(r => b[conf] && r.team in b[conf]);
        const known = rows.some(r => r.real !== null);
        rows.sort((x, y) => known ? (x.real || 99) - (y.real || 99) : x.predicted - y.predicted);
        return `<span class="rs-sq">${rows.map(r => {
            const on = a[conf][r.team] === b[conf][r.team];
            const name = Teams.find(r.team) ? Teams.find(r.team).name : r.team;
            return `<i class="${on ? 'on' : ''}" title="${esc(name)} : ${on ? `${ordinal(a[conf][r.team])} pour les deux` : `${ordinal(a[conf][r.team])} / ${ordinal(b[conf][r.team])}`}"></i>`;
        }).join('')}</span>`;
    };
    const cats = STAT_KEYS.concat(AWARD_KEYS);
    const dots = cats.map(key => {
        const pa = (a.stats[key] || a.awards[key] || [])[0], pb = (b.stats[key] || b.awards[key] || [])[0];
        const on = Scoring.norm(pa) !== '' && Scoring.norm(pa) === Scoring.norm(pb);
        return `<i class="${on ? 'on' : ''}" title="${esc(CATEGORY_LABELS[key] || key)} : ${on ? esc(pa) : `${esc(pa || '—')} / ${esc(pb || '—')}`}"></i>`;
    });
    const half = Math.ceil(dots.length / 2);
    return `<div class="rs-same-grid">
        <div class="rs-same-blk">${teamRow('east')}${teamRow('west')}
            <span class="rs-same-cap"><b>${s.sameTeams}/${s.totalTeams}</b>classements identiques</span></div>
        <div class="rs-same-sep" aria-hidden="true"></div>
        <div class="rs-same-blk">
            <span class="rs-sq rs-sq--dots">${dots.slice(0, half).join('')}</span><span class="rs-sq rs-sq--dots">${dots.slice(half).join('')}</span>
            <span class="rs-same-cap"><b>${s.samePick1}/${cats.length}</b>Pick 1 identiques</span></div>
    </div>`;
}

// Données secondaires du Résumé (historique, palmarès), chargées une fois en arrière-plan
function loadResumeExtras() {
    Api.getHistory().then(h => { state.history = h || []; if (state.current) renderResume(); }).catch(() => { state.history = []; });
    Api.getHallOfFame().then(list => {
        const map = {};
        (Array.isArray(list) ? list : []).forEach(item => {
            const who = normName(item && item.vainqueur);
            if (!who) return;
            const label = String(item.saison || '').replace(/^(\d{4})-\d{2}(\d{2})$/, '$1-$2');
            (map[who] = map[who] || []).push({ label, maillot: item.maillot && !/^tba$/i.test(String(item.maillot).trim()) ? item.maillot : '' });
        });
        Object.values(map).forEach(l => l.sort((x, y) => y.label.localeCompare(x.label)));
        state.champions = map;
        if (state.current) renderResume();
    }).catch(() => { state.champions = {}; });
}

function bindPickers() {
    document.querySelectorAll('.picker-wrap').forEach(wrap => {
        wrap.querySelector('.player-picker').addEventListener('click', () => { if (state.players.length) togglePicker(wrap); });
        wrap.querySelector('.picker-pop').addEventListener('click', event => {
            const row = event.target.closest('.picker-row');
            const foot = event.target.closest('.picker-foot');
            closePickers();
            if (row) {
                const player = findPlayer(row.dataset.id);
                if (!player) return;
                if (wrap.dataset.picker === 'rival') setOpponent(player);
                else { $('player-select').value = player.id; showPlayer(player); }
            } else if (foot && foot.dataset.action === 'compare') openRivalPanel();
            else if (foot && foot.dataset.action === 'end-duel') setOpponent(null);
            wrap.querySelector('.player-picker').focus();
        });
        // Flèches haut / bas pour parcourir la liste
        wrap.querySelector('.picker-pop').addEventListener('keydown', event => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const items = [...wrap.querySelectorAll('.picker-row, .picker-foot')];
            const i = items.indexOf(document.activeElement);
            const next = items[(i + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
            if (next) next.focus();
        });
    });
    document.addEventListener('click', event => { if (!event.target.closest('.picker-wrap')) closePickers(); });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const open = [...document.querySelectorAll('.picker-wrap')].find(w => !w.querySelector('.picker-pop').hidden);
        if (open) { closePickers(); open.querySelector('.player-picker').focus(); }
    });
}

function bindEvents() {
    $('conf-east').addEventListener('click', onSortClick);
    $('conf-west').addEventListener('click', onSortClick);
    bindRivalPanel();
    bindPickers();
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
    $('pronos-back').addEventListener('click', () => {
        compareSel.length = 0;
        refreshCompareSelection();
        showView('list');
    });

    $('player-select').addEventListener('change', event => {
        const player = findPlayer(event.target.value);
        if (player) showPlayer(player); else clearPlayer();
    });

    ['rival-select'].forEach(id => $(id).addEventListener('change', event => {
        if (state.current) setOpponent(findPlayer(event.target.value));
    }));

    document.querySelector('.tabs').addEventListener('click', event => {
        const button = event.target.closest('.tab-btn');
        if (button) setTab(button.dataset.tab);
    });

    // Résumé : une carte ouvre son onglet, « Comparer » ouvre le panneau, « Voir l'évolution » l'onglet Évolution
    $('resume-panel').addEventListener('click', event => {
        const go = event.target.closest('[data-goto]');
        if (go) { setTab(go.dataset.goto); return; }
        if (event.target.closest('.rs-compare')) openRivalPanel();
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
            $('players-view').hidden = true;
            $('pronos-detail').hidden = true;
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
            $('players-view').hidden = true;
            $('pronos-detail').hidden = false;
            select.innerHTML = '<option value="">Aucun joueur</option>';
            showMessage('Aucun joueur inscrit pour le moment.');
            return;
        }

        fillPlayerSelect();
        select.disabled = false;

        if (!state.bound) { state.bound = true; bindEvents(); }
        loadStreaks();
        loadRoster();
        loadResumeExtras();

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
        $('players-view').hidden = true;
        $('pronos-detail').hidden = false;
        showMessage('Impossible de charger les pronostics.', error.message);
    }
}

// ---------- Données mémorisées de la visite précédente : mise à jour quand le Sheet répond ----------
function fillPlayerSelect() {
    const select = $('player-select');
    select.innerHTML = '<option value="">-- Choisir un joueur --</option>' +
        state.players.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}</option>`).join('');
    select.value = state.current ? state.current.id : '';
}

async function refreshPronos() {
    // Rien d'affiché encore (pronos verrouillés ou erreur) : on relance l'initialisation complète
    if (!state.data) { initPronostics(); return; }
    const data = await Api.getPronos().catch(() => null);
    if (!data) return;
    if (!data.revealed || !Array.isArray(data.players) || !data.real) { window.location.reload(); return; }

    state.data = data;
    state.players = [...data.players].sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));
    // Les joueurs affichés sont remplacés par leur version fraîche (mêmes identifiants)
    const current = state.current && findPlayer(state.current.id);
    const opponent = state.opponent && findPlayer(state.opponent.id);
    for (let i = compareSel.length - 1; i >= 0; i--) if (!findPlayer(compareSel[i])) compareSel.splice(i, 1);
    state.current = current || null;
    state.opponent = current ? opponent || null : null;
    fillPlayerSelect();
    renderPlayerCards();
    if (current) {
        $('picker-avatar').innerHTML = renderAvatarHtml(current.avatar, current.pseudo);
        $('picker-name').textContent = current.pseudo;
        fillCompareSelect();
        renderAll();
    }
}

Api.onUpdate('pronos', refreshPronos);
Api.onUpdate(['historique', 'halloffame'], () => {
    if (!state.data) return;
    loadResumeExtras();
    if (state.current && state.tab === 'evolution') renderEvolution();
});

// Avant la saison : fausse popin affichée tout de suite (script chargé en bas de page)
(() => {
    const card = document.getElementById('pronos-wrap');
    if (card && RevealLock.shouldLockNow('pronos')) { RevealLock.show(card, REVEAL_TEXTS.pronostics); return; }
    // Sinon, squelette de la vue attendue (liste des joueurs, ou fiche si un joueur est dans l'adresse)
    if (new URLSearchParams(window.location.search).get('joueur')) {
        $('pronos-detail').hidden = false;
        $('pronos-message').innerHTML = '<div class="skel-sheet" aria-label="Chargement des pronostics"><span class="skel skel--tabs"></span><span class="skel skel--block"></span><span class="skel skel--block"></span></div>';
    } else {
        $('players-view').hidden = false;
        $('players-grid').innerHTML = Array.from({ length: 8 }, () =>
            '<article class="player-card player-card--skel" aria-hidden="true"><span class="player-card-photo"><span class="skel"></span></span><span class="skel skel--name"></span></article>').join('');
    }
})();

document.addEventListener('DOMContentLoaded', initPronostics);
