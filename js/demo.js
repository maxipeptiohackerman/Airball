// ==========================================
// MODE DÉMO (sur ton ordinateur uniquement) : Home et Pronostics remplis de fausses données
// ==========================================
// Activer  : ajoute ?demo=1 à l'adresse (ex. http://localhost:8000/index.html?demo=1)
// Arrêter  : ?demo=0, ou le lien « Quitter la démo » du bandeau orange
// Le mode reste actif de page en page pendant la session du navigateur.
// En ligne, ce fichier ne fait rien : le site interroge toujours le vrai Google Sheet.
// Dépend de : api.js (Api), à charger juste après lui.
const Demo = (() => {
    const KEY = 'airball:demo';
    const isLocal = () => window.location.protocol === 'file:'
        || ['localhost', '127.0.0.1', '[::1]', ''].includes(window.location.hostname)
        || window.location.hostname.endsWith('.local');

    function active() {
        if (!isLocal()) return false;
        try {
            const param = new URLSearchParams(window.location.search).get('demo');
            if (param === '1') sessionStorage.setItem(KEY, '1');
            if (param === '0') sessionStorage.removeItem(KEY);
            return sessionStorage.getItem(KEY) === '1';
        } catch (e) { return false; }
    }

    // Générateur pseudo-aléatoire stable : les mêmes fausses données à chaque chargement
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    const EAST = ['Cavs', 'Knicks', 'Celtics', 'Magic', 'Bucks', 'Pistons', '76ers', 'Pacers', 'Hawks', 'Heat', 'Bulls', 'Raptors', 'Hornets', 'Nets', 'Wizards'];
    const WEST = ['Thunder', 'Nuggets', 'Rockets', 'Lakers', 'Clippers', 'Wolves', 'Warriors', 'Grizzlies', 'Mavericks', 'Spurs', 'Kings', 'Suns', 'Pelicans', 'Blazers', 'Jazz'];
    const POOLS = {
        pts: ['Shai Gilgeous-Alexander', 'Luka Dončić', 'Anthony Edwards', 'Giannis Antetokounmpo', 'Nikola Jokić', 'Jayson Tatum'],
        reb: ['Nikola Jokić', 'Domantas Sabonis', 'Victor Wembanyama', 'Karl-Anthony Towns', 'Ivica Zubac', 'Rudy Gobert'],
        ast: ['Nikola Jokić', 'Trae Young', 'Tyrese Haliburton', 'Cade Cunningham', 'LaMelo Ball', 'James Harden'],
        stl: ['Dyson Daniels', 'Shai Gilgeous-Alexander', 'Amen Thompson', 'Stephon Castle', 'Jalen Williams', 'Alex Caruso'],
        blk: ['Victor Wembanyama', 'Chet Holmgren', 'Evan Mobley', 'Jaren Jackson Jr.', 'Myles Turner', 'Walker Kessler'],
        mvp: ['Nikola Jokić', 'Shai Gilgeous-Alexander', 'Victor Wembanyama', 'Giannis Antetokounmpo', 'Luka Dončić', 'Anthony Edwards'],
        coy: ['Kenny Atkinson', 'Mark Daigneault', 'J.B. Bickerstaff', 'Mitch Johnson', 'Ime Udoka', 'Tom Thibodeau'],
        roy: ['Cooper Flagg', 'Dylan Harper', 'Ace Bailey', 'VJ Edgecombe', 'Kon Knueppel', 'Tre Johnson'],
        mip: ['Amen Thompson', 'Jalen Johnson', 'Stephon Castle', 'Ausar Thompson', 'Zaccharie Risacher', 'Matas Buzelis'],
        dpoy: ['Victor Wembanyama', 'Evan Mobley', 'Dyson Daniels', 'Amen Thompson', 'Chet Holmgren', 'Jaren Jackson Jr.'],
        sixth: ['Payton Pritchard', 'Malik Monk', 'Naz Reid', 'Bobby Portis Jr.', 'Norman Powell', 'Tim Hardaway Jr.']
    };
    const STATS = ['pts', 'reb', 'ast', 'stl', 'blk'];
    const AWARDS = ['mvp', 'coy', 'roy', 'mip', 'dpoy', 'sixth'];
    // Pseudos de longueurs variées (pour tester l'affichage) ; le prénom réel est dans DEMO_PRENOMS
    const PSEUDOS = ['Jalen Bresson', 'Greg Ohdamned', 'Prince Hali-Express', 'Jouanneaux', 'Payetonrichard', 'Kuroko29', 'Wemby', 'Le Professeur du Dimanche', 'Air Max', 'Splash Bro 33', 'Brique Machine', 'TT', 'Dunkerque Dunk', 'Shai-ntement', 'Mamba4ever'];
    const DEMO_PRENOMS = ['Maxime', 'Guillaume', 'Erwan', 'Thibaut', 'Anthony', 'Léo', 'Tom', 'Marie-Charlotte', 'Nico', 'Sarah', 'Julien', 'Manon', 'Hugo', 'Inès', 'Lucas'];
    // Photos de profil de démo : img/demo/joueur-01.jpg à joueur-15.jpg
    const avatarOf = n => `img/demo/joueur-${String(n % 15 + 1).padStart(2, '0')}.jpg`;

    // Classement « réel » de démo, et prono d'un joueur = classement réel légèrement mélangé
    const shuffleNear = (list, noise) => list.map((t, i) => [t, i + (rand() - 0.5) * noise]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    const ranks = list => Object.fromEntries(list.map((t, i) => [t, i + 1]));
    const pick3 = (pool, skill) => {
        const order = shuffleNear(pool, 8 - skill * 6);
        return order.slice(0, 3);
    };

    function build() {
        seed = 7;
        const real = { east: EAST.slice(), west: WEST.slice(), stats: {}, awards: {} };
        STATS.forEach(k => { real.stats[k] = POOLS[k].slice(0, 3); });
        AWARDS.forEach(k => { real.awards[k] = POOLS[k].slice(0, 3); });
        // Série en cours de chaque équipe (colonne « Streak » des pronos)
        real.streaks = Object.fromEntries(EAST.concat(WEST).map(t => [t, (rand() < 0.55 ? 'W' : 'L') + (1 + Math.floor(rand() * 4))]));
        // Bilan victoires-défaites cohérent avec le classement de démo (17 matchs joués)
        real.records = {};
        [EAST, WEST].forEach(list => list.forEach((t, i) => { const w = Math.max(2, 14 - i); real.records[t] = `${w}-${17 - w}`; }));
        real.lastTen = {};
        [EAST, WEST].forEach(list => list.forEach((t, i) => { const w = Math.max(1, Math.min(9, 8 - Math.floor(i / 2))); real.lastTen[t] = `${w}-${10 - w}`; }));

        const confPts = (pred, list) => list.reduce((sum, team, i) => {
            const gap = Math.abs(pred[team] - (i + 1));
            return sum + (gap === 0 ? 2 : gap === 1 ? 1 : 0);
        }, 0);
        const pickPts = (picks, first) => [2, 1, 0.5][picks.indexOf(first)] || 0;

        const players = PSEUDOS.map((pseudo, n) => {
            const skill = 1 - n / PSEUDOS.length;           // les premiers pseudos sont un peu meilleurs
            const east = ranks(shuffleNear(EAST, 3 + (1 - skill) * 8));
            const west = ranks(shuffleNear(WEST, 3 + (1 - skill) * 8));
            const stats = {}, awards = {};
            STATS.forEach(k => { stats[k] = pick3(POOLS[k], skill); });
            AWARDS.forEach(k => { awards[k] = pick3(POOLS[k], skill); });
            const scores = {
                est: confPts(east, real.east),
                ouest: confPts(west, real.west),
                stats: STATS.reduce((s, k) => s + pickPts(stats[k], real.stats[k][0]), 0),
                awards: AWARDS.reduce((s, k) => s + pickPts(awards[k], real.awards[k][0]), 0)
            };
            scores.total = scores.est + scores.ouest + scores.stats + scores.awards;
            return { id: 'demo' + n, pseudo, prenom: DEMO_PRENOMS[n % DEMO_PRENOMS.length], avatar: avatarOf(n), east, west, stats, awards, scores };
        });

        // Historique : 4 relevés hebdomadaires qui montent jusqu'aux totaux actuels
        const sorted = [...players].sort((a, b) => b.scores.total - a.scores.total);
        const history = [];
        const today = new Date();
        [0.4, 0.6, 0.78, 0.9].forEach((share, w) => {
            const date = new Date(today.getTime() - (4 - w) * 7 * 864e5);
            const label = [date.getDate(), date.getMonth() + 1, date.getFullYear()].map(x => String(x).padStart(2, '0')).join('/');
            // Classement de la semaine : l'ordre actuel un peu mélangé, pour avoir des flèches de tendance
            const order = shuffleNear(sorted, 7);
            order.forEach((p, i) => history.push({ id: p.id, joueur: p.pseudo, semaine: label, classement: i + 1, points: Math.round(p.scores.total * share) }));
        });

        return {
            leaderboard: { revealed: true, players: sorted.map(({ id, pseudo, prenom, avatar, scores }) => ({ id, pseudo, prenom, avatar, scores })) },
            pronos: { revealed: true, real, players },
            history
        };
    }

    function showBanner() {
        const bar = document.createElement('p');
        bar.className = 'demo-banner';
        bar.innerHTML = 'Mode démo : fausses données <a href="?demo=0">Quitter la démo</a>';
        document.body.appendChild(bar);
    }

    if (active() && typeof Api !== 'undefined') {
        const data = build();
        Api.getLeaderboard = () => Promise.resolve(data.leaderboard);
        Api.getPronos = () => Promise.resolve(data.pronos);
        Api.getHistory = () => Promise.resolve(data.history);
        // Palmarès de démo : badge « Champion » sur la fiche de Greg Ohdamned
        Api.getHallOfFame = () => Promise.resolve([{ saison: '2024-2025', maillot: 'Ivica Zubac', vainqueur: 'Greg Ohdamned' }, { saison: '2023-2024', maillot: 'Victor Wembanyama', vainqueur: 'Jalen Bresson' }]);
        // Le mode démo ignore la popin « avant le tip-off »
        try { ['home', 'pronos'].forEach(s => localStorage.setItem(`airball:revealed:${s}`, '1')); } catch (e) { /* stockage indisponible */ }
        document.addEventListener('DOMContentLoaded', showBanner);
    } else if (isLocal()) {
        // Hors démo : on oublie l'état « dévoilé » laissé par une démo (la popin d'avant-saison revient)
        try { ['home', 'pronos'].forEach(s => localStorage.removeItem(`airball:revealed:${s}`)); } catch (e) { /* stockage indisponible */ }
    }

    return { active };
})();
