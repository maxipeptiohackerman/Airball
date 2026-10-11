// ==========================================
// REVEAL DES PRONOS (reveal.html)
// ==========================================
// Le Google Sheet n'envoie les pronos qu'une fois le reveal lancé (case « Lancer le reveal »
// de l'onglet CONFIG, inscriptions closes) ou à partir du lancement de la saison.
// Aperçu pour l'organisateur avant le lancement : reveal.html?cle=<REVEAL_PREVIEW_KEY du script>
//
// Chacun regarde à son rythme : pause, retour, chapitres. Rien n'est synchronisé.

// ---------- équipes (js/teams.js : noms des en-têtes du formulaire) ----------
const CONF_TEAMS = {
    east: Teams.conference('east').map(team => team.key),
    west: Teams.conference('west').map(team => team.key)
};
const CONF_LABEL = { east: 'Conférence Est', west: 'Conférence Ouest' };
const N = 15;

const STAT_CATS = [['pts', 'Meilleur marqueur'], ['reb', 'Meilleur rebondeur'], ['ast', 'Meilleur passeur'], ['stl', 'Meilleur intercepteur'], ['blk', 'Meilleur contreur']];
const AWARD_CATS = [['mvp', 'MVP'], ['coy', 'Coach de l’année'], ['roy', 'Rookie de l’année'], ['mip', 'Meilleure progression'], ['dpoy', 'Défenseur de l’année'], ['sixth', '6e homme']];

const AVATAR_COLORS = ['#dcff5f', '#f87822', '#7fd1ff', '#f37567', '#63b78d', '#c9a7ff', '#ffd166', '#ff9ecb', '#9be7d8', '#e0c3a0'];

// ---------- textes du chambrage ----------
const HOT_LINES_UP = ['Courageux ou inconscient ?', 'Quelqu’un a vu leur roster ?', 'Le flair du siècle, ou la blague de la saison.', 'Prophète ou supporter caché ?'];
const HOT_LINES_DOWN = ['Rancune personnelle ?', 'Il leur en veut pour quelque chose, c’est sûr.', 'Audacieux. Très audacieux.', 'On notera la date, au cas où.'];

// ---------- utilitaires ----------
const $ = id => document.getElementById(id);
const esc = v => String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ordinal = n => n === 1 ? '1<sup>re</sup>' : `${n}<sup>e</sup>`;
const ordinalText = n => n === 1 ? '1re' : `${n}e`;
const initials = name => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const normName = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Logo dans une pastille claire (style du reveal) ; même image que sur le reste du site.
// Le sigle n'apparaît que si le logo ne se charge pas.
function logo(key, size = '') {
    const team = Teams.find(key);
    const code = team ? team.logo : '';
    return `<span class="logo${size ? ' logo--' + size : ''}" aria-hidden="true"><span class="logo-txt"${team ? ' hidden' : ''}>${esc(code.toUpperCase() || '?')}</span>${team ? `<img src="${Teams.logoUrl(team)}" alt="" onerror="this.previousElementSibling.hidden = false; this.remove()">` : ''}</span>`;
}
const dotContent = p => p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : esc(p.name[0].toUpperCase());
const avatar = (p, i) => `<span class="av" style="animation-delay:${0.25 + i * 0.07}s"><span class="av-dot" style="--a:${p.color}">${dotContent(p)}</span>${esc(p.name)}</span>`;
const bigAvatar = p => `<span class="big-av" style="--a:${p.color}" aria-hidden="true">${dotContent(p)}</span>`;

const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>';

