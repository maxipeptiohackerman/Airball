// ==========================================
// RÉCAP DU LUNDI (outils/recap.html)
// ==========================================
// 1. DONNÉES   : Sheet (classement, historique, pronos, NBA DATA) + ESPN (classements, leaders,
//                blessures, matchs de la semaine passée et de la semaine à venir) + players.json
// 2. FAITS     : chaque famille propose des faits notés de 1 à 3 (intérêt), les plus marquants en premier
// 3. IMAGE     : dessinée dans un <canvas> 1080 x 1350, téléchargée en PNG
// Dépend de : config.js, api.js, demo.js, teams.js, jersey.js, scoring.js
'use strict';

const SITE_URL = 'airball2k27.netlify.app';
// Bas de l'image : 'A' adresse du site, 'B' « Ta place et tes points : lien dans le message », 'C' rien
let FOOTER = 'C';
const W = 1080, H = 1350;
const DAY = 864e5;
const $ = id => document.getElementById(id);
const norm = Scoring.norm;
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Petits outils de texte ----------
const num = n => String(Math.round(Number(n) * 10) / 10).replace('.', ',');
const ord = n => (n === 1 ? '1re' : n + 'e');
const pts = n => `${num(n)} ${Math.abs(n) > 1 ? 'pts' : 'pt'}`;
// Moyennes : 2 décimales sous 5 (interceptions, contres : 2,75 contre 2,71), 1 au-dessus
const avg = v => String(v < 5 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10).replace('.', ',');
const plural = (n, one, many) => (n > 1 ? many : one);
const lastName = name => {
    const parts = String(name || '').trim().split(/\s+/);
    if (parts.length < 2) return parts[0] || '';
    const suffix = /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(parts[parts.length - 1]) ? parts.pop() : '';
    return parts.slice(1).join(' ') + (suffix ? ' ' + suffix : '');
};
const listFr = items => items.length < 2 ? (items[0] || '') : items.slice(0, -1).join(', ') + ' et ' + items[items.length - 1];
const CONF_FR = { east: "l'Est", west: "l'Ouest" };
const STAT_FR = { pts: 'points', reb: 'rebonds', ast: 'passes', stl: 'interceptions', blk: 'contres' };
const STAT_CAP = { pts: 'Points', reb: 'Rebonds', ast: 'Passes', stl: 'Interceptions', blk: 'Contres' };
const AWARD_FR = { mvp: 'MVP', coy: 'COY', roy: 'ROY', mip: 'MIP', dpoy: 'DPOY', sixth: '6th Man' };
// « le Magic », « les Lakers » : quelques franchises s'emploient au singulier
const SINGULAR = ['Magic', 'Heat', 'Thunder', 'Jazz'];
const teamArt = key => (SINGULAR.includes(key) ? 'le ' : 'les ') + key;
const teamArtCap = key => (SINGULAR.includes(key) ? 'Le ' : 'Les ') + key;
const teamVerb = key => (SINGULAR.includes(key) ? 'est' : 'sont');
const teamPron = key => (SINGULAR.includes(key) ? 'le' : 'les');
const frDate = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '').replace(/^1 /, '1er ');
const frWeekday = d => d.toLocaleDateString('fr-FR', { weekday: 'long' });
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const ymd = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

// ---------- Semaine du récap ----------
const TODAY = startOfDay(new Date());
const WEEK_START = new Date(TODAY.getTime() - 7 * DAY);   // les 7 derniers jours, hier inclus
const WEEK_END = new Date(TODAY.getTime() - DAY);
const WEEK_NUMBER = Math.max(1, Math.floor((TODAY - startOfDay(SEASON_START)) / (7 * DAY)) + 1);
const WEEK_LABEL = `${frDate(WEEK_START).replace(/ .*/, '')}${WEEK_START.getMonth() === WEEK_END.getMonth() ? '' : ' ' + frDate(WEEK_START).split(' ')[1]} → ${frDate(WEEK_END)}`;

// ==========================================
// 1. DONNÉES
// ==========================================
const D = {};          // toutes les données chargées
const sourceState = []; // [{ label, ok, note }]

async function sheet(page) {
    // Le mode démo remplace Api.get... par de fausses données : on passe alors par Api
    if (Demo.active()) {
        if (page === 'leaderboard') return Api.getLeaderboard();
        if (page === 'historique') return Api.getHistory();
        if (page === 'pronos') return Api.getPronos();
    }
    const res = await fetch(`${APPS_SCRIPT_URL}?page=${page}&t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.error) throw new Error(json.error);
    return json;
}
async function getJson(url) {
    const res = await fetch(String(url).replace(/^http:/, 'https:'), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}
// N requêtes à la fois au plus (ESPN n'aime pas les rafales)
async function pool(items, size, fn) {
    const out = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
        while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = null; console.warn(e); } }
    }));
    return out;
}

// Leaders ESPN qualifiés (même source que outils/maj-stats.html), avec les moyennes
const SEASON = Espn.currentSeason();
const LEADER_CATS = [
    { key: 'pts', sort: 'offensive.avgPoints' }, { key: 'reb', sort: 'general.avgRebounds' },
    { key: 'ast', sort: 'offensive.avgAssists' }, { key: 'stl', sort: 'defensive.avgSteals' },
    { key: 'blk', sort: 'defensive.avgBlocks' }
];
async function loadLeaders() {
    const result = {};
    for (const c of LEADER_CATS) {
        const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=6&season=${SEASON}&seasontype=2&sort=${c.sort}:desc`;
        const data = await getJson(url);
        const [group, stat] = c.sort.split('.');
        const names = ((data.categories || []).find(x => x.name === group) || {}).names || [];
        const i = names.indexOf(stat);
        result[c.key] = (data.athletes || []).map(a => {
            const cat = (a.categories || []).find(x => x.name === group) || {};
            return { name: (a.athlete || {}).displayName || '', value: Number((cat.totals || [])[i]) };
        }).filter(x => x.name && isFinite(x.value));
    }
    return result;
}

async function loadInjuries() {
    const data = await getJson('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries');
    const list = [];
    (data.injuries || []).forEach(team => (team.injuries || []).forEach(inj => {
        const a = inj.athlete || {};
        list.push({
            name: a.displayName || a.fullName || '',
            status: String(inj.status || (inj.type || {}).description || ''),
            returnDate: (inj.details || {}).returnDate || '',
            team: team.displayName || ((a.team || {}).displayName) || ''
        });
    }));
    return list.filter(x => x.name);
}

function scoreboardUrl(date) {
    return `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(date)}`;
}
function eventTeams(ev) {
    const comp = (ev.competitions || [])[0] || {};
    const teams = (comp.competitors || []).map(c => ({ side: c.homeAway, team: Teams.find((c.team || {}).displayName) || Teams.find((c.team || {}).abbreviation), score: Number(c.score) }));
    return { home: (teams.find(t => t.side === 'home') || teams[0] || {}).team, away: (teams.find(t => t.side === 'away') || teams[1] || {}).team };
}

// Matchs de la semaine à venir : [{ date, home, away }]
async function loadUpcoming() {
    const days = Array.from({ length: 7 }, (_, k) => new Date(TODAY.getTime() + k * DAY));
    const boards = await pool(days, 4, d => getJson(scoreboardUrl(d)));
    const games = [];
    boards.forEach(b => (b && b.events || []).forEach(ev => {
        const state = (((ev.status || {}).type) || {}).state;
        if (state === 'post') return;
        const { home, away } = eventTeams(ev);
        if (home && away) games.push({ date: new Date(ev.date), home, away });
    }));
    return games;
}

