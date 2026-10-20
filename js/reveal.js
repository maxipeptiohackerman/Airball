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

// Flammes qui jaillissent derrière le logo d'un hot take (trait noir épais façon dessin)
const FLAME_OUT = 'stroke="#1a1416" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const FLAMES = `<svg class="flames" viewBox="0 0 120 104" aria-hidden="true"><path d="M58 6 C62 22 74 30 78 44 C82 34 80 26 76 18 C92 30 100 50 96 66 C102 62 106 54 106 46 C116 62 114 84 102 98 L18 98 C6 84 6 64 16 52 C16 60 20 66 26 68 C22 52 30 40 40 32 C40 42 44 48 48 50 C44 36 50 20 58 6 Z" fill="#a3203a" ${FLAME_OUT}/><path d="M64 40 C68 54 82 58 82 76 C86 72 88 66 87 60 C96 72 94 90 86 100 L38 100 C30 92 30 78 38 70 C38 76 42 80 46 80 C42 66 52 54 56 46 C58 54 62 52 64 40 Z" fill="#f6b546" ${FLAME_OUT}/></svg>`;
const hotLogo = team => `<span class="hot-logo">${FLAMES}${logo(team)}</span>`;

const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>';

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
    // Un tour du groupe : 1 hot take par personne d'abord, puis 2 au maximum si la liste n'est pas pleine
    // (sinon un joueur qui a rempli « au hasard » raflerait tous les hot takes)
    const sortedHot = candidates.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
    const hotTakes = [];
    [1, 2].forEach(cap => sortedHot.forEach(h => {
        if (hotTakes.length >= 5 || hotTakes.includes(h)) return;
        if (hotTakes.filter(x => x.who === h.who).length < cap) hotTakes.push(h);
    }));
    hotTakes.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
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

    // Pages spéciales : jamais deux fois la même personne si on peut l'éviter.
    // L'électron libre est servi en premier (c'est sa page), puis on prend le cas suivant pour les autres.
    const used = new Set(loner ? [loner] : []);
    const pickFree = (list, people) => list.find(x => people(x).every(p => !used.has(p))) || list[0] || null;
    const take = (item, people) => { if (item) people(item).forEach(p => used.add(p)); return item; };
    const byPair = x => [x.a, x.b];
    const rivals = pairs.length > 1 ? take(pickFree([...pairs].reverse(), byPair), byPair) : null;
    const twins = pairs.length ? take(pickFree(pairs.filter(x => x !== rivals), byPair), byPair) : null;

    // Par rapport à la saison passée (classement ESPN), si disponible
    let rise = null, fall = null;
    if (lastSeason) {
        const moves = [];
        players.forEach(p => ['east', 'west'].forEach(conf => CONF_TEAMS[conf].forEach(team => {
            const place = rankOf(p, conf, team), last = lastSeason[conf][team];
            if (place && last) moves.push({ who: p, conf, team, place, last, delta: last - place });
        })));
        if (moves.length) {
            const byWho = x => [x.who];
            rise = take(pickFree(moves.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta), byWho), byWho);
            fall = take(pickFree(moves.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta), byWho), byWho);
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
        twins, rivals,
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
    const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    // Grille de cartes : 3 colonnes, 2 ou 1 quand il y a peu de cartes (centrées)
    const gridClass = n => n === 1 ? ' picks--1' : n === 2 || n === 4 ? ' picks--2' : '';

    // Écran sombre « titre » : surtitre, grand titre, texte (accueil, chapitres)
    const card = (kicker, title, sub) => () => `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">${kicker}</p>
            <h2 class="title reveal-2">${title}</h2>
            ${sub ? `<p class="sub reveal-3">${sub}</p>` : ''}
        </div></div>`;

    // Une place : toutes les équipes choisies à ce rang, en cartes épurées
    const place = (conf, n) => () => {
        const list = M.picksAt(conf, n);
        return `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker">Classement de la ${CONF_LABEL[conf]}</p>
            <h2 class="title title--md">${ordinalText(n)} position</h2>
            <div class="picks${gridClass(list.length)}">
            ${list.map(({ team, who }, i) => {
                const hot = who.length === 1 && M.hotAt(conf, n, team);
                return `
                <div class="pick${hot ? ' is-hot' : ''}" style="animation-delay:${0.15 + i * 0.08}s">
                    ${hot ? hotLogo(team) : logo(team)}
                    <div class="pick-team">
                        <span class="pick-name">${esc(team)}</span>
                        ${who.length === nPlayers ? '<span class="pick-meta">Unanimité</span>' : ''}
                        <div class="avatars">${who.map(avatar).join('')}</div>
                    </div>
                    <span class="pick-count">${who.length}</span>
                </div>`;
            }).join('')}
            </div>
        </div></div>`;
    };

    const tease = conf => () => `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">${CONF_LABEL[conf]}</p>
            <h2 class="title reveal-1">Et à la 1re place…</h2>
            <div class="dots reveal-2" aria-hidden="true"><span></span><span></span><span></span></div>
        </div></div>`;

    // Classement final : l'équipe la plus choisie à chaque place, en 2 colonnes (1-8, 9-15)
    const recap = conf => () => {
        const row = place => {
            const list = M.picksAt(conf, place);
            if (!list.length) return `<li class="final-row"><span class="final-rank">${place}</span><span></span><span class="final-team">—</span><span></span></li>`;
            const { team, who } = list[0];
            const shown = who.slice(0, 4);
            return `<li class="final-row" style="animation-delay:${0.05 * place}s">
                <span class="final-rank">${place}</span>${logo(team, 'sm')}
                <span class="final-team">${esc(team)}${list.length > 1 ? `<small>+${list.length - 1} autre${list.length > 2 ? 's' : ''}</small>` : ''}</span>
                <span class="stackav" title="${esc(who.map(p => p.name).join(', '))}">${shown.map(p => `<span class="av-dot" style="--a:${p.color}">${dotContent(p)}</span>`).join('')}${who.length > shown.length ? `<span class="more">+${who.length - shown.length}</span>` : ''}</span>
            </li>`;
        };
        const col = (from, to) => `<ol class="final-col">${Array.from({ length: to - from + 1 }, (_, k) => row(from + k)).join('')}</ol>`;
        return `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker">${CONF_LABEL[conf]}</p>
            <h2 class="title title--md">Classement final</h2>
            <div class="final">${col(1, 8)}${col(9, N)}</div>
        </div></div>`;
    };

    // Hot takes d'une conférence : le titre de la maquette + les cartes épurées
    const hotConf = conf => () => {
        const list = M.hotTakes.filter(h => h.conf === conf);
        return `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">${CONF_LABEL[conf]}</p>
            <h2 class="title reveal-1">🔥Hot takes🔥</h2>
            <div class="picks${gridClass(list.length)}">
            ${list.map((h, i) => `
                <div class="pick is-hot" style="animation-delay:${0.4 + i * 0.15}s" title="Le reste du groupe les voit ${ordinalText(h.avg)}">
                    ${hotLogo(h.team)}
                    <div class="pick-team">
                        <span class="pick-name">${esc(h.team)}</span>
                        <div class="avatars">${avatar(h.who, 0)}</div>
                    </div>
                    <span class="pick-count">${ordinal(h.place)}</span>
                </div>`).join('')}
            </div>
        </div></div>`;
    };

    const noHot = () => `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">Hot takes</p>
            <h2 class="title reveal-2">Zéro hot take</h2>
            <p class="sub reveal-3">${nPlayers} joueurs, aucune prise de risque. Vous avez tous lu le même article de présaison ?</p>
        </div></div>`;

    // Pages spéciales (fond en couleur) : surtitre, grand chiffre, titre, texte, illustration
    const special = ({ kicker, figure, title, text, art = '', people = '' }) => `
        <div class="slide slide--center">
            ${art}
            <div class="stack special">
                <p class="kicker reveal-1">${kicker}</p>
                <div class="mega-wrap reveal-2"><p class="mega">${figure}</p>${people}</div>
                <h2 class="title reveal-2">${title}</h2>
                <p class="line reveal-3">${text}</p>
            </div>
        </div>`;
    const teamArt = team => {
        const t = Teams.find(team);
        return t ? `<span class="special-art"><img src="${Teams.logoUrl(t)}" alt="" onerror="this.parentNode.remove()"></span>` : '';
    };

    const move = kind => () => {
        const m = kind === 'rise' ? M.rise : M.fall, up = kind === 'rise', n = Math.abs(m.delta);
        return special({
            kicker: 'Par rapport à la saison passée',
            figure: `${up ? '+' : '−'}${n}`,
            title: up ? 'La remontada' : 'La chute libre',
            text: `${esc(m.who.name)} met les ${esc(m.team)} ${ordinalText(m.place)}. L'an dernier : ${ordinalText(m.last)}. ${up ? `${n} places de mieux, rien que ça : il sait quelque chose qu’on ignore ?` : `${n} places de moins : il a parié contre eux ou quoi ?`}`,
            art: teamArt(m.team)
        });
    };

    const category = (group, key, label, chapterLabel) => () => {
        const list = M.firstPicks(group, key);
        const others = M.otherPicks(group, key);
        const shown = others.slice(0, 8);
        return `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker">${chapterLabel} · le pick n°1 de chacun</p>
            <h2 class="title title--md">${label}</h2>
            <div class="picks${gridClass(list.length)}">
            ${list.map(({ name, who }, i) => `
                <div class="pick" style="animation-delay:${0.15 + i * 0.08}s">
                    <span class="pick-who" aria-hidden="true">${esc(initials(name))}</span>
                    <div class="pick-team">
                        <span class="pick-name">${esc(name)}</span>
                        ${who.length === nPlayers ? '<span class="pick-meta">Unanimité</span>' : ''}
                        <div class="avatars">${who.map(avatar).join('')}</div>
                    </div>
                    <span class="pick-count">${who.length}</span>
                </div>`).join('')}
            </div>
            ${shown.length ? `<p class="also-picked"><span class="also-label">Aussi cités en 2e et 3e choix</span>${shown.map(o => `<span class="also-item">${esc(o.name)}${o.count > 1 ? ` <b>×${o.count}</b>` : ''}</span>`).join('')}${others.length > shown.length ? `<span class="also-item">+${others.length - shown.length}</span>` : ''}</p>` : ''}
        </div></div>`;
    };

    const duo = kind => () => {
        const pair = kind === 'twins' ? M.twins : M.rivals, low = kind !== 'twins';
        return special({
            kicker: 'Compatibilité des classements',
            figure: `${pair.pct}%`,
            title: low ? 'Incompatibles' : 'Âmes sœurs',
            text: `${esc(pair.a.name)} × ${esc(pair.b.name)}. ${low
                ? `Seulement ${pair.pct}% en commun : évitez de les asseoir côte à côte ce soir.`
                : 'Des pronos quasi identiques. Manque de personnalité, ou vous passez beaucoup trop de temps ensemble ?'}`,
            people: `<span class="mega-people">${bigAvatar(pair.a)}${bigAvatar(pair.b)}</span>`
        });
    };

    const loner = () => special({
        kicker: 'Compatibilité des classements',
        figure: `${M.lonerPct}%`,
        title: 'L’électron libre',
        text: `${esc(M.loner.name)} est le plus éloigné du classement moyen du groupe. Génie incompris, ou pronos remplis les yeux fermés ? Réponse en avril.`,
        people: `<span class="mega-people">${bigAvatar(M.loner)}</span>`
    });

    const intro = () => `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">Saison 2026/2027 · ${nPlayers} joueurs</p>
            <h1 class="title reveal-2">Le reveal commence</h1>
            <p class="sub reveal-2">On remonte chaque conférence de la 15e à la 1re place, puis les hot takes, la saison passée, les stats, les awards et la compatibilité de vos pronos.</p>
            <button class="btn-primary btn--small reveal-3" id="btn-start" type="button">Lancer le reveal ${CHEVRON}</button>
        </div></div>`;

    const end = () => `
        <div class="slide slide--center"><div class="stack">
            <p class="kicker reveal-1">C’est fini</p>
            <h2 class="title reveal-2">Rendez-vous<br>en avril</h2>
            <p class="sub reveal-3">Tous les pronos, joueur par joueur, sont sur la page Pronostics. Utilise les chapitres en haut pour revoir un passage.</p>
            <div class="end-actions reveal-3">
                <a class="btn-secondary" href="pronostics.html">Voir les pronos</a>
                <a class="btn-secondary" href="index.html">Retour à l’accueil</a>
            </div>
        </div></div>`;

    // ---------- chapitres ----------
    const confSlides = conf => [
        { html: card(conf === 'east' ? 'Chapitre 1' : 'Chapitre 2', CONF_LABEL[conf], 'De la 15e à la 1re place.'), ms: 3200 },
        ...Array.from({ length: N - 1 }, (_, k) => ({ html: place(conf, N - k), ms: 3800, theme: 'blue' })),
        { html: tease(conf), ms: 2600 },
        { html: place(conf, 1), ms: 5200, theme: 'blue' },
        { html: recap(conf), ms: 6500, theme: 'blue' }
    ];
    const hotConfs = ['east', 'west'].filter(conf => M.hotTakes.some(h => h.conf === conf));
    const chapters = [
        { label: 'Intro', icon: '👋', slides: [{ html: intro, ms: 0 }] },
        { label: 'Est', icon: '🏀', slides: confSlides('east') },
        { label: 'Ouest', icon: '🌴', slides: confSlides('west') },
        { label: 'Hot takes', icon: '🔥', slides: hotConfs.length
            ? hotConfs.map(conf => ({ html: hotConf(conf), ms: 9000, theme: 'blue' }))
            : [{ html: noHot, ms: 5500 }] }
    ];
    const moveSlides = [];
    if (M.rise) moveSlides.push({ html: move('rise'), ms: 6500, theme: 'lime' });
    if (M.fall) moveSlides.push({ html: move('fall'), ms: 6500, theme: 'orange' });
    if (moveSlides.length) chapters.push({ label: 'Saison passée', icon: '📈', slides: moveSlides });

    const statSlides = STAT_CATS.filter(([k]) => M.firstPicks('stats', k).length).map(([k, label]) => ({ html: category('stats', k, label, 'Stats'), ms: 5500, theme: 'blue' }));
    if (statSlides.length) chapters.push({ label: 'Stats', icon: '📊', slides: statSlides });
    const awardSlides = AWARD_CATS.filter(([k]) => M.firstPicks('awards', k).length).map(([k, label]) => ({ html: category('awards', k, label, 'Awards'), ms: 5500, theme: 'blue' }));
    if (awardSlides.length) chapters.push({ label: 'Awards', icon: '🏆', slides: awardSlides });

    const compat = [];
    if (M.twins) compat.push({ html: duo('twins'), ms: 7000, theme: 'lime' });
    if (M.rivals) compat.push({ html: duo('rivals'), ms: 7000, theme: 'orange' });
    if (M.loner) compat.push({ html: loner, ms: 7000, theme: 'violet' });
    if (compat.length) chapters.push({ label: 'Compat', icon: '🤝', slides: compat });

    chapters.push({ label: 'Fin', icon: '🏁', slides: [{ html: end, ms: 0, theme: 'end' }] });
    return chapters;
}