// Illustration « flammes + ballon », trait noir épais façon dessin
const OUT = 'stroke="#1a1416" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const FLAME_OUTER = 'M58 6 C62 22 74 30 78 44 C82 34 80 26 76 18 C92 30 100 50 96 66 C102 62 106 54 106 46 C116 62 114 84 102 98 L18 98 C6 84 6 64 16 52 C16 60 20 66 26 68 C22 52 30 40 40 32 C40 42 44 48 48 50 C44 36 50 20 58 6 Z';
const FLAME_INNER = 'M64 40 C68 54 82 58 82 76 C86 72 88 66 87 60 C96 72 94 90 86 100 L38 100 C30 92 30 78 38 70 C38 76 42 80 46 80 C42 66 52 54 56 46 C58 54 62 52 64 40 Z';
const SPARKS = `<path d="M28 18 C32 25 32 31 28 33 C24 31 24 25 28 18 Z" fill="#f6b546" ${OUT}/><path d="M100 14 C106 17 108 23 105 28" fill="none" stroke="#f6b546" stroke-width="4" stroke-linecap="round"/><path d="M12 40 C9 46 10 52 14 55" fill="none" stroke="#f6b546" stroke-width="4" stroke-linecap="round"/>`;
function flames(withBall) {
    const ball = withBall ? `<circle cx="60" cy="114" r="32" fill="#f39a3b" ${OUT}/><path d="M60 82 V146 M28 112 C44 108 76 108 92 112 M39 89 C51 100 51 126 39 139 M81 89 C69 100 69 126 81 139" fill="none" ${OUT} stroke-width="2.4"/>` : '';
    return `<svg class="${withBall ? 'flames-big' : 'flames'}" viewBox="0 0 120 ${withBall ? 150 : 104}" aria-hidden="true"><path d="${FLAME_OUTER}" fill="#a3203a" ${OUT}/><path d="${FLAME_INNER}" fill="#f6b546" ${OUT}/>${withBall ? SPARKS : ''}${ball}</svg>`;
}
const MINI_FLAME = `<svg viewBox="0 0 120 104" aria-hidden="true"><path d="${FLAME_OUTER}" fill="#a3203a" ${OUT} stroke-width="8"/><path d="${FLAME_INNER}" fill="#fff2e6" ${OUT} stroke-width="8"/></svg>`;