// Feuilles de match de la semaine passée : [{ name, team, opp, date, min, pts, reb, ast, stl, blk }]
async function loadWeekPerfs() {
    const days = Array.from({ length: 7 }, (_, k) => new Date(WEEK_START.getTime() + k * DAY));
    const boards = await pool(days, 4, d => getJson(scoreboardUrl(d)));
    const events = [];
    boards.forEach(b => (b && b.events || []).forEach(ev => {
        if ((((ev.status || {}).type) || {}).completed) events.push(ev);
    }));
    const summaries = await pool(events, 6, ev => getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${ev.id}`));
    const perfs = [];
    summaries.forEach((sum, k) => {
        if (!sum) return;
        const ev = events[k];
        const { home, away } = eventTeams(ev);
        ((sum.boxscore || {}).players || []).forEach(side => {
            const team = Teams.find((side.team || {}).displayName) || Teams.find((side.team || {}).abbreviation);
            const opp = team && home && team.key === home.key ? away : home;
            (side.statistics || []).forEach(block => {
                const cols = (block.labels || block.names || []).map(x => String(x).toUpperCase());
                const keys = (block.keys || []).map(x => String(x).toLowerCase());
                const col = (label, key) => { let i = cols.indexOf(label); if (i < 0) i = keys.indexOf(key); return i; };
                const idx = { min: col('MIN', 'minutes'), pts: col('PTS', 'points'), reb: col('REB', 'rebounds'), ast: col('AST', 'assists'), stl: col('STL', 'steals'), blk: col('BLK', 'blocks') };
                (block.athletes || []).forEach(a => {
                    if (a.didNotPlay || !(a.stats || []).length) return;
                    const v = k2 => idx[k2] >= 0 ? Number(a.stats[idx[k2]]) || 0 : 0;
                    perfs.push({ name: (a.athlete || {}).displayName || '', team, opp, date: new Date(ev.date), min: v('min'), pts: v('pts'), reb: v('reb'), ast: v('ast'), stl: v('stl'), blk: v('blk') });
                });
            });
        });
    });
    return perfs.filter(p => p.name);
}

async function loadAll() {
    const tasks = [
        ['leaderboard', 'Classement', () => sheet('leaderboard')],
        ['history', 'Historique', () => sheet('historique')],
        ['pronos', 'Pronos', () => sheet('pronos')],
        ['nbaData', 'NBA DATA', () => sheet('nba-data')],
        ['players', 'players.json', () => getJson('../players.json')],
        ['standings', 'Classements ESPN', () => Espn.getStandings({ season: SEASON })],
        ['leaders', 'Leaders ESPN', loadLeaders],
        ['injuries', 'Blessures ESPN', loadInjuries],
        ['upcoming', 'Matchs à venir', loadUpcoming],
        ['perfs', 'Matchs de la semaine', loadWeekPerfs]
    ];
    const results = await Promise.allSettled(tasks.map(t => t[2]()));
    results.forEach((r, i) => {
        const [key, label] = tasks[i];
        D[key] = r.status === 'fulfilled' ? r.value : null;
        sourceState.push({ label, ok: r.status === 'fulfilled', note: r.status === 'rejected' ? (r.reason && r.reason.message) || 'erreur' : '' });
        if (r.status === 'rejected') console.warn(`Source « ${label} » indisponible :`, r.reason);
    });
    prepare();
}

// ---------- Mise en forme des données ----------
const M = {}; // données préparées

function prepare() {
    // Joueurs NBA (équipe, numéro, rookie)
    M.nbaPlayers = {};
    (D.players || []).forEach(p => { M.nbaPlayers[norm(p.name)] = p; });

    // Classement Airball actuel
    const lb = (D.leaderboard && D.leaderboard.players) || [];
    M.players = lb.map(p => ({ ...p, total: Number((p.scores || {}).total) || 0 })).sort((a, b) => b.total - a.total);
    M.players.forEach(p => { p.rank = 1 + M.players.filter(q => q.total > p.total).length; });
    M.byId = Object.fromEntries(M.players.map(p => [p.id, p]));

    // Relevés de l'historique, par semaine (le plus récent d'abord). Un relevé fait aujourd'hui
    // (déclencheur du lundi matin) est la photo actuelle : on compare au précédent.
    const weeks = {};
    (D.history || []).forEach(row => {
        const date = parseWeekDate(row.semaine);
        if (!date) return;
        const k = date.getTime();
        (weeks[k] = weeks[k] || { date, rows: {} }).rows[row.id] = { rank: Number(row.classement), pts: Number(row.points) };
    });
    M.weeks = Object.values(weeks).sort((a, b) => b.date - a.date).filter(w => w.date < TODAY);
    M.prev = M.weeks[0] || null;
    M.players.forEach(p => {
        const before = M.prev && M.prev.rows[p.id];
        p.prevRank = before ? before.rank : null;
        p.delta = before ? before.rank - p.rank : 0;
        p.weekPts = before ? p.total - before.pts : null;
    });

    // Pronos de chaque joueur, par identifiant
    M.pronos = {};
    ((D.pronos && D.pronos.players) || []).forEach(p => { M.pronos[p.id] = p; });
    M.pronoList = M.players.map(p => M.pronos[p.id]).filter(Boolean);

    // Classement réel des conférences : ESPN, sinon NBA DATA
    M.realRank = { east: {}, west: {} };
    ['east', 'west'].forEach(conf => {
        if (D.standings && D.standings[conf]) {
            D.standings[conf].entries.forEach((e, i) => { const t = Teams.find(e.team.displayName) || Teams.find(e.team.abbreviation); if (t) M.realRank[conf][t.key] = i + 1; });
        } else if (D.pronos && D.pronos.real) {
            (D.pronos.real[conf] || []).forEach((key, i) => { if (key) M.realRank[conf][key] = i + 1; });
        }
    });
}
function parseWeekDate(value) {
    if (typeof parseWeek === 'function') return parseWeek(value);
    const text = String(value || '').trim();
    let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12);
    m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (m) return new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1], 12);
    return null;
}

// Qui a pické ce joueur NBA ? [{ player, cat, index }]
function pickersOf(name, cats) {
    const target = norm(name);
    const out = [];
    M.pronoList.forEach(p => cats.forEach(cat => {
        const picks = (p.stats && p.stats[cat]) || (p.awards && p.awards[cat]) || [];
        const i = picks.findIndex(x => norm(x) === target);
        if (i >= 0) out.push({ player: p, cat, index: i });
    }));
    return out;
}
const ALL_CATS = ['pts', 'reb', 'ast', 'stl', 'blk', 'mvp', 'roy', 'mip', 'dpoy', 'sixth'];
const catFr = cat => STAT_FR[cat] ? `aux ${STAT_FR[cat]}` : `en ${AWARD_FR[cat]}`;
// « aux contres par 6 joueurs, en MVP par 2 »
function pickSummary(pickers) {
    const byCat = {};
    pickers.forEach(x => { (byCat[x.cat] = byCat[x.cat] || new Set()).add(x.player.id); });
    return Object.entries(byCat).sort((a, b) => b[1].size - a[1].size).slice(0, 2)
        .map(([cat, set], i) => `${catFr(cat)} par ${set.size}${i === 0 ? ' ' + plural(set.size, 'joueur', 'joueurs') : ''}`).join(', ');
}
const uniquePlayers = pickers => new Set(pickers.map(x => x.player.id)).size;

// Plus gros désaccord entre deux joueurs Airball sur le classement des équipes
function biggestGap(a, b) {
    let best = null;
    ['east', 'west'].forEach(conf => Object.keys(a[conf] || {}).forEach(team => {
        if (!(team in (b[conf] || {}))) return;
        const diff = Math.abs(a[conf][team] - b[conf][team]);
        if (!best || diff > best.diff) best = { team, conf, a: a[conf][team], b: b[conf][team], diff, real: M.realRank[conf][team] };
    }));
    return best;
}

// ==========================================
// 2. FAITS
// ==========================================
// { id, family, title, detail, score (1 à 3), visual: { kind: 'airball'|'nba'|'team'|'none', items: [...] } }
const FAMILIES = [
    { key: 'air', label: 'Classement Airball', hint: 'historique, lundi contre lundi', c: '#dcff5f', b: 'rgba(220,255,95,0.1)' },
    { key: 'groupe', label: 'Le groupe', hint: 'pronos des joueurs', c: '#f45d4f', b: 'rgba(244,93,79,0.12)' },
    { key: 'nba', label: 'Classements NBA', hint: 'classements ESPN contre pronos', c: '#e8e7e4', b: 'rgba(255,255,255,0.08)' },
    { key: 'stats', label: 'Stats', hint: 'leaders qualifiés ESPN', c: '#a99bff', b: 'rgba(169,155,255,0.12)' },
    { key: 'awards', label: 'Awards et perfs', hint: 'matchs des 7 derniers jours', c: '#ffa136', b: 'rgba(255,161,54,0.12)' },
    { key: 'dur', label: 'Le coup dur', hint: 'blessures ESPN', c: '#fa5341', b: 'rgba(250,83,65,0.12)' },
    { key: 'suivre', label: 'À suivre cette semaine', hint: 'emplacement 3 : un seul choix', c: '#0c0c0e', b: '#dcff5f' }
];
const FAMILY = Object.fromEntries(FAMILIES.map(f => [f.key, f]));

const airVisual = (...players) => ({ kind: 'airball', items: players.filter(Boolean) });
const nbaVisual = (...names) => ({ kind: 'nba', items: names });
const teamVisual = (...keys) => ({ kind: 'team', items: keys });

function airFacts() {
    const out = [];
    const P = M.players;
    if (!P.length) return out;
    if (!M.prev) return [{ id: 'air-none', family: 'air', note: "Pas encore de relevé dans l'historique : les mouvements apparaîtront après le premier lundi." }];

    const up = [...P].filter(p => p.delta > 0).sort((a, b) => b.delta - a.delta || (b.weekPts || 0) - (a.weekPts || 0))[0];
    if (up) out.push({ id: 'air-up', family: 'air', score: up.delta >= 2 ? 3 : 2, visual: airVisual(up),
        tag: 'Classement Airball · la montée',
        title: `${up.pseudo} : +${up.delta} ${plural(up.delta, 'place', 'places')}`,
        detail: `De la ${ord(up.prevRank)} à la ${ord(up.rank)} place${up.weekPts != null ? `, ${up.weekPts >= 0 ? '+' : ''}${num(up.weekPts)} pts cette semaine` : ''}` });

    const best = [...P].filter(p => p.weekPts != null).sort((a, b) => b.weekPts - a.weekPts)[0];
    if (best && best.weekPts > 0 && (!up || best.id !== up.id)) out.push({ id: 'air-best', family: 'air', score: 2, visual: airVisual(best),
        tag: 'Classement Airball · la semaine',
        title: `${best.pseudo} : +${num(best.weekPts)} pts, meilleure semaine du groupe`,
        detail: `${ord(best.rank)} au classement général` });

    const down = [...P].filter(p => p.delta < 0).sort((a, b) => a.delta - b.delta)[0];
    if (down) out.push({ id: 'air-down', family: 'air', score: down.delta <= -2 ? 2.5 : 1.5, visual: airVisual(down),
        tag: 'Classement Airball · la chute',
        title: `${down.pseudo} perd ${-down.delta} ${plural(-down.delta, 'place', 'places')}`,
        detail: `De la ${ord(down.prevRank)} à la ${ord(down.rank)} place${down.prevRank <= 3 && down.rank > 3 ? ', il sort du podium' : ''}` });

    const leader = P[0];
    const prevLeaderId = Object.entries(M.prev.rows).sort((a, b) => a[1].rank - b[1].rank)[0];
    if (leader && prevLeaderId && prevLeaderId[0] !== leader.id && leader.rank === 1) {
        const old = M.byId[prevLeaderId[0]];
        out.push({ id: 'air-lead', family: 'air', score: 3, visual: airVisual(leader, old),
            tag: 'Classement Airball · nouveau leader',
            title: `${leader.pseudo} prend la tête`,
            detail: old ? `Il double ${old.pseudo}, avec ${pts(leader.total - old.total)} d'avance` : `${num(leader.total)} pts` });
    } else if (leader) {
        let streak = 1;
        for (const w of M.weeks) {
            const top = Object.entries(w.rows).sort((a, b) => a[1].rank - b[1].rank)[0];
            if (top && top[0] === leader.id) streak++; else break;
        }
        if (streak >= 2) out.push({ id: 'air-streak', family: 'air', score: streak >= 4 ? 2 : 1.5, visual: airVisual(leader),
            tag: 'Classement Airball · la série',
            title: `${leader.pseudo} : ${ord(streak)} semaine de suite en tête`,
            detail: P[1] ? `${pts(leader.total - P[1].total)} d'avance sur ${P[1].pseudo}` : '' });
    }

    const entered = P.filter(p => p.rank <= 3 && p.prevRank > 3 && (!up || p.id !== up.id))[0];
    if (entered) out.push({ id: 'air-podium', family: 'air', score: 2, visual: airVisual(entered),
        tag: 'Classement Airball · le podium',
        title: `${entered.pseudo} entre sur le podium`,
        detail: `${ord(entered.rank)}, il était ${ord(entered.prevRank)} lundi dernier` });
    return out;
}

