// ==========================================
// STATS NBA & STANDINGS ESPN (page standings.html)
// Classements : même tableau que les pages Pronostics (en-têtes triables, coupures playoffs / play-in)
// Stats : top 3 en liste avec les moyennes · Awards : mini-podiums avec les maillots (2e · 1er · 3e)
// Dépend de : common.js (escapeHtml, STAT_KEYS, AWARD_KEYS, CATEGORY_LABELS), api.js (Api, Espn), teams.js (Teams), jersey.js (Jersey)
// ==========================================
const NBA = { standings: null, sort: null, roster: null };
const CHEVRON = '<svg class="pt-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
const normName = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// ---------- Classements des conférences ----------
const statOf = (entry, name) => (entry.stats || []).find(s => s.name === name);
const num = (entry, name) => { const s = statOf(entry, name); return s ? Number(s.value) : NaN; };
const shown = (entry, name, fallback = '—') => { const s = statOf(entry, name); return s && s.displayValue !== undefined && s.displayValue !== '' ? s.displayValue : fallback; };
const lastTenOf = entry => {
    const s = (entry.stats || []).find(st => st.type === 'lasttengames' || st.abbreviation === 'L10' || /last\s*ten/i.test(`${st.name} ${st.displayName}`));
    return s ? (s.summary || s.displayValue || '—') : '—';
};
const lastTenWins = entry => { const m = /^(\d+)-/.exec(lastTenOf(entry)); return m ? Number(m[1]) : null; };
const streakValue = entry => { const m = /^([WL])\s*(\d+)$/i.exec(shown(entry, 'streak', '')); return m ? (m[1].toUpperCase() === 'W' ? 1 : -1) * Number(m[2]) : null; };

// Ordre du 1er clic sur chaque colonne (1 = croissant), comme sur les pages Pronostics
const SORT_FIRST_DIR = { rank: 1, record: -1, l10: -1, streak: -1 };
function sortValue(col, row) {
    if (col === 'rank') return row.rank;
    if (col === 'record') return num(row.entry, 'winPercent');
    if (col === 'l10') return lastTenWins(row.entry);
    if (col === 'streak') return streakValue(row.entry);
    return null;
}
function sortTh(col, label, cls = '', title = '') {
    const sort = NBA.sort || { col: 'rank', dir: 1 };
    const active = sort.col === col;
    const aria = active ? ` aria-sort="${sort.dir > 0 ? 'ascending' : 'descending'}"` : '';
    const st = active ? (sort.dir > 0 ? ' is-asc' : ' is-desc') : '';
    return `<th class="${cls} is-sortable${st}"${aria}${title ? ` title="${title}"` : ''}><button type="button" class="pt-sort" data-sort="${col}">${label}${CHEVRON}</button></th>`;
}
const streakPill = entry => {
    const v = shown(entry, 'streak', '');
    return v ? `<span class="nba-streak ${/^w/i.test(v) ? 'is-w' : 'is-l'}">${escapeHtml(v)}</span>` : '—';
};