// ==========================================
// CALCULS À PARTIR DES PRONOS
// ==========================================
function buildModel(data, lastSeason) {
    const players = (data.players || [])
        .filter(p => Object.keys(p.east || {}).length || Object.keys(p.west || {}).length)
        .map((p, i) => ({
            name: String(p.pseudo || 'Joueur').trim(),
            avatar: p.avatar || '',
            color: AVATAR_COLORS[i % AVATAR_COLORS.length],
            ranks: { east: p.east || {}, west: p.west || {} },
            stats: p.stats || {},
            awards: p.awards || {}
        }));

    const rankOf = (p, conf, team) => Number(p.ranks[conf][team]) || 0;
    const teamAt = (p, conf, place) => CONF_TEAMS[conf].find(t => rankOf(p, conf, t) === place);

    const avgRank = { east: {}, west: {} };
    ['east', 'west'].forEach(conf => CONF_TEAMS[conf].forEach(team => {
        const ranks = players.map(p => rankOf(p, conf, team)).filter(Boolean);
        avgRank[conf][team] = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 99;
    }));

    function picksAt(conf, place) {
        const byTeam = {};
        players.forEach(p => { const t = teamAt(p, conf, place); if (t) (byTeam[t] = byTeam[t] || []).push(p); });
        return Object.entries(byTeam).map(([team, who]) => ({ team, who }))
            .sort((a, b) => b.who.length - a.who.length || avgRank[conf][a.team] - avgRank[conf][b.team]);
    }

    // Hot takes : pronos isolés les plus éloignés du reste du groupe (jusqu'à 5, dès 2,5 places d'écart)
    const candidates = [];
    if (players.length >= 3) {
        ['east', 'west'].forEach(conf => {
            for (let place = 1; place <= N; place++) {
                picksAt(conf, place).forEach(({ team, who }) => {
                    if (who.length !== 1) return;
                    const others = players.filter(p => p !== who[0]).map(p => rankOf(p, conf, team)).filter(Boolean);
                    if (!others.length) return;
                    const avg = others.reduce((a, b) => a + b, 0) / others.length;
                    const gap = avg - place;
                    if (Math.abs(gap) >= 2.5) candidates.push({ conf, team, who: who[0], place, avg: Math.round(avg), gap });
                });
            }
        });
    }
    const hotTakes = candidates.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 5);
    const hotAt = (conf, place, team) => hotTakes.find(h => h.conf === conf && h.place === place && h.team === team);
    const hotLine = (h, i) => (h.gap > 0 ? HOT_LINES_UP : HOT_LINES_DOWN)[i % 4];

    // Compatibilité : écart total entre deux classements (Est + Ouest), 100 % = identiques
    const MAX_DIST = 2 * Math.floor(N * N / 2);
    function similarity(a, b) {
        let dist = 0;
        ['east', 'west'].forEach(conf => CONF_TEAMS[conf].forEach(team => {
            const ra = a.ranks[conf][team], rb = b.ranks[conf][team];
            if (ra && rb) dist += Math.abs(ra - rb);
        }));
        return Math.max(0, Math.round((1 - dist / MAX_DIST) * 100));
    }
    const pairs = [];
    players.forEach((a, i) => players.slice(i + 1).forEach(b => pairs.push({ a, b, pct: similarity(a, b) })));
    pairs.sort((x, y) => y.pct - x.pct);
    const consensus = { ranks: { east: {}, west: {} } };
    ['east', 'west'].forEach(conf => {
        [...CONF_TEAMS[conf]].sort((x, y) => avgRank[conf][x] - avgRank[conf][y]).forEach((t, i) => { consensus.ranks[conf][t] = i + 1; });
    });
    const loner = players.length >= 3 ? [...players].sort((a, b) => similarity(a, consensus) - similarity(b, consensus))[0] : null;

    // Par rapport à la saison passée (classement ESPN), si disponible
    let rise = null, fall = null;
    if (lastSeason) {
        const moves = [];
        players.forEach(p => ['east', 'west'].forEach(conf => CONF_TEAMS[conf].forEach(team => {
            const place = rankOf(p, conf, team), last = lastSeason[conf][team];
            if (place && last) moves.push({ who: p, conf, team, place, last, delta: last - place });
        })));
        if (moves.length) {
            rise = [...moves].sort((a, b) => b.delta - a.delta)[0];
            fall = [...moves].sort((a, b) => a.delta - b.delta)[0];
            if (rise.delta <= 0) rise = null;
            if (fall.delta >= 0) fall = null;
        }
    }

    // Stats & awards : le pick n°1 de chacun, regroupé
    function firstPicks(group, key) {
        const byName = {};
        players.forEach(p => {
            const pick = String(((p[group] || {})[key] || [])[0] || '').trim();
            if (!pick) return;
            const k = normName(pick);
            (byName[k] = byName[k] || { name: pick, who: [] }).who.push(p);
        });
        return Object.values(byName).sort((a, b) => b.who.length - a.who.length || a.name.localeCompare(b.name));
    }

    // Les 2e et 3e choix, résumés en une ligne : qui revient le plus souvent
    function otherPicks(group, key) {
        const byName = {};
        players.forEach(p => {
            ((p[group] || {})[key] || []).slice(1, 3).forEach(raw => {
                const pick = String(raw || '').trim();
                if (!pick) return;
                const k = normName(pick);
                (byName[k] = byName[k] || { name: pick, count: 0 }).count += 1;
            });
        });
        return Object.values(byName).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }

    return {
        players, picksAt, hotTakes, hotAt, hotLine, otherPicks,
        twins: pairs[0] || null,
        rivals: pairs.length > 1 ? pairs[pairs.length - 1] : null,
        loner, lonerPct: loner ? similarity(loner, consensus) : 0,
        rise, fall, firstPicks
    };
}

// Classement final de la saison passée chez ESPN : { east: { Hawks: 3, ... }, west: { ... } }, ou null
async function fetchLastSeason() {
    try {
        const standings = await Espn.getStandings({ season: Espn.currentSeason() - 1, seasonType: 2, timeoutMs: 7000 });
        const result = { east: {}, west: {} };
        ['east', 'west'].forEach(conf => standings[conf].entries.forEach((entry, i) => {
            const team = Teams.find((entry.team || {}).abbreviation) || Teams.find((entry.team || {}).displayName);
            if (team) result[conf][team.key] = i + 1;
        }));
        return Object.keys(result.east).length && Object.keys(result.west).length ? result : null;
    } catch (error) {
        console.warn('Classement de la saison passée indisponible (chapitre ignoré) :', error);
        return null;
    }
}