function groupeFacts() {
    const out = [];
    const list = M.pronoList;
    if (list.length < 3) return out;

    // Seul contre tous : un seul joueur à une place près, les autres loin
    const lonely = [];
    ['east', 'west'].forEach(conf => Object.entries(M.realRank[conf]).forEach(([team, real]) => {
        const preds = list.map(p => ({ p, pred: (p[conf] || {})[team] })).filter(x => x.pred);
        const close = preds.filter(x => Math.abs(x.pred - real) <= 1);
        if (close.length !== 1 || preds.length < 3) return;
        const others = preds.filter(x => x !== close[0]);
        const avgGap = others.reduce((s, x) => s + Math.abs(x.pred - real), 0) / others.length;
        if (avgGap < 4) return;
        const ranks = others.map(x => x.pred);
        lonely.push({ team, conf, real, who: close[0], avgGap, min: Math.min(...ranks), max: Math.max(...ranks), n: others.length });
    }));
    lonely.sort((a, b) => b.avgGap - a.avgGap).slice(0, 2).forEach((x, i) => out.push({
        id: `grp-lonely-${i}`, family: 'groupe', score: Math.min(3, x.avgGap / 2), visual: teamVisual(x.team),
        tag: 'Seul contre tous',
        title: `${x.who.p.pseudo} voyait ${teamArt(x.team)} à la ${ord(x.who.pred)} place`,
        detail: `Les ${x.n} autres : entre la ${ord(x.min)} et la ${ord(x.max)} place. ${teamArtCap(x.team)} ${teamVerb(x.team)} ${ord(x.real)} à ${CONF_FR[x.conf]}.`
    }));

    // Face-à-face : deux joueurs voisins au classement, et l'équipe qui les sépare le plus
    const P = M.players;
    let count = 0;
    for (let i = 0; i < P.length - 1 && count < 2; i++) {
        const a = P[i], b = P[i + 1];
        const gap = a.total - b.total;
        if (gap > 3 || !M.pronos[a.id] || !M.pronos[b.id]) continue;
        const big = biggestGap(M.pronos[a.id], M.pronos[b.id]);
        if (!big || big.diff < 4) continue;
        count++;
        out.push({ id: `grp-duel-${i}`, family: 'groupe', score: i === 0 ? 3 : 2, visual: airVisual(a, b),
            tag: 'Face-à-face',
            title: `${a.pseudo} et ${b.pseudo} : ${gap === 0 ? 'à égalité' : `${pts(gap)} d'écart`}`,
            detail: `Ils divergent le plus sur ${teamArt(big.team)} (${ord(big.a)} contre ${ord(big.b)})${big.real ? `, ${ord(big.real)} aujourd'hui` : ''}.` });
    }
    return out;
}

function nbaFacts() {
    const out = [];
    const list = M.pronoList;
    if (!list.length) return out;

    // Le meilleur prono : le plus de positions exactes
    const exact = list.map(p => ({ p, n: ['east', 'west'].reduce((s, conf) => s + Object.entries(p[conf] || {}).filter(([t, r]) => M.realRank[conf][t] === r).length, 0) }))
        .sort((a, b) => b.n - a.n);
    if (exact[0] && exact[0].n >= 3) {
        const avg = exact.reduce((s, x) => s + x.n, 0) / exact.length;
        const pl = M.byId[exact[0].p.id] || exact[0].p;
        out.push({ id: 'nba-exact', family: 'nba', score: exact[0].n >= 7 ? 2.5 : 1.5, visual: airVisual(pl),
            tag: 'Classements NBA · le meilleur prono',
            title: `${exact[0].p.pseudo} : ${exact[0].n} positions exactes`,
            detail: `Sur 30 équipes, Est et Ouest réunis. Moyenne du groupe : ${num(avg)}.` });
    }

    // Surprises et flops : écart entre le prono moyen du groupe et le classement réel
    const teams = [];
    ['east', 'west'].forEach(conf => Object.entries(M.realRank[conf]).forEach(([team, real]) => {
        const preds = list.map(p => ({ p, pred: (p[conf] || {})[team] })).filter(x => x.pred);
        if (!preds.length) return;
        const avg = preds.reduce((s, x) => s + x.pred, 0) / preds.length;
        teams.push({ team, conf, real, avg, preds });
    }));
    teams.filter(t => t.avg - t.real >= 4).sort((a, b) => (b.avg - b.real) - (a.avg - a.real)).slice(0, 2).forEach((t, i) => {
        const seers = t.preds.filter(x => Math.abs(x.pred - t.real) <= 1).map(x => x.p.pseudo);
        out.push({ id: `nba-surprise-${i}`, family: 'nba', score: Math.min(3, (t.avg - t.real) / 2.5), visual: teamVisual(t.team),
            tag: "Classements NBA · l'équipe surprise",
            title: `${teamArtCap(t.team)} ${ord(t.real)} à ${CONF_FR[t.conf]}`,
            detail: `Le groupe ${teamPron(t.team)} voyait ${ord(Math.round(t.avg))} en moyenne. ${seers.length ? `${listFr(seers)} ${plural(seers.length, "l'avait", "l'avaient")} vu venir.` : "Personne ne l'avait vu venir."}` });
    });
    teams.filter(t => t.real - t.avg >= 4).sort((a, b) => (b.real - b.avg) - (a.real - a.avg)).slice(0, 2).forEach((t, i) => {
        const top = t.preds.filter(x => x.pred <= 6).length;
        out.push({ id: `nba-flop-${i}`, family: 'nba', score: Math.min(3, (t.real - t.avg) / 2.5), visual: teamVisual(t.team),
            tag: 'Classements NBA · le flop',
            title: `${teamArtCap(t.team)} ${ord(t.real)} à ${CONF_FR[t.conf]}`,
            detail: `Le groupe ${teamPron(t.team)} voyait ${ord(Math.round(t.avg))} en moyenne${top ? ` : ${top} ${plural(top, `joueur ${teamPron(t.team)} mettait`, `joueurs ${teamPron(t.team)} mettaient`)} dans le top 6` : ''}.` });
    });
    return out;
}

function statsFacts() {
    const out = [];
    if (!D.leaders) return out;
    const sheetStats = (D.nbaData && D.nbaData.stats) || {};
    Object.entries(D.leaders).forEach(([cat, list]) => {
        const lead = list[0];
        if (!lead || (list[1] && list[1].value === lead.value)) return; // égalité : pas de « pari fou »
        const pickers = pickersOf(lead.name, [cat]);
        const n = uniquePlayers(pickers);
        if (n <= 2) {
            const who = pickers.map(x => `${x.player.pseudo} (pick ${x.index + 1})`);
            out.push({ id: `stats-fou-${cat}`, family: 'stats', score: n === 1 ? 3 : n === 0 ? 2.5 : 2, visual: nbaVisual(lead.name),
                tag: n === 0 ? "Stats · personne ne l'a vu venir" : 'Stats · le pari fou qui tient',
                title: `${lead.name}, 1er ${catFr(cat)}`,
                detail: n === 0 ? `${avg(lead.value)} de moyenne, et aucun joueur ne l'a pické.` : `Pické seulement par ${listFr(who)}. ${avg(lead.value)} de moyenne.` });
        }
        const before = String((sheetStats[cat] || [])[0] || '').split('/')[0].trim();
        if (before && norm(before) !== norm(lead.name)) {
            const p1 = pickersOf(lead.name, [cat]).filter(x => x.index === 0).length;
            out.push({ id: `stats-new-${cat}`, family: 'stats', score: 2, visual: nbaVisual(lead.name, before),
                tag: `Stats · nouveau leader ${catFr(cat)}`,
                title: `${lastName(lead.name)} passe devant ${lastName(before)} ${catFr(cat)}`,
                detail: `${avg(lead.value)} de moyenne. ${p1 ? `${p1} ${plural(p1, "joueur l'avait", "joueurs l'avaient")} en pick 1.` : "Personne ne l'avait en pick 1."}` });
        }
    });
    return out.sort((a, b) => b.score - a.score).slice(0, 4);
}

const statLine = p => {
    const parts = [`${p.pts} pts`];
    if (p.reb >= 5) parts.push(`${p.reb} reb.`);
    if (p.ast >= 5) parts.push(`${p.ast} passes`);
    if (p.stl >= 3) parts.push(`${p.stl} int.`);
    if (p.blk >= 3) parts.push(`${p.blk} contres`);
    return parts.join(', ');
};
const gameScore = p => p.pts + 1.2 * p.reb + 1.5 * p.ast + 3 * (p.stl + p.blk);
const vsTeam = p => (p.opp ? `contre ${teamArt(p.opp.key)}` : 'cette semaine');
const dayOf = p => frWeekday(new Date(p.date.getTime() - 9 * 3600e3)); // date US (soir) : on recule de quelques heures

function awardsFacts() {
    const out = [];
    const perfs = D.perfs || [];
    if (!perfs.length) return out;
    const bestOf = (names, score = gameScore) => {
        const set = new Set(names.map(norm));
        return perfs.filter(p => set.has(norm(p.name))).sort((a, b) => score(b) - score(a))[0];
    };
    const pickedIn = cat => [...new Set(M.pronoList.flatMap(p => ((p.awards || {})[cat] || []).filter(Boolean)))];

    const mvp = bestOf(pickedIn('mvp'));
    if (mvp) {
        const n = uniquePlayers(pickersOf(mvp.name, ['mvp']));
        out.push({ id: 'aw-mvp', family: 'awards', score: mvp.pts >= 40 ? 3 : 2, visual: nbaVisual(mvp.name),
            tag: 'Awards · candidat MVP',
            title: `${mvp.name} : ${statLine(mvp)}`,
            detail: `${vsTeam(mvp)}, ${dayOf(mvp)}. Pické MVP par ${n} ${plural(n, 'joueur', 'joueurs')}.` });
    }
    // Rookies : les joueurs pickés en ROY, sinon tous les rookies de players.json
    let rookies = pickedIn('roy');
    let roy = bestOf(rookies);
    if (!roy) roy = bestOf((D.players || []).filter(p => p.rookie).map(p => p.name));
    if (roy) {
        const n = uniquePlayers(pickersOf(roy.name, ['roy']));
        out.push({ id: 'aw-roy', family: 'awards', score: roy.pts >= 25 ? 2.5 : 2, visual: nbaVisual(roy.name),
            tag: 'Awards · le rookie de la semaine',
            title: `${roy.name} : ${statLine(roy)}`,
            detail: `${vsTeam(roy)}, ${dayOf(roy)}. ${n ? `Pické ROY par ${n} ${plural(n, 'joueur', 'joueurs')}.` : 'Aucun joueur ne l\'a pické ROY.'}` });
    }
    const dpoy = bestOf(pickedIn('dpoy'), p => p.stl + p.blk);
    if (dpoy && dpoy.stl + dpoy.blk >= 5) {
        const n = uniquePlayers(pickersOf(dpoy.name, ['dpoy']));
        out.push({ id: 'aw-dpoy', family: 'awards', score: 1.5, visual: nbaVisual(dpoy.name),
            tag: 'Awards · candidat DPOY',
            title: `${dpoy.name} : ${[dpoy.blk && `${dpoy.blk} contres`, dpoy.stl && `${dpoy.stl} int.`].filter(Boolean).join(', ')}`,
            detail: `${vsTeam(dpoy)}, ${dayOf(dpoy)}. Pické DPOY par ${n} ${plural(n, 'joueur', 'joueurs')}.` });
    }
    // Perf historique d'un joueur pické, toutes catégories confondues
    const picked = [...new Set(M.pronoList.flatMap(p => ALL_CATS.flatMap(c => ((p.stats || {})[c] || (p.awards || {})[c] || []).filter(Boolean))))];
    const big = p => p.pts >= 45 || p.reb >= 20 || p.ast >= 15 || p.blk >= 7 || p.stl >= 6 || [p.pts, p.reb, p.ast, p.stl, p.blk].filter(v => v >= 10).length >= 3;
    const set = new Set(picked.map(norm));
    const hist = perfs.filter(p => set.has(norm(p.name)) && big(p)).sort((a, b) => gameScore(b) - gameScore(a))[0];
    if (hist && (!mvp || hist.name !== mvp.name || hist.date.getTime() !== mvp.date.getTime())) {
        const pk = pickersOf(hist.name, ALL_CATS);
        const triple = [hist.pts, hist.reb, hist.ast, hist.stl, hist.blk].filter(v => v >= 10).length >= 3;
        out.push({ id: 'aw-hist', family: 'awards', score: 3, visual: nbaVisual(hist.name),
            tag: triple ? 'Perf de la semaine · triple-double' : 'Perf de la semaine',
            title: `${hist.name} : ${statLine(hist)}`,
            detail: `${vsTeam(hist)}, ${dayOf(hist)}. Pické ${pickSummary(pk)}.` });
    }
    return out.map(f => ({ ...f, detail: f.detail.charAt(0).toUpperCase() + f.detail.slice(1) }));
}

function durFacts() {
    const out = [];
    (D.injuries || []).forEach(inj => {
        const out_ = /out/i.test(inj.status);
        const dtd = /day/i.test(inj.status);
        if (!out_ && !dtd) return;
        const pk = pickersOf(inj.name, ALL_CATS);
        const n = uniquePlayers(pk);
        if (!n) return;
        const season = /season/i.test(inj.status);
        const ret = inj.returnDate ? new Date(inj.returnDate) : null;
        const when = season ? 'saison terminée' : out_ ? (ret && !isNaN(ret) ? `absent jusqu'au ${frDate(ret)} environ` : 'absent') : 'incertain';
        out.push({ id: `dur-${norm(inj.name).replace(/\W+/g, '-')}`, family: 'dur', score: out_ ? (n >= 3 ? 3 : 2) : 1, visual: nbaVisual(inj.name),
            tag: 'Le coup dur',
            title: `${inj.name} : ${when}`,
            detail: `Pické ${pickSummary(pk)}.` });
    });
    return out.sort((a, b) => b.score - a.score).slice(0, 4);
}

function suivreFacts() {
    const out = [];
    // Batailles pour la 1re place d'une stat
    const THRESHOLD = { pts: 0.5, reb: 0.5, ast: 0.5, stl: 0.2, blk: 0.2 };
    const battles = [];
    Object.entries(D.leaders || {}).forEach(([cat, list]) => {
        const [a, b] = list;
        if (!a || !b || a.value - b.value > THRESHOLD[cat]) return;
        battles.push({ cat, a, b, gap: a.value - b.value });
        const nA = uniquePlayers(pickersOf(a.name, [cat])), nB = uniquePlayers(pickersOf(b.name, [cat]));
        out.push({ id: `sv-battle-${cat}`, family: 'suivre', score: a.value - b.value <= THRESHOLD[cat] / 2 ? 3 : 2.5, visual: { kind: 'nba', items: [a.name, b.name], duel: true },
            tag: 'À suivre cette semaine',
            title: `${STAT_CAP[cat]} : ${lastName(a.name)} ${avg(a.value)} contre ${lastName(b.name)} ${avg(b.value)}`,
            detail: a.value === b.value ? `Égalité parfaite. ${nA} ${plural(nA, 'joueur a', 'joueurs ont')} pické ${lastName(a.name)}, ${nB} ${lastName(b.name)}.`
                : !nA && !nB ? `Personne n'a pické ni l'un ni l'autre : une bataille pour l'honneur.`
                : `Si ${lastName(b.name)} passe devant : ${nB} ${plural(nB, 'joueur marque', 'joueurs marquent')} des points, ${nA} en ${plural(nA, 'perd', 'perdent')}.` });
    });

    // Leader Airball menacé
    const [l1, l2] = M.players;
    if (l1 && l2 && l1.total - l2.total <= 2) {
        const big = M.pronos[l1.id] && M.pronos[l2.id] ? biggestGap(M.pronos[l1.id], M.pronos[l2.id]) : null;
        out.push({ id: 'sv-leader', family: 'suivre', score: l1.total - l2.total <= 1 ? 3 : 2, visual: airVisual(l1, l2),
            tag: 'À suivre cette semaine',
            title: l1.total === l2.total ? `${l1.pseudo} et ${l2.pseudo} à égalité en tête` : `${l2.pseudo} à ${pts(l1.total - l2.total)} de ${l1.pseudo}`,
            detail: big && big.diff >= 3 ? `Tout peut se jouer sur ${teamArt(big.team)} : ${ord(big.a)} pour l'un, ${ord(big.b)} pour l'autre.` : 'La 1re place peut changer de mains lundi prochain.' });
    }

    // Matchs à ne pas rater
    const teamOf = name => { const p = M.nbaPlayers[norm(name)]; return p ? Teams.find(p.team) : null; };
    const nightLabel = date => {
        const local = new Date(date);
        if (local.getHours() < 12) { const prev = new Date(local.getTime() - DAY); return `Nuit de ${frWeekday(prev)} à ${frWeekday(local)}`; }
        return frWeekday(local).replace(/^./, c => c.toUpperCase()) + ' soir';
    };
    const games = [];
    (D.upcoming || []).forEach(g => {
        const confA = g.home.conf, confB = g.away.conf;
        const rA = M.realRank[confA][g.home.key], rB = M.realRank[confB][g.away.key];
        // Une bataille de stats entre deux joueurs de ces équipes
        const battle = battles.find(bt => { const ta = teamOf(bt.a.name), tb = teamOf(bt.b.name); return ta && tb && ((ta.key === g.home.key && tb.key === g.away.key) || (ta.key === g.away.key && tb.key === g.home.key)); });
        if (battle) {
            games.push({ g, score: 3, title: `${nightLabel(g.date)} : ${lastName(battle.a.name)} contre ${lastName(battle.b.name)}`, detail: `La bataille ${catFr(battle.cat)} se joue aussi sur le terrain : ${g.away.key} chez ${teamArt(g.home.key)}.` });
            return;
        }
        if (confA === confB && rA && rB && rA <= 6 && rB <= 6 && Math.abs(rA - rB) <= 2) {
            const [hi, lo] = rA < rB ? [[g.home, rA], [g.away, rB]] : [[g.away, rB], [g.home, rA]];
            games.push({ g, score: hi[1] === 1 && lo[1] === 2 ? 3 : 2, title: `${nightLabel(g.date)} : ${hi[0].key} contre ${lo[0].key}`, detail: `${ord(hi[1])} contre ${ord(lo[1])} de ${CONF_FR[confA]}.` });
        }
    });
    games.sort((a, b) => b.score - a.score).slice(0, 3).forEach((x, i) => out.push({
        id: `sv-match-${i}`, family: 'suivre', score: x.score, visual: teamVisual(x.g.away.key, x.g.home.key),
        tag: 'Le match à ne pas rater', title: x.title, detail: x.detail
    }));
    return out.sort((a, b) => b.score - a.score);
}

function computeFacts() {
    const groups = {};
    const run = (key, fn) => {
        try { groups[key] = fn(); } catch (e) { console.error(`Faits « ${key} » :`, e); groups[key] = [{ id: key + '-err', family: key, note: `Calcul impossible (${e.message}). Détail dans la console.` }]; }
    };
    run('air', airFacts); run('groupe', groupeFacts); run('nba', nbaFacts); run('stats', statsFacts);
    run('awards', awardsFacts); run('dur', durFacts); run('suivre', suivreFacts);
    Object.values(groups).forEach(list => list.sort((a, b) => (b.score || 0) - (a.score || 0)));
    return groups;
}

// ==========================================
// INTERFACE
// ==========================================
let FACTS = {};          // par famille
const BY_ID = {};        // tous les faits par id
const selected = [];     // ids des faits cochés (2 au plus), dans l'ordre du clic
let suivreId = null;
const edits = {};        // textes retouchés : { id: { title, detail } }
const LIBRE_ID = 'libre';

function dots(score) {
    const n = Math.max(1, Math.min(3, Math.round(score || 1)));
    return `<span class="dots" aria-label="Intérêt ${n} sur 3">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
}

function renderFamilies() {
    const html = FAMILIES.map(f => {
        const list = FACTS[f.key] || [];
        const facts = list.filter(x => !x.note);
        const notes = list.filter(x => x.note).map(x => `<p class="empty">${esc(x.note)}</p>`).join('');
        const radio = f.key === 'suivre';
        const rows = facts.map(x => `<label class="fact">
                <input type="${radio ? 'radio' : 'checkbox'}" name="${radio ? 'suivre' : 'fait'}" value="${esc(x.id)}">
                <span><span class="fact-title">${esc(x.title)}</span><span class="fact-detail">${esc(x.detail)}</span></span>
                ${dots(x.score)}
            </label>`).join('');
        return `<section class="family">
            <div class="family-head"><span class="tag" style="--c:${f.c};--b:${f.b}">${esc(f.label)}</span><span class="hint">${esc(f.hint)}</span></div>
            ${rows || notes || '<p class="empty">Rien de marquant cette semaine.</p>'}
        </section>`;
    }).join('');

    const pseudoOptions = M.players.map(p => `<option value="${esc(p.id)}">${esc(p.pseudo)}</option>`).join('');
    const teamOptions = TEAMS.map(t => `<option value="${esc(t.key)}">${esc(t.name)}</option>`).join('');
    const nbaOptions = (D.players || []).map(p => `<option value="${esc(p.name)}"></option>`).join('');
    $('families').innerHTML = html + `<section class="family libre">
        <div class="family-head"><span class="tag" style="--c:#e8e7e4;--b:rgba(255,255,255,0.08)">Fait libre</span><span class="hint">compte comme un des 2 faits</span></div>
        <label class="check"><input type="checkbox" id="libre-on"> Utiliser ce fait libre</label>
        <div class="row">
            <label class="field">Étiquette<input type="text" id="libre-tag" value="Le fait de la semaine" maxlength="40"></label>
            <label class="field" style="flex-basis:320px">Titre<input type="text" id="libre-title" maxlength="70" placeholder="Ex. : Greg a encore oublié que Boston jouait sans Tatum"></label>
        </div>
        <label class="field">Détail (facultatif)<input type="text" id="libre-detail" maxlength="110"></label>
        <div class="row">
            <label class="field">Visuel<select id="libre-kind"><option value="none">Aucun</option><option value="airball">Joueur Airball</option><option value="nba">Joueur NBA</option><option value="team">Équipe</option></select></label>
            <label class="field" id="libre-airball-f" hidden>Joueur Airball<select id="libre-airball">${pseudoOptions}</select></label>
            <label class="field" id="libre-nba-f" hidden>Joueur NBA<input type="text" id="libre-nba" list="nba-names" placeholder="Nom du joueur"></label>
            <label class="field" id="libre-team-f" hidden>Équipe<select id="libre-team">${teamOptions}</select></label>
        </div>
        <datalist id="nba-names">${nbaOptions}</datalist>
    </section>`;

    $('families').addEventListener('change', onChange);
    $('families').addEventListener('input', e => { if (e.target.id && e.target.id.startsWith('libre-')) { syncLibre(); refresh(); } });
}

function libreFact() {
    const kind = $('libre-kind').value;
    const items = kind === 'airball' ? [M.byId[$('libre-airball').value]].filter(Boolean)
        : kind === 'nba' ? [$('libre-nba').value.trim()].filter(Boolean)
        : kind === 'team' ? [$('libre-team').value] : [];
    return { id: LIBRE_ID, family: 'libre', tag: $('libre-tag').value.trim() || 'Le fait de la semaine', title: $('libre-title').value.trim(), detail: $('libre-detail').value.trim(), visual: { kind: items.length ? kind : 'none', items } };
}
function syncLibre() {
    const kind = $('libre-kind').value;
    ['airball', 'nba', 'team'].forEach(k => { $(`libre-${k}-f`).hidden = kind !== k; });
}

function onChange(e) {
    const t = e.target;
    if (t.name === 'fait' || t.id === 'libre-on') {
        const id = t.id === 'libre-on' ? LIBRE_ID : t.value;
        const i = selected.indexOf(id);
        if (t.checked && i < 0) selected.push(id);
        if (!t.checked && i >= 0) selected.splice(i, 1);
    }
    if (t.name === 'suivre') suivreId = t.value;
    if (t.id === 'libre-kind') syncLibre();
    // 2 faits au plus : les autres cases se grisent
    const full = selected.length >= 2;
    document.querySelectorAll('input[name=fait]').forEach(box => { box.disabled = full && !box.checked; });
    $('libre-on').disabled = full && !$('libre-on').checked;
    refresh();
}

// Faits retenus, dans l'ordre de l'image, avec les textes retouchés
function chosen() {
    const facts = selected.map(id => (id === LIBRE_ID ? libreFact() : BY_ID[id])).filter(Boolean);
    if (suivreId && BY_ID[suivreId]) facts.push({ ...BY_ID[suivreId], suivre: true });
    return facts.map(f => ({ ...f, title: (edits[f.id] && edits[f.id].title != null) ? edits[f.id].title : f.title, detail: (edits[f.id] && edits[f.id].detail != null) ? edits[f.id].detail : f.detail }))
        .filter(f => f.title);
}

let slotsKey = '';
function renderSlots() {
    // On ne redessine les champs que si la sélection change (sinon le champ en cours de saisie perdrait le focus)
    const key = JSON.stringify([selected, suivreId]);
    if (key === slotsKey) return;
    slotsKey = key;
    const labels = ['Fait 1', 'Fait 2'];
    const factIds = selected.slice();
    const parts = [0, 1].map(i => {
        const id = factIds[i];
        if (!id) return `<div class="slot"><span class="slot-label">${labels[i]}</span><span class="slot-empty">Coche un fait${i === 1 ? ', ou utilise le fait libre' : ''}</span></div>`;
        if (id === LIBRE_ID) return `<div class="slot"><span class="slot-label">${labels[i]} · fait libre</span><span class="slot-empty">Se modifie dans le bloc « Fait libre »</span></div>`;
        return slotEditor(labels[i], BY_ID[id]);
    });
    parts.push(suivreId ? slotEditor('À suivre', BY_ID[suivreId]) : `<div class="slot"><span class="slot-label">À suivre</span><span class="slot-empty">Choisis un « À suivre »</span></div>`);
    $('slots').innerHTML = parts.join('');
    $('slots').querySelectorAll('input[data-id]').forEach(input => input.addEventListener('input', () => {
        const id = input.dataset.id;
        edits[id] = edits[id] || {};
        edits[id][input.dataset.field] = input.value;
        draw();
    }));
}
function slotEditor(label, f) {
    const e = edits[f.id] || {};
    return `<div class="slot"><span class="slot-label">${esc(label)} · retouche possible</span>
        <input type="text" data-id="${esc(f.id)}" data-field="title" value="${esc(e.title != null ? e.title : f.title)}" aria-label="${esc(label)} : titre">
        <input type="text" data-id="${esc(f.id)}" data-field="detail" value="${esc(e.detail != null ? e.detail : f.detail)}" aria-label="${esc(label)} : détail">
    </div>`;
}

function refresh() {
    renderSlots();
    draw();
    const ready = chosen().length > 0;
    $('download').disabled = !ready;
    $('copy').disabled = !ready;
}

function status(text, kind = '') { const s = $('status'); s.className = 'status' + (kind ? ' ' + kind : ''); s.textContent = text; }

// ==========================================
// 3. IMAGE (canvas 1080 x 1350)
// ==========================================
const imgCache = {};
function loadImage(src, cors) {
    const key = (cors ? 'c:' : '') + src;
    if (!imgCache[key]) {
        imgCache[key] = new Promise(resolve => {
            const img = new Image();
            if (cors) img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }
    return imgCache[key];
}

// Photo de profil : photo de démo (même site), sinon route ?page=avatar de Code.gs (photo Drive en base64)
const avatarCache = {};
function avatarImage(player) {
    if (!player) return Promise.resolve(null);
    const url = String(player.avatar || '');
    if (/^img\//.test(url)) return loadImage('../' + url, false);
    if (/^data:image/.test(url)) return loadImage(url, false);
    if (!/^http/.test(url)) return Promise.resolve(null);
    if (!avatarCache[player.id]) {
        avatarCache[player.id] = fetch(`${APPS_SCRIPT_URL}?page=avatar&id=${encodeURIComponent(player.id)}`)
            .then(r => r.json()).then(j => (j && j.data ? loadImage(j.data, false) : null)).catch(() => null);
    }
    return avatarCache[player.id];
}

// Maillot de jersey.js transformé en image, avec ses polices intégrées (une image SVG n'a pas accès aux polices de la page)
let jerseyFontsCss = null;
async function jerseyFonts() {
    if (jerseyFontsCss != null) return jerseyFontsCss;
    const toData = async (url, family, weight) => {
        try {
            const buf = await (await fetch(url)).arrayBuffer();
            let bin = '';
            new Uint8Array(buf).forEach(b => { bin += String.fromCharCode(b); });
            return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');}`;
        } catch (e) { return ''; }
    };
    jerseyFontsCss = (await toData('../fonts/Rokkitt-Medium.woff2', 'Rokkitt', 500)) + (await toData('../fonts/SairaExtraCondensed-Bold.woff2', 'Saira Extra Condensed', 700));
    return jerseyFontsCss;
}
async function jerseyImage(name) {
    const p = M.nbaPlayers[norm(name)];
    const svg = Jersey.svg(p ? p.team : null, { number: p ? p.num : '', className: 'j' });
    const css = await jerseyFonts();
    const full = svg.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="312" `)
        .replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`);
    return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(full), false);
}
const logoImage = key => { const t = Teams.find(key); return t ? loadImage(Teams.logoUrl(t), true) : Promise.resolve(null); };