function conferenceTable(conf) {
    const { label, seasonType, entries } = NBA.standings[conf];
    let rows = entries.map((entry, i) => ({ entry, rank: i + 1 }));
    const sorted = NBA.sort && NBA.sort.col !== 'rank' || (NBA.sort && NBA.sort.dir < 0);
    if (NBA.sort) {
        const { col, dir } = NBA.sort;
        rows = [...rows].sort((x, y) => {
            const a = sortValue(col, x), b = sortValue(col, y);
            if (a === null || isNaN(a)) return 1;
            if (b === null || isNaN(b)) return -1;
            return (a - b) * dir || x.rank - y.rank;
        });
    }
    const body = rows.map((r, i) => {
        const e = r.entry;
        // Coupures playoffs / play-in : seulement dans l'ordre du classement
        const cut = !sorted ? (r.rank === 6 ? 'cut-playoffs' : r.rank === 10 ? 'cut-playin' : '') : '';
        const zone = r.rank <= 6 ? 'is-playoffs' : r.rank <= 10 ? 'is-playin' : '';
        return `<tr class="${cut} ${zone}">
            <td class="pt-rank">${r.rank}</td>
            <td class="pt-team"><span class="team-inline">${Teams.logoHtml(e.team.abbreviation || e.team.displayName)}<span class="team-name">${escapeHtml(e.team.displayName)}</span></span></td>
            <td class="pt-num">${escapeHtml(shown(e, 'wins', '0'))}-${escapeHtml(shown(e, 'losses', '0'))}</td>
            <td class="pt-num nba-pct">${escapeHtml(shown(e, 'winPercent', '.000'))}</td>
            <td class="pt-num nba-gb">${escapeHtml(shown(e, 'gamesBehind', '—'))}</td>
            <td class="pt-num pt-l10">${escapeHtml(lastTenOf(e))}</td>
            <td class="pt-num nba-streak-col">${streakPill(e)}</td>
        </tr>`;
    }).join('');
    const season = label ? `${seasonType === 1 ? 'Présaison' : 'Saison régulière'} ${escapeHtml(label)}` : 'En direct · ESPN';
    return `<div class="nba-head"><h3 class="pt-title">Conférence ${conf === 'east' ? 'Est' : 'Ouest'}</h3><span>${season}</span></div>
        <div class="table-responsive"><table class="pt-table nba-table" aria-label="Conférence ${conf === 'east' ? 'Est' : 'Ouest'}">
            <thead><tr class="pt-labels">
                ${sortTh('rank', 'Rk', 'pt-rank')}
                <th class="pt-team">Équipe</th>
                ${sortTh('record', 'Bilan', 'pt-num', 'Victoires-défaites')}
                <th class="pt-num nba-pct">%</th>
                <th class="pt-num nba-gb" title="Matchs de retard sur le 1er">Retard</th>
                ${sortTh('l10', 'L10', 'pt-num pt-l10', 'Bilan des 10 derniers matchs')}
                ${sortTh('streak', 'Streak', 'pt-num nba-streak-col', 'Série en cours')}
            </tr></thead>
            <tbody>${body}</tbody>
        </table></div>
        <ul class="pt-legend">
            <li><span class="pt-key pt-key--playoffs"></span>Qualifiées pour les playoffs (1 à 6)</li>
            <li><span class="pt-key pt-key--playin"></span>Play-in (7 à 10)</li>
        </ul>`;
}

function renderConferences() {
    if (!NBA.standings) return;
    ['east', 'west'].forEach(conf => { document.getElementById(`conf-${conf}`).innerHTML = conferenceTable(conf); });
}

async function fetchNBAStandings() {
    const hosts = { east: document.getElementById('conf-east'), west: document.getElementById('conf-west') };
    if (!hosts.east || !hosts.west) return;
    try {
        // On demande explicitement la SAISON RÉGULIÈRE en cours, sinon ESPN renvoie
        // la présaison ou la saison précédente selon la période de l'année.
        NBA.standings = await Espn.getStandings({ season: Espn.currentSeason(), seasonType: 2 })
            .catch(error => {
                console.warn("Saison régulière indisponible, classement ESPN par défaut :", error);
                return Espn.getStandings();
            });
        renderConferences();
    } catch (error) {
        console.error("Erreur lors de la récupération des classements NBA :", error);
        ['east', 'west'].forEach(conf => {
            hosts[conf].innerHTML = `<div class="nba-head"><h3 class="pt-title">Conférence ${conf === 'east' ? 'Est' : 'Ouest'}</h3></div>
                <p class="table-message table-message--error nba-error">Le classement n’a pas pu être chargé (${escapeHtml(error.message)}).</p>`;
        });
    }
}

function onSortClick(event) {
    const button = event.target.closest('.pt-sort');
    if (!button) return;
    const col = button.dataset.sort;
    const first = SORT_FIRST_DIR[col];
    const cur = NBA.sort;
    if (col === 'rank') NBA.sort = cur && cur.col === 'rank' ? null : { col, dir: -1 };
    else if (!cur || cur.col !== col) NBA.sort = { col, dir: first };
    else if (cur.dir === first) NBA.sort = { col, dir: -first };
    else NBA.sort = null; // 3e clic : retour au classement
    renderConferences();
    const again = event.currentTarget.querySelector(`.pt-sort[data-sort="${col}"]`);
    if (again) again.focus({ preventScroll: true });
}