// ==========================================
// ÉCRANS
// ==========================================
function makeSlides(M) {
    const nPlayers = M.players.length;

    const board = (conf, revealedDownTo, current, full) => {
        let html = '';
        for (let place = 1; place <= N; place++) {
            const cells = place >= revealedDownTo
                ? M.picksAt(conf, place).map(({ team, who }) => `<span class="chip" title="${esc(team)} : ${esc(who.map(p => p.name).join(', '))}">${logo(team, 'sm')}×${who.length}</span>`).join('')
                : '<span class="row-empty"></span>';
            html += `<li class="row${place === current ? ' is-current' : ''}"><span class="row-rank">${place}</span><span class="row-cells">${cells}</span></li>`;
        }
        return `<div class="board${full ? ' board--full' : ''}"><ol class="board-list">${html}</ol></div>`;
    };

    const card = (kicker, title, sub) => () => `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">${kicker}</p>
            <h2 class="title reveal-2">${title}</h2>
            ${sub ? `<p class="sub reveal-3">${sub}</p>` : ''}
        </div></div>`;

    const place = (conf, n) => () => {
        const list = M.picksAt(conf, n);
        return `
        <div class="slide"><div class="place">
            <div>
                <div class="place-head"><p class="mega">${ordinal(n)}</p><p class="kicker" style="margin-bottom:12px">${CONF_LABEL[conf]}</p></div>
                <div class="picks is-dense">
                ${list.map(({ team, who }, i) => {
                    const solo = who.length === 1;
                    const hot = solo && M.hotAt(conf, n, team);
                    const meta = who.length === nPlayers ? 'Unanimité'
                        : hot ? 'Seul contre tous'
                        : solo ? 'Seul à y croire'
                        : i === 0 ? 'Choix du groupe'
                        : `${who.length} joueurs`;
                    const take = hot ? `<span class="pick-take">Le reste du groupe les voit ${ordinalText(hot.avg)}. ${M.hotLine(hot, M.hotTakes.indexOf(hot))}</span>` : '';
                    return `
                    <div class="pick${hot ? ' is-hot' : ''}" style="animation-delay:${0.15 + i * 0.12}s">
                        ${hot ? `<span class="hot-pill">${MINI_FLAME}Hot take</span><span class="hot-logo">${flames(false)}${logo(team)}</span>` : logo(team)}
                        <div class="pick-team">
                            <span class="pick-name">${esc(team)}</span>
                            <span class="pick-meta">${meta}</span>
                            ${take}
                            <div class="avatars">${who.map(avatar).join('')}</div>
                        </div>
                        <span class="pick-count">${who.length}</span>
                    </div>`;
                }).join('')}
                </div>
            </div>
            ${board(conf, n, n)}
        </div></div>`;
    };

    const tease = conf => () => `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">${CONF_LABEL[conf]}</p>
            <h2 class="title reveal-1">Et à la<br>1re place…</h2>
            <div class="dots reveal-2" aria-hidden="true"><span></span><span></span><span></span></div>
        </div></div>`;

    const recap = conf => () => `
        <div class="slide"><div class="stack">
            <p class="kicker">Récap · ${CONF_LABEL[conf]}</p>
            <h2 class="title" style="font-size:clamp(28px,4vw,44px)">Vos 15 places</h2>
            ${board(conf, 1, 0, true)}
        </div></div>`;

    const hot = i => () => {
        const h = M.hotTakes[i];
        return `
        <div class="slide slide--center">
            <span class="slide-pill reveal-1">${MINI_FLAME}Hot take #${i + 1}</span>
            <div class="stack">
                <p class="kicker reveal-1">Seul contre tous · ${CONF_LABEL[h.conf]}</p>
                <div class="hot-figure reveal-2">
                    ${logo(h.team, 'xl')}
                    <p class="mega">${ordinal(h.place)}</p>
                    <div class="hot-art">${flames(true)}</div>
                </div>
                <p class="line reveal-3"><strong>${esc(h.who.name)}</strong> met les ${esc(h.team)} ${ordinalText(h.place)}. Le reste du groupe les voit ${ordinalText(h.avg)}.</p>
                <p class="title reveal-4" style="font-size:clamp(24px,3.6vw,40px)">${M.hotLine(h, i)}</p>
            </div>
        </div>`;
    };

    const noHot = () => `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">Hot takes</p>
            <h2 class="title reveal-2">Zéro<br>hot take</h2>
            <p class="line reveal-3">${nPlayers} joueurs, aucune prise de risque. Vous avez tous lu le même article de présaison ?</p>
        </div></div>`;

    const move = kind => () => {
        const m = kind === 'rise' ? M.rise : M.fall, up = kind === 'rise', n = Math.abs(m.delta);
        return `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">Par rapport à la saison passée</p>
            <h2 class="title reveal-1">${up ? 'La remontada' : 'La chute libre'}</h2>
            <div class="row-flex reveal-2">${logo(m.team, 'xl')}<p class="mega">${up ? '+' : '−'}${n}</p></div>
            <p class="line reveal-3"><strong>${esc(m.who.name)}</strong> met les ${esc(m.team)} ${ordinalText(m.place)}. L'an dernier : ${ordinalText(m.last)}.</p>
            <p class="line reveal-4">${up ? `${n} places de mieux, rien que ça. ${esc(m.who.name)} sait quelque chose qu’on ignore ?` : `${n} places de moins. ${esc(m.who.name)} a parié contre eux ou quoi ?`}</p>
        </div></div>`;
    };

    const category = (group, key, label, chapterLabel) => () => {
        const list = M.firstPicks(group, key);
        return `
        <div class="slide"><div class="stack" style="max-width:1000px">
            <p class="kicker">${chapterLabel} · le pick n°1 de chacun</p>
            <h2 class="title" style="font-size:clamp(30px,5vw,60px)">${label}</h2>
            <div class="picks is-dense">
            ${list.map(({ name, who }, i) => `
                <div class="pick" style="animation-delay:${0.15 + i * 0.12}s">
                    <span class="pick-who" aria-hidden="true">${esc(initials(name))}</span>
                    <div class="pick-team">
                        <span class="pick-name">${esc(name)}</span>
                        <span class="pick-meta">${who.length === nPlayers ? 'Unanimité' : who.length === 1 ? 'Seul à y croire' : i === 0 ? 'Choix du groupe' : `${who.length} joueurs`}</span>
                        <div class="avatars">${who.map(avatar).join('')}</div>
                    </div>
                    <span class="pick-count">${who.length}</span>
                </div>`).join('')}
            </div>
            ${(() => {
                const others = M.otherPicks(group, key);
                if (!others.length) return '';
                const shown = others.slice(0, 8);
                return `<p class="also-picked"><span class="also-label">Aussi cités en 2e et 3e choix</span>${shown.map(o => `<span class="also-item">${esc(o.name)}${o.count > 1 ? ` <b>×${o.count}</b>` : ''}</span>`).join('')}${others.length > shown.length ? `<span class="also-item also-more">+${others.length - shown.length}</span>` : ''}</p>`;
            })()}
        </div></div>`;
    };

    const duo = kind => () => {
        const pair = kind === 'twins' ? M.twins : M.rivals, low = kind !== 'twins';
        return `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">Compatibilité des classements</p>
            <h2 class="title reveal-1">${low ? 'Incompatibles' : 'Âmes sœurs'}</h2>
            <div class="row-flex reveal-2"><div class="people">${bigAvatar(pair.a)}${bigAvatar(pair.b)}</div><p class="mega">${pair.pct}%</p></div>
            <div class="meter reveal-2"><span style="--w:${pair.pct}%"></span></div>
            <p class="line reveal-3"><strong>${esc(pair.a.name)} × ${esc(pair.b.name)}</strong></p>
            <p class="line reveal-4">${low
                ? `Seulement ${pair.pct}% en commun. Évitez de les asseoir côte à côte ce soir.`
                : 'Des pronos quasi identiques. Manque de personnalité, ou vous passez beaucoup trop de temps ensemble ?'}</p>
        </div></div>`;
    };

    const loner = () => `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">Compatibilité des classements</p>
            <h2 class="title reveal-1">L'électron libre</h2>
            <div class="row-flex reveal-2"><div class="people">${bigAvatar(M.loner)}</div><p class="mega">${M.lonerPct}%</p></div>
            <div class="meter reveal-2"><span style="--w:${M.lonerPct}%"></span></div>
            <p class="line reveal-3"><strong>${esc(M.loner.name)}</strong> est le plus éloigné du classement moyen du groupe.</p>
            <p class="line reveal-4">Génie incompris, ou pronos remplis les yeux fermés ? Réponse en avril.</p>
        </div></div>`;

    const intro = () => `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">Saison 2026/2027 · ${nPlayers} joueurs</p>
            <h1 class="title reveal-2">Le reveal<br>commence</h1>
            <p class="sub reveal-2">On remonte chaque conférence de la 15ème à la 1ère place, puis les hot takes, la saison passée, les stats, les awards et la compatibilité de vos pronos.</p>
            <button class="btn-primary reveal-3" id="btn-start" type="button">Lancer le reveal</button>
        </div></div>`;

    const end = () => `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">C’est fini</p>
            <h2 class="title reveal-2">Rendez-vous<br>en avril</h2>
            <p class="sub reveal-3">Tous les pronos, joueur par joueur, sont sur la page Pronostics. Utilise les chapitres en haut pour revoir un passage.</p>
            <div class="end-actions reveal-3">
                <a class="btn-primary" href="pronostics.html">Voir les pronos</a>
                <a class="btn-secondary" href="index.html">Retour au site</a>
            </div>
        </div></div>`;

    // ---------- chapitres ----------
    const confSlides = conf => [
        { html: card(conf === 'east' ? 'Chapitre 1' : 'Chapitre 2', CONF_LABEL[conf].replace(' ', '<br>'), 'De la 15ème à la 1ère place.'), ms: 3200 },
        ...Array.from({ length: N - 1 }, (_, k) => ({ html: place(conf, N - k), ms: 3800 })),
        { html: tease(conf), ms: 2600 },
        { html: place(conf, 1), ms: 5200 },
        { html: recap(conf), ms: 6000 }
    ];
    const chapters = [
        { label: 'Intro', icon: '👋', slides: [{ html: intro, ms: 0 }] },
        { label: 'Est', icon: '🏀', slides: confSlides('east') },
        { label: 'Ouest', icon: '🌴', slides: confSlides('west') },
        { label: 'Hot takes', icon: '🔥', slides: M.hotTakes.length
            ? M.hotTakes.slice(0, 3).map((_, i) => ({ html: hot(i), ms: 6500, theme: 'fire' }))
            : [{ html: noHot, ms: 5500, theme: 'fire' }] }
    ];
    const moveSlides = [];
    if (M.rise) moveSlides.push({ html: move('rise'), ms: 6500, theme: 'lime' });
    if (M.fall) moveSlides.push({ html: move('fall'), ms: 6500, theme: 'orange' });
    if (moveSlides.length) chapters.push({ label: 'Saison passée', icon: '📈', slides: moveSlides });

    const statSlides = STAT_CATS.filter(([k]) => M.firstPicks('stats', k).length).map(([k, label]) => ({ html: category('stats', k, label, 'Stats'), ms: 5500 }));
    if (statSlides.length) chapters.push({ label: 'Stats', icon: '📊', slides: statSlides });
    const awardSlides = AWARD_CATS.filter(([k]) => M.firstPicks('awards', k).length).map(([k, label]) => ({ html: category('awards', k, label, 'Awards'), ms: 5500 }));
    if (awardSlides.length) chapters.push({ label: 'Awards', icon: '🏆', slides: awardSlides });

    const compat = [];
    if (M.twins) compat.push({ html: duo('twins'), ms: 7000, theme: 'lime' });
    if (M.rivals) compat.push({ html: duo('rivals'), ms: 7000, theme: 'orange' });
    if (M.loner) compat.push({ html: loner, ms: 7000, theme: 'violet' });
    if (compat.length) chapters.push({ label: 'Compat', icon: '🤝', slides: compat });

    chapters.push({ label: 'Fin', icon: '🏁', slides: [{ html: end, ms: 0 }] });
    return chapters;
}