// ---------- Dessin ----------
const C = { bg: '#0c0c0e', card1: '#15151a', card2: '#1b1b20', line: '#2d2c32', lime: '#dcff5f', grey: '#8e8d91', soft: '#9d9ca1', up: '#4afa41', down: '#fa5341', violet: '#a99bff', coral: '#f45d4f', ink: '#2f2d35' };
const AV_COLORS = ['#dcff5f', '#f87822', '#7fd1ff', '#f37567', '#63b78d', '#c9a7ff', '#ffd166', '#ff9ecb', '#9be7d8', '#e0c3a0'];
const avColor = player => { let h = 0; for (const c of String(player.pseudo || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; };
const initials = name => {
    const words = String(name || '?').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
};
const F = (weight, size, family = 'DM Sans') => `${weight} ${size}px '${family}', system-ui, sans-serif`;

function rrect(ctx, x, y, w, h, r) {
    const rr = typeof r === 'number' ? [r, r, r, r] : r;
    ctx.beginPath();
    ctx.moveTo(x + rr[0], y);
    ctx.lineTo(x + w - rr[1], y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr[1]);
    ctx.lineTo(x + w, y + h - rr[2]); ctx.quadraticCurveTo(x + w, y + h, x + w - rr[2], y + h);
    ctx.lineTo(x + rr[3], y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr[3]);
    ctx.lineTo(x, y + rr[0]); ctx.quadraticCurveTo(x, y, x + rr[0], y);
    ctx.closePath();
}
function cardFill(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, C.card1); g.addColorStop(1, C.card2);
    return g;
}
function wrap(ctx, text, width, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
        const test = line ? line + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width <= width || !line) { line = test; continue; }
        lines.push(line); line = words[i];
        if (lines.length === maxLines) { line = null; break; }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines || (line === null)) {
        lines.length = maxLines;
        let last = lines[maxLines - 1];
        while (last.length && ctx.measureText(last + '…').width > width) last = last.slice(0, -1).trimEnd();
        lines[maxLines - 1] = last + '…';
    }
    return lines;
}
function fitFont(ctx, text, width, weight, size, min, family) {
    let s = size;
    ctx.font = F(weight, s, family);
    while (s > min && ctx.measureText(text).width > width) { s -= 1; ctx.font = F(weight, s, family); }
    return s;
}
// Texte en morceaux de couleurs différentes, centré sur cx
function segments(ctx, parts, cx, y) {
    const total = parts.reduce((s, p) => { ctx.font = p.font; return s + ctx.measureText(p.text).width; }, 0);
    let x = cx - total / 2;
    parts.forEach(p => { ctx.font = p.font; ctx.fillStyle = p.color; ctx.fillText(p.text, x, y); x += ctx.measureText(p.text).width; });
}