// ---------- Stats & awards : mini-podiums avec les maillots ----------
async function loadRoster() {
    if (NBA.roster) return NBA.roster;
    try {
        const [players, coaches] = await Promise.all(['players.json', 'coaches.json'].map(f => fetch(f).then(r => r.ok ? r.json() : [])));
        const roster = {};
        players.forEach(p => { roster[normName(p.name)] = { team: p.team, num: p.num || '' }; });
        coaches.forEach(c => { roster[normName(c.name)] = { team: c.team, coach: true }; });
        NBA.roster = roster;
    } catch (e) {
        console.warn('Listes des joueurs et coachs indisponibles :', e);
        NBA.roster = {};
    }
    return NBA.roster;
}

function jerseyOf(name) {
    const info = (NBA.roster || {})[normName(name)];
    if (!name || typeof Jersey === 'undefined') return '<span class="pd-empty" aria-hidden="true"></span>';
    if (!info) return Jersey.svg('', { className: 'pd-jersey' });
    return info.coach ? Jersey.coach(info.team, { className: 'pd-jersey' }) : Jersey.svg(info.team, { className: 'pd-jersey', number: info.num });
}

// 2e à gauche, 1er au centre (plus grand), 3e à droite : comme le podium de la Home
function podiumCard(key, picks) {
    const list = picks || [];
    const place = i => `<div class="pd-p is-${i + 1}">
            ${jerseyOf(list[i])}
            <b>${list[i] ? escapeHtml(list[i]) : '—'}</b>
            <span class="pd-tag">${i === 0 ? '1er' : `${i + 1}e`}</span>
        </div>`;
    return `<article class="pd-card"><h4>${escapeHtml(CATEGORY_LABELS[key] || key)}</h4>
        <div class="pd-row">${[1, 0, 2].map(place).join('')}</div></article>`;
}

// Stats : top 3 en liste (rang, maillot, joueur et équipe, moyenne par match à droite)
function statsCard(key, picks, values) {
    const list = picks || [], vals = values || [];
    const teamOf = name => { const info = (NBA.roster || {})[normName(String(name).split(' / ')[0])]; const t = info && Teams.find(info.team); return t ? t.name : ''; };
    const row = i => {
        const name = list[i] || '';
        const tie = name.includes(' / ');
        return `<div class="st-row is-${i + 1}">
            <span class="pd-tag">${i === 0 ? '1er' : `${i + 1}e`}</span>
            <span class="st-jersey">${jerseyOf(name.split(' / ')[0])}</span>
            <span class="st-who"><b>${name ? escapeHtml(name) : '—'}</b><small>${tie ? 'Ex æquo' : escapeHtml(teamOf(name))}</small></span>
            <span class="st-val">${vals[i] ? escapeHtml(String(vals[i]).replace('.', ',')) : ''}</span>
        </div>`;
    };
    return `<article class="pd-card st-card"><h4>${escapeHtml(CATEGORY_LABELS[key] || key)}<small>par match</small></h4>${[0, 1, 2].map(row).join('')}</article>`;
}