// ==========================================
// LECTEUR
// ==========================================
function startPlayer(CHAPTERS) {
    const FLAT = [];
    CHAPTERS.forEach((c, ci) => c.slides.forEach((s, si) => FLAT.push({ ...s, ci, si })));
    const RING = 125.66;
    let pos = 0, started = false, paused = false, elapsed = 0, last = 0;

    function renderChapters() {
        const cur = FLAT[pos].ci, si = FLAT[pos].si;
        $('chapters').innerHTML = CHAPTERS.map((c, i) => {
            const fill = i < cur ? 1 : i > cur ? 0 : si / c.slides.length;
            return `
            <button class="chap${i === cur ? ' is-active' : ''}${i < cur ? ' is-done' : ''}" type="button" data-ci="${i}" ${started ? '' : 'disabled'} title="${c.label}">
                <span class="chap-ring">
                    <svg viewBox="0 0 40 40" aria-hidden="true"><circle class="ring-fg" cx="20" cy="20" r="20" ${i === cur ? 'id="ring-now"' : ''} style="stroke-dashoffset:${RING * (1 - fill)}"/></svg>
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
        $('screen').className = 'screen theme-' + (s.theme || 'dark');
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

// ==========================================
// DONNÉES DE DÉMONSTRATION (uniquement quand le site tourne sur ton ordinateur)
// Pour travailler le reveal sans le lancer : de faux joueurs aux pronos tirés au hasard (toujours les mêmes).
// ==========================================
const isLocalSite = () => window.location.protocol === 'file:'
    || ['localhost', '127.0.0.1', '[::1]', ''].includes(window.location.hostname)
    || window.location.hostname.endsWith('.local');

function demoRevealData() {
    let seed = 7;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const shuffle = list => list.map(v => [v, rand()]).sort((a, b) => a[1] - b[1]).map(([v]) => v);
    const POOL = {
        pts: ['Shai Gilgeous-Alexander', 'Luka Dončić', 'Giannis Antetokounmpo', 'Anthony Edwards', 'Nikola Jokić'],
        reb: ['Nikola Jokić', 'Victor Wembanyama', 'Domantas Sabonis', 'Karl-Anthony Towns', 'Jalen Duren'],
        ast: ['Nikola Jokić', 'Trae Young', 'Cade Cunningham', 'Tyrese Haliburton', 'Luka Dončić'],
        stl: ['Dyson Daniels', 'Shai Gilgeous-Alexander', 'Amen Thompson', 'Alex Caruso', 'Cason Wallace'],
        blk: ['Victor Wembanyama', 'Chet Holmgren', 'Evan Mobley', 'Walker Kessler', 'Jaren Jackson Jr.'],
        mvp: ['Nikola Jokić', 'Shai Gilgeous-Alexander', 'Luka Dončić', 'Giannis Antetokounmpo', 'Victor Wembanyama'],
        coy: ['Mark Daigneault', 'Kenny Atkinson', 'JJ Redick', 'J.B. Bickerstaff', 'Ime Udoka'],
        roy: ['AJ Dybantsa', 'Darryn Peterson', 'Cameron Boozer', 'Caleb Wilson', 'Keaton Wagler'],
        mip: ['Jalen Duren', 'Amen Thompson', 'Scottie Barnes', 'Dyson Daniels', 'Kon Knueppel'],
        dpoy: ['Victor Wembanyama', 'Evan Mobley', 'Amen Thompson', 'Dyson Daniels', 'Chet Holmgren'],
        sixth: ['Payton Pritchard', 'Malik Monk', 'Naz Reid', 'Jordan Clarkson', 'Ty Jerome']
    };
    const ranks = keys => Object.fromEntries(keys.map((team, i) => [team, i + 1]));
    const pseudos = ['King James', 'Wemby Fan', 'Max', 'Léa', 'Tom', 'Erwan', 'Sarah'];
    const players = pseudos.map(pseudo => ({
        pseudo, avatar: '',
        // Classements proches d'un ordre « logique », avec des écarts pour créer des hot takes
        east: ranks(shuffle(CONF_TEAMS.east).sort(() => rand() - 0.6)),
        west: ranks(shuffle(CONF_TEAMS.west).sort(() => rand() - 0.6)),
        stats: Object.fromEntries(['pts', 'reb', 'ast', 'stl', 'blk'].map(k => [k, shuffle(POOL[k]).slice(0, 3)])),
        awards: Object.fromEntries(['mvp', 'coy', 'roy', 'mip', 'dpoy', 'sixth'].map(k => [k, shuffle(POOL[k]).slice(0, 3)]))
    }));
    return { revealed: true, demo: true, players };
}

function showDemoBadge() {
    const badge = Object.assign(document.createElement('p'), { className: 'demo-badge', innerHTML: 'Démo<span> · données inventées (version locale)</span>' });
    const ctrls = document.querySelector('#foot .ctrls');
    if (ctrls) ctrls.after(badge); else document.body.appendChild(badge);
}

async function initReveal() {
    if (typeof Api === 'undefined') {
        showState('Erreur', 'Reveal indisponible', 'Les fichiers js/config.js et js/api.js ne sont pas chargés.');
        return;
    }
    const key = new URLSearchParams(window.location.search).get('cle') || '';
    const local = isLocalSite();

    try {
        const [config, realData, lastSeason] = await Promise.all([
            Api.getConfig().catch(() => null),
            // En local, si le Sheet ne répond pas, on passe aux données de démonstration
            local ? Api.getReveal(key).catch(() => null) : Api.getReveal(key),
            fetchLastSeason()
        ]);

        const hidden = config && config.pages && /^masqu/i.test(String(config.pages.reveal || ''));
        if (hidden && !key && !local) {
            showState('Reveal', 'Page indisponible', 'Le reveal revient très vite. Repasse dans un moment.');
            return;
        }

        // Sur ton ordinateur, tant que le reveal n'est pas lancé : faux pronos pour travailler la page
        let data = realData;
        if (local && (!data || !data.revealed)) {
            data = demoRevealData();
            showDemoBadge();
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