function drawAvatar(ctx, player, img, cx, cy, size) {
    const r = size / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 32; ctx.shadowOffsetY = 12;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = avColor(player); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    if (img) {
        const s = Math.max(size / img.width, size / img.height);
        ctx.drawImage(img, cx - img.width * s / 2, cy - img.height * s / 2, img.width * s, img.height * s);
    } else {
        ctx.fillStyle = C.ink; ctx.font = F(900, Math.round(size * 0.34), 'Mattone');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initials(player.pseudo), cx, cy + size * 0.02);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r - Math.max(2, size / 60), 0, Math.PI * 2);
    ctx.lineWidth = Math.max(3, size / 30); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
}
function drawLogo(ctx, key, img, cx, cy, size) {
    const t = Teams.find(key);
    ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = img ? '#f4f3f0' : (t ? t.colors[0] : '#45434c'); ctx.fill();
    if (img) {
        const s = size * 0.76;
        ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
    } else if (t) {
        ctx.save();
        ctx.fillStyle = '#ffffff'; ctx.font = F(700, Math.round(size * 0.26));
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t.logo.toUpperCase(), cx, cy);
        ctx.restore();
    }
}

// Préparation des images d'un fait (avant de dessiner)
async function visualImages(v) {
    if (!v || !v.items || !v.items.length) return [];
    if (v.kind === 'airball') return Promise.all(v.items.map(avatarImage));
    if (v.kind === 'nba') return Promise.all(v.items.map(jerseyImage));
    if (v.kind === 'team') return Promise.all(v.items.map(logoImage));
    return [];
}
function visualWidth(v) {
    if (!v || !v.items || !v.items.length || v.kind === 'none') return 0;
    const two = v.items.length > 1;
    if (v.kind === 'nba') return two ? 64 * 2 + 10 : 80;
    return two ? 84 * 2 - 18 : 88;
}
function drawVisual(ctx, v, imgs, x, cy) {
    const two = v.items.length > 1;
    if (v.kind === 'nba') {
        const w = two ? 64 : 80, h = w * 1.56;
        v.items.slice(0, 2).forEach((name, i) => {
            const img = imgs[i];
            const xx = x + i * (w + 10);
            if (img) {
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
                ctx.drawImage(img, xx, cy - h / 2, w, h);
                ctx.restore();
            }
            if (v.duel) { // pastille violet / corail sous le maillot, comme les duels du site
                ctx.fillStyle = i === 0 ? C.violet : C.coral;
                rrect(ctx, xx + w * 0.3, cy + h / 2 + 6, w * 0.4, 5, 2.5); ctx.fill();
            }
        });
        return;
    }
    const size = two ? 84 : 88;
    v.items.slice(0, 2).forEach((item, i) => {
        const cx = x + size / 2 + i * (size - 18);
        if (v.kind === 'airball') drawAvatar(ctx, item, imgs[i], cx, cy, size);
        else drawLogo(ctx, item, imgs[i], cx, cy, size);
    });
}