// ---------- Awards sans favoris réels (début de saison) ----------
// Pronos révélés : pour chaque trophée, le pick n°1 le plus choisi par les joueurs d'Airball (« Choix du groupe »).
// Pronos encore cachés : un seul bloc illustré « Les awards se jouent en avril ».
function groupChoice(players, key) {
    const counts = {};
    let total = 0;
    players.forEach(p => {
        const pick = String(((p.awards || {})[key] || [])[0] || '').trim();
        if (!pick) return;
        total++;
        const k = normName(pick);
        (counts[k] = counts[k] || { name: pick, n: 0 }).n++;
    });
    const list = Object.values(counts).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    if (!list.length) return null;
    const tied = list.filter(x => x.n === list[0].n);
    return { names: tied.map(x => x.name), n: list[0].n, total };
}
function groupCard(key, choice) {
    if (!choice) return `<article class="pd-card pd-group"><h4>${escapeHtml(CATEGORY_LABELS[key] || key)}</h4><p class="pd-group-sub">Aucun pick pour ce trophée.</p></article>`;
    const [first, ...others] = choice.names;
    return `<article class="pd-card pd-group"><h4>${escapeHtml(CATEGORY_LABELS[key] || key)}</h4>
        <div class="pd-group-row">${jerseyOf(first)}
            <div><b>${escapeHtml(first)}${others.length ? ` <small>et ${others.map(escapeHtml).join(', ')}</small>` : ''}</b>
            <span class="pd-group-sub">${choice.n} joueur${choice.n > 1 ? 's' : ''} sur ${choice.total} l'${choice.n > 1 ? 'ont' : 'a'} mis en pick 1${others.length ? ' (ex æquo)' : ''}</span></div>
        </div></article>`;
}
const AWARDS_WAIT = () => `<div class="pd-wait"><div>
        <h4>Les awards se jouent en avril</h4>
        <p>Il faut une bonne trentaine de matchs pour que les favoris se dessinent. Les premières tendances arriveront dans quelques semaines, et les trophées seront remis à la fin de la saison régulière.</p>
        <div class="pd-wait-chips">${AWARD_KEYS.map(k => `<span>🏆 ${escapeHtml(CATEGORY_LABELS[k] || k)}</span>`).join('')}</div>
    </div><img src="img/illustrations/couronne.svg" alt="" aria-hidden="true"></div>`;

async function renderAwards(host, awards) {
    const filled = AWARD_KEYS.filter(k => String(((awards || {})[k] || [])[0] || '').trim());
    // Au moins un favori réel : podiums (et « choix du groupe » pour les trophées encore vides)
    let pronos = null;
    if (filled.length < AWARD_KEYS.length) {
        try { pronos = await Api.getPronos(); } catch (e) { pronos = null; }
    }
    const players = pronos && pronos.revealed && Array.isArray(pronos.players) ? pronos.players : null;
    const sub = document.getElementById('awards-sub');
    if (!filled.length && !players) {
        host.classList.add('is-wait');
        host.innerHTML = AWARDS_WAIT();
        if (sub) sub.textContent = 'Favoris actuels pour chaque trophée';
        return;
    }
    host.classList.remove('is-wait');
    const intro = filled.length < AWARD_KEYS.length && players
        ? `<p class="pd-group-intro"><span>Choix du groupe</span>En attendant les vrais favoris : le pick n°1 le plus choisi par les joueurs d'Airball.</p>` : '';
    host.innerHTML = intro + AWARD_KEYS.map(k => filled.includes(k) ? podiumCard(k, awards[k]) : (players ? groupCard(k, groupChoice(players, k)) : podiumCard(k, []))).join('');
}

async function fetchNbaDataStatsAwards() {
    const statsHost = document.getElementById('nba-stats');
    const awardsHost = document.getElementById('nba-awards');
    if (!statsHost && !awardsHost) return;
    try {
        const [data] = await Promise.all([Api.getNbaData(), loadRoster()]);
        if (!data.stats || !data.awards) {
            console.error("Réponse 'nba-data' reçue mais sans 'stats'/'awards' :", data);
            throw new Error("format de réponse inattendu (plus de 'stats'/'awards')");
        }
        // Date de la dernière mise à jour des stats (outil maj-stats) : « Meneurs actuels · au 20 oct. »
        const sub = document.getElementById('stats-sub');
        if (sub && data.statsUpdatedAt) {
            const d = new Date(data.statsUpdatedAt);
            if (!isNaN(d)) sub.textContent = `Meneurs actuels · au ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
        }
        if (statsHost) statsHost.innerHTML = STAT_KEYS.map(k => statsCard(k, data.stats[k], (data.statsValues || {})[k])).join('');
        if (awardsHost) await renderAwards(awardsHost, data.awards);
    } catch (error) {
        console.error("Erreur lors du chargement de NBA DATA :", error);
        const message = `<p class="table-message table-message--error">Les données n’ont pas pu être chargées (${escapeHtml(error.message)}).</p>`;
        if (statsHost) statsHost.innerHTML = message;
        if (awardsHost) awardsHost.innerHTML = message;
    }
}

Api.onUpdate('nba-data', fetchNbaDataStatsAwards);

document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.nba-confs').addEventListener('click', onSortClick);
    fetchNBAStandings();
    fetchNbaDataStatsAwards();
});