// ==========================================
// LECTEUR
// ==========================================
function startPlayer(CHAPTERS) {
    const FLAT = [];
    CHAPTERS.forEach((c, ci) => c.slides.forEach((s, si) => FLAT.push({ ...s, ci, si })));
    const RING = 131.95;
    let pos = 0, started = false, paused = false, elapsed = 0, last = 0;

    function renderChapters() {
        const cur = FLAT[pos].ci, si = FLAT[pos].si;
        $('chapters').innerHTML = CHAPTERS.map((c, i) => {
            const fill = i < cur ? 1 : i > cur ? 0 : si / c.slides.length;
            return `
            <button class="chap${i === cur ? ' is-active' : ''}${i < cur ? ' is-done' : ''}" type="button" data-ci="${i}" ${started ? '' : 'disabled'} title="${c.label}">
                <span class="chap-ring">
                    <svg viewBox="0 0 48 48" aria-hidden="true"><circle class="ring-bg" cx="24" cy="24" r="21"/><circle class="ring-fg" cx="24" cy="24" r="21" ${i === cur ? 'id="ring-now"' : ''} style="stroke-dashoffset:${RING * (1 - fill)}"/></svg>
                    <span class="chap-ico" aria-hidden="true">${c.icon}</span>
                </span>
                <span class="chap-label">${c.label}</span>
            </button>`;
        }).join('');
        const active = $('chapters').querySelector('.is-active');
        if (active) $('chapters').scrollLeft = active.offsetLeft - $('chapters').clientWidth / 2 + active.clientWidth / 2;
    }
    function renderBars() {
        const s = FLAT[pos];
        $('bars').innerHTML = CHAPTERS[s.ci].slides.map((_, i) => `<div class="bar${i < s.si ? ' is-done' : ''}"><i${i === s.si ? ' id="bar-now"' : ''}></i></div>`).join('');
    }
    function show(i) {
        pos = Math.max(0, Math.min(i, FLAT.length - 1));
        const s = FLAT[pos];
        $('slide-host').innerHTML = s.html();
        $('screen').className = 'screen' + (s.theme ? ' theme-' + s.theme : '');
        elapsed = 0;
        renderChapters();
        renderBars();
        $('btn-prev').disabled = !started || pos <= 1;
        $('btn-next').disabled = !started || pos === FLAT.length - 1;
        $('btn-pause').disabled = !started || !s.ms;
    }
    function tick(now) {
        const dt = now - last; last = now;
        const s = FLAT[pos];
        if (started && !paused && s.ms) {
            elapsed += dt;
            const bar = $('bar-now');
            if (bar) bar.style.width = `${Math.min(100, (elapsed / s.ms) * 100)}%`;
            const ring = $('ring-now'), n = CHAPTERS[s.ci].slides.length;
            if (ring) ring.style.strokeDashoffset = RING * (1 - Math.min(1, (s.si + elapsed / s.ms) / n));
            if (elapsed >= s.ms) show(pos + 1);
        }
        requestAnimationFrame(tick);
    }
    function setPaused(v) {
        paused = v;
        $('btn-pause').innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
        $('btn-pause').setAttribute('aria-label', paused ? 'Lecture' : 'Pause');
        $('paused-badge').hidden = !paused;
    }
    function start() {
        started = true;
        setPaused(false);
        show(1);
    }
    const next = () => { if (started && pos < FLAT.length - 1) show(pos + 1); };
    const prev = () => { if (started && pos > 1) show(pos - 1); };

    $('slide-host').addEventListener('click', e => { if (!started && e.target.closest('#btn-start')) start(); });
    $('btn-prev').addEventListener('click', prev);
    $('btn-next').addEventListener('click', next);
    $('btn-pause').addEventListener('click', () => setPaused(!paused));
    $('chapters').addEventListener('click', e => {
        const b = e.target.closest('.chap'); if (!b || b.disabled) return;
        show(FLAT.findIndex(s => s.ci === Number(b.dataset.ci)));
    });

    // Gestes sur l'écran : tap à gauche = retour, ailleurs = suivant, appui long = pause.
    // Un glissement (défilement) n'est pas un tap ; les liens et boutons gardent leur clic normal.
    const screen = $('screen');
    let tracking = false, moved = false, held = false, holdTimer = null, downX = 0, downY = 0;
    screen.addEventListener('pointerdown', e => {
        if (!started || e.button > 0 || e.target.closest('a, button')) return;
        tracking = true; moved = false; held = false; downX = e.clientX; downY = e.clientY;
        holdTimer = setTimeout(() => { held = true; setPaused(true); }, 250);
    });
    screen.addEventListener('pointermove', e => {
        if (tracking && (Math.abs(e.clientX - downX) > 10 || Math.abs(e.clientY - downY) > 10)) { moved = true; clearTimeout(holdTimer); }
    });
    screen.addEventListener('pointerup', e => {
        if (!tracking) return;
        tracking = false; clearTimeout(holdTimer);
        if (held) { held = false; setPaused(false); return; }
        if (moved) return;
        const box = screen.getBoundingClientRect();
        (e.clientX - box.left < box.width * 0.3 ? prev : next)();
    });
    screen.addEventListener('pointercancel', () => {
        tracking = false; clearTimeout(holdTimer);
        if (held) { held = false; setPaused(false); }
    });
    screen.addEventListener('contextmenu', e => { if (started) e.preventDefault(); });
    // Faire défiler un écran trop long met le reveal en pause, le temps de tout lire
    screen.addEventListener('scroll', e => {
        if (started && !paused && e.target.classList && e.target.classList.contains('slide') && e.target.scrollTop > 4) setPaused(true);
    }, true);
    document.addEventListener('keydown', e => {
        if (!started) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); } return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        else if (e.key === ' ') { e.preventDefault(); setPaused(!paused); }
    });

    $('foot').hidden = false;
    $('btn-pause').innerHTML = ICON_PAUSE;
    show(0);
    requestAnimationFrame(t => { last = t; tick(t); });
}