let drawToken = 0;
async function draw() {
    const token = ++drawToken;
    const canvas = $('preview');
    const ctx = canvas.getContext('2d');
    const facts = chosen();
    const podium = (M.players || []).slice(0, 3);

    // Toutes les images d'abord (le dessin, lui, est instantané)
    const [podiumImgs, factImgs] = await Promise.all([
        Promise.all(podium.map(avatarImage)),
        Promise.all(facts.map(f => visualImages(f.visual)))
    ]);
    await document.fonts.ready;
    if (token !== drawToken) return; // un dessin plus récent a été demandé entre-temps

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'top';

    // En-tête
    const PX = 72;
    ctx.fillStyle = C.lime; ctx.font = F(700, 22);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2.6px';
    ctx.fillText(`AIRBALL · SEMAINE ${WEEK_NUMBER}`, PX, 60);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillStyle = '#ffffff'; ctx.font = F(900, 48, 'Mattone');
    ctx.fillText('LE RÉCAP DU LUNDI', PX, 96);
    ctx.fillStyle = C.grey; ctx.font = F(400, 22); ctx.textAlign = 'right';
    ctx.fillText(WEEK_LABEL, W - PX, 118);
    ctx.textAlign = 'left';

    // Podium : 2e, 1er, 3e
    const colW = (W - 2 * PX - 32) / 3;
    const bottom = 556;
    const spec = [
        { p: podium[1], img: podiumImgs[1], rank: 2, h: 120, fs: 44, av: 120, col: 0 },
        { p: podium[0], img: podiumImgs[0], rank: 1, h: 170, fs: 58, av: 150, col: 1, lime: true },
        { p: podium[2], img: podiumImgs[2], rank: 3, h: 90, fs: 38, av: 120, col: 2 }
    ];
    spec.forEach(s => {
        if (!s.p) return;
        const x = PX + s.col * (colW + 16), cx = x + colW / 2;
        const stepY = bottom - s.h;
        // Marche
        rrect(ctx, x, stepY, colW, s.h, [12, 12, 0, 0]);
        if (s.lime) { ctx.fillStyle = C.lime; ctx.fill(); }
        else { ctx.fillStyle = cardFill(ctx, x, stepY, colW, s.h); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.textAlign = 'center';
        ctx.fillStyle = s.lime ? C.bg : '#ffffff'; ctx.font = F(900, s.fs, 'Mattone');
        ctx.fillText(String(s.rank), cx, stepY + s.h / 2 - s.fs * 0.62);
        ctx.textAlign = 'left';
        const pts = `${num(s.p.total)} pts`;
        const ptsY = stepY + s.h / 2 + s.fs * 0.42;
        const mv = s.p.prevRank == null ? '' : s.p.delta > 0 ? `▲ ${s.p.delta}` : s.p.delta < 0 ? `▼ ${-s.p.delta}` : '=';
        const mvColor = s.lime ? C.bg : s.p.delta > 0 ? C.up : s.p.delta < 0 ? C.down : C.grey;
        segments(ctx, [
            { text: pts, font: F(s.lime ? 500 : 400, 21), color: s.lime ? C.bg : C.grey },
            ...(mv ? [{ text: '  ', font: F(400, 21), color: C.grey }, { text: mv, font: F(700, 21), color: mvColor }] : [])
        ], cx, ptsY);
        // Pseudo
        const nameY = stepY - 14 - 30;
        const fs = fitFont(ctx, s.p.pseudo, colW - 8, 700, 24, 15);
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
        ctx.fillText(s.p.pseudo, cx, nameY + (24 - fs) / 2);
        ctx.textAlign = 'left';
        // Photo
        drawAvatar(ctx, s.p, s.img, cx, nameY - 16 - s.av / 2, s.av);
    });

    // Cartes de faits
    const cardX = PX, cardW = W - 2 * PX;
    const top = bottom + 32, limit = FOOTER === 'C' ? H - 60 : H - 60 - 40;
    const layout = maxDetail => facts.map(f => {
        const vw = visualWidth(f.visual);
        const tx = 26 + (vw ? vw + 24 : 0);
        const tw = cardW - tx - 26;
        ctx.font = F(700, 27); const title = wrap(ctx, f.title, tw, 2);
        ctx.font = F(400, 19); const detail = f.detail ? wrap(ctx, f.detail, tw, maxDetail) : [];
        const textH = 30 + 10 + title.length * 34 + (detail.length ? 8 + detail.length * 26 : 0);
        const vh = f.visual && f.visual.kind === 'nba' ? (f.visual.items.length > 1 ? 64 : 80) * 1.56 + (f.visual.duel ? 12 : 0) : vw ? 88 : 0;
        return { f, vw, tx, title, detail, h: Math.max(textH, vh) + 44 };
    });
    let cards = layout(2);
    const totalH = list => list.reduce((s, c) => s + c.h, 0) + Math.max(0, list.length - 1) * 14;
    if (top + totalH(cards) > limit) cards = layout(1);
    // Place libre : on aère un peu (écart podium / cartes et entre les cartes)
    const spare = Math.max(0, limit - top - totalH(cards));
    const gap = 14 + Math.min(14, spare / (cards.length + 2));
    let y = top + Math.min(28, spare / 4);
    cards.forEach((c, i) => {
        const f = c.f;
        rrect(ctx, cardX, y, cardW, c.h, 16);
        if (f.suivre) { ctx.fillStyle = 'rgba(220,255,95,0.06)'; ctx.fill(); ctx.strokeStyle = 'rgba(220,255,95,0.35)'; }
        else { ctx.fillStyle = cardFill(ctx, cardX, y, cardW, c.h); ctx.fill(); ctx.strokeStyle = C.line; }
        ctx.lineWidth = 1.5; ctx.stroke();
        if (c.vw) drawVisual(ctx, f.visual, factImgs[i] || [], cardX + 26, y + c.h / 2);
        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        // Étiquette
        const fam = f.suivre ? FAMILY.suivre : FAMILY[f.family] || { c: '#e8e7e4', b: 'rgba(255,255,255,0.08)' };
        const tag = f.tag || (FAMILY[f.family] || {}).label || '';
        let ty = y + 22;
        ctx.font = F(700, 17);
        const tagW = ctx.measureText(tag).width + 28;
        rrect(ctx, cardX + c.tx, ty, tagW, 30, 15); ctx.fillStyle = fam.b; ctx.fill();
        ctx.fillStyle = fam.c; ctx.fillText(tag, cardX + c.tx + 14, ty + 5);
        ty += 40;
        ctx.fillStyle = '#ffffff'; ctx.font = F(700, 27);
        c.title.forEach(line => { ctx.fillText(line, cardX + c.tx, ty); ty += 34; });
        if (c.detail.length) {
            ty += 8; ctx.fillStyle = f.suivre ? '#c5c4c8' : C.soft; ctx.font = F(400, 19);
            c.detail.forEach(line => { ctx.fillText(line, cardX + c.tx, ty); ty += 26; });
        }
        y += c.h + gap;
    });
    if (!facts.length) {
        ctx.fillStyle = C.grey; ctx.font = F(400, 22); ctx.textAlign = 'center';
        ctx.fillText('Coche des faits à gauche pour remplir l\'image', W / 2, top + 120);
        ctx.textAlign = 'left';
    }

    // Pied
    ctx.textBaseline = 'alphabetic';
    const footY = H - 60;
    if (FOOTER === 'A') {
        ctx.fillStyle = C.grey; ctx.font = F(400, 19);
        ctx.fillText('Le classement complet sur ', PX, footY);
        const fw = ctx.measureText('Le classement complet sur ').width;
        ctx.fillStyle = C.lime; ctx.font = F(700, 19);
        ctx.fillText(SITE_URL, PX + fw, footY);
    } else if (FOOTER === 'B') {
        ctx.fillStyle = C.grey; ctx.font = F(400, 19);
        ctx.fillText('Ta place et tes points : ', PX, footY);
        const fw = ctx.measureText('Ta place et tes points : ').width;
        ctx.fillStyle = C.lime; ctx.font = F(700, 19);
        ctx.fillText('lien dans le message', PX + fw, footY);
    }
}

// ---------- Téléchargement et texte du message ----------
function download() {
    const canvas = $('preview');
    try {
        canvas.toBlob(blob => {
            if (!blob) { status("Impossible de créer l'image.", 'bad'); return; }
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `airball-recap-semaine-${WEEK_NUMBER}.png`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            status('Image téléchargée.', 'ok');
        }, 'image/png');
    } catch (e) {
        console.error(e);
        status("Le navigateur bloque l'export (une image d'un autre site sans autorisation). Fais une capture de l'aperçu, et signale-le.", 'bad');
    }
}
// Légende WhatsApp : courte, un seul lien (cliquable dans WhatsApp), vers la suite de l'« À suivre ».
// ?r=recap : les visites venues du récap se repèrent dans GoatCounter.
function captionLink(fact) {
    const page = !fact ? '' : /^sv-(battle|match)/.test(fact.id) ? 'standings.html' : '';
    return `https://${SITE_URL}/${page}?r=recap`;
}
async function copyText() {
    const suivre = chosen().find(f => f.suivre);
    const lines = [
        `Le récap du lundi · semaine ${WEEK_NUMBER}`,
        suivre ? `À suivre · ${suivre.title}` : 'Ta place et tes points :',
        captionLink(suivre)
    ];
    try { await navigator.clipboard.writeText(lines.join('\n')); status("Légende copiée : colle-la dans « Ajouter une légende » en envoyant l'image.", 'ok'); }
    catch (e) { status('Copie impossible dans ce navigateur.', 'bad'); }
}

// ==========================================
// DÉMARRAGE
// ==========================================
(async function start() {
    draw();
    await loadAll();
    FACTS = computeFacts();
    Object.values(FACTS).flat().forEach(f => { if (!f.note) BY_ID[f.id] = f; });
    $('intro').textContent = `Semaine ${WEEK_NUMBER} (${WEEK_LABEL}). Coche 2 faits (ou 1 + le fait libre) et 1 « À suivre ». Les plus marquants sont en haut de chaque famille ; tu peux retoucher les textes à droite.`;
    $('sources').innerHTML = 'Sources : ' + sourceState.map(s => s.ok ? `<b>${esc(s.label)}</b>` : `<span class="ko" title="${esc(s.note)}">${esc(s.label)} (indisponible)</span>`).join(' · ')
        + (M.prev ? ` · comparé au relevé du ${frDate(M.prev.date)}` : '') + (Demo.active() ? ' · <span class="ko">mode démo : faux joueurs</span>' : '');
    renderFamilies();
    // Présélection : le fait le plus marquant de chaque famille principale et le meilleur « À suivre »
    const firstOf = key => (FACTS[key] || []).find(f => !f.note);
    const pre = ['air', 'groupe', 'stats', 'nba', 'awards', 'dur'].map(firstOf).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 2);
    pre.forEach(f => { const box = document.querySelector(`input[name=fait][value="${CSS.escape(f.id)}"]`); if (box) { box.checked = true; selected.push(f.id); } });
    const sv = firstOf('suivre');
    if (sv) { const r = document.querySelector(`input[name=suivre][value="${CSS.escape(sv.id)}"]`); if (r) { r.checked = true; suivreId = sv.id; } }
    document.querySelectorAll('input[name=fait]').forEach(box => { box.disabled = selected.length >= 2 && !box.checked; });
    $('libre-on').disabled = selected.length >= 2;
    refresh();
    $('download').addEventListener('click', download);
    $('copy').addEventListener('click', copyText);
})();