// ==========================================
// ÉCRANS D'ÉTAT (pas encore lancé, indisponible, erreur)
// ==========================================
function showState(kicker, title, text, withGif) {
    $('slide-host').innerHTML = `
        <div class="slide slide--center"><div class="stack">
            ${withGif ? '<img class="state-gif reveal-1" src="img/home/reveal.gif" alt="" onerror="this.remove()">' : ''}
            <p class="kicker reveal-1">${kicker}</p>
            <h1 class="title reveal-2">${title}</h1>
            <p class="sub reveal-3">${text}</p>
            <div class="end-actions reveal-3"><a class="btn-secondary" href="index.html">Retour au site</a></div>
        </div></div>`;
}

async function initReveal() {
    if (typeof Api === 'undefined') {
        showState('Erreur', 'Reveal indisponible', 'Les fichiers js/config.js et js/api.js ne sont pas chargés.');
        return;
    }
    const key = new URLSearchParams(window.location.search).get('cle') || '';

    try {
        const [config, data, lastSeason] = await Promise.all([
            Api.getConfig().catch(() => null),
            Api.getReveal(key),
            fetchLastSeason()
        ]);

        const hidden = config && config.pages && /^masqu/i.test(String(config.pages.reveal || ''));
        const local = ['localhost', '127.0.0.1', '[::1]', ''].includes(window.location.hostname);
        if (hidden && !key && !local) {
            showState('Reveal', 'Page indisponible', 'Le reveal revient très vite. Repasse dans un moment.');
            return;
        }

        if (!data || !data.revealed) {
            if (data && data.closed) {
                showState('Les jeux sont faits', 'Le reveal arrive', 'Les inscriptions sont closes. Le reveal sera lancé très bientôt : reviens sur cette page à ce moment-là.', true);
            } else {
                showState('Patience', 'Pas encore', 'Les pronos seront dévoilés une fois les inscriptions closes. D’ici là, il est encore temps de faire les tiens.', true);
            }
            return;
        }

        const model = buildModel(data, lastSeason);
        if (!model.players.length) {
            showState('Reveal', 'Aucun prono', 'Aucun joueur inscrit pour le moment.');
            return;
        }
        startPlayer(makeSlides(model));
    } catch (error) {
        console.error('Erreur de chargement du reveal :', error);
        showState('Erreur', 'Reveal indisponible', `Le chargement a échoué (${esc(error.message || 'erreur inconnue')}). Recharge la page dans quelques instants.`);
    }
}

document.addEventListener('DOMContentLoaded', initReveal);
