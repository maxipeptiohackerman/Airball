// ==========================================
// LES 30 FRANCHISES NBA : une seule liste pour tout le site
// (inscription, statistiques NBA, pronostics, reveal)
// ==========================================
// key    : nom utilisé dans le Google Sheet (en-têtes "[Cavs]", "[Wolves]"...) et dans les pronos
// name   : nom complet (players.json, coaches.json, ESPN)
// conf   : conférence
// logo   : code du logo ESPN (https://a.espncdn.com/i/teamlogos/nba/500/<logo>.png)
// colors : [couleur principale, couleur secondaire] (maillots de l'inscription)
// L'ordre est celui des colonnes du formulaire dans le Sheet : ne pas le modifier.
const TEAMS = [
    { key: 'Hawks', name: 'Atlanta Hawks', conf: 'east', logo: 'atl', colors: ['#e03a3e', '#c1d32f'] },
    { key: 'Celtics', name: 'Boston Celtics', conf: 'east', logo: 'bos', colors: ['#007a33', '#ffffff'] },
    { key: 'Nets', name: 'Brooklyn Nets', conf: 'east', logo: 'bkn', colors: ['#000000', '#ffffff'] },
    { key: 'Hornets', name: 'Charlotte Hornets', conf: 'east', logo: 'cha', colors: ['#1d1160', '#00788c'] },
    { key: 'Bulls', name: 'Chicago Bulls', conf: 'east', logo: 'chi', colors: ['#ce1141', '#000000'] },
    { key: 'Cavs', name: 'Cleveland Cavaliers', conf: 'east', logo: 'cle', colors: ['#860038', '#fdbb30'] },
    { key: 'Pistons', name: 'Detroit Pistons', conf: 'east', logo: 'det', colors: ['#c8102e', '#1d42ba'] },
    { key: 'Pacers', name: 'Indiana Pacers', conf: 'east', logo: 'ind', colors: ['#002d62', '#fdbb30'] },
    { key: 'Heat', name: 'Miami Heat', conf: 'east', logo: 'mia', colors: ['#98002e', '#f9a01b'] },
    { key: 'Bucks', name: 'Milwaukee Bucks', conf: 'east', logo: 'mil', colors: ['#00471b', '#eee1c6'] },
    { key: 'Knicks', name: 'New York Knicks', conf: 'east', logo: 'ny', colors: ['#006bb6', '#f58426'] },
    { key: 'Magic', name: 'Orlando Magic', conf: 'east', logo: 'orl', colors: ['#0077c0', '#c4ced4'] },
    { key: '76ers', name: 'Philadelphia 76ers', conf: 'east', logo: 'phi', colors: ['#006bb6', '#ed174c'] },
    { key: 'Raptors', name: 'Toronto Raptors', conf: 'east', logo: 'tor', colors: ['#ce1141', '#000000'] },
    { key: 'Wizards', name: 'Washington Wizards', conf: 'east', logo: 'wsh', colors: ['#002b5c', '#e31837'] },
    { key: 'Mavericks', name: 'Dallas Mavericks', conf: 'west', logo: 'dal', colors: ['#00538c', '#b8c4ca'] },
    { key: 'Nuggets', name: 'Denver Nuggets', conf: 'west', logo: 'den', colors: ['#0e2240', '#fec524'] },
    { key: 'Warriors', name: 'Golden State Warriors', conf: 'west', logo: 'gs', colors: ['#1d428a', '#ffc72c'] },
    { key: 'Rockets', name: 'Houston Rockets', conf: 'west', logo: 'hou', colors: ['#ce1141', '#c4ced4'] },
    { key: 'Clippers', name: 'Los Angeles Clippers', conf: 'west', logo: 'lac', colors: ['#c8102e', '#1d428a'] },
    { key: 'Lakers', name: 'Los Angeles Lakers', conf: 'west', logo: 'lal', colors: ['#552583', '#fdb927'] },
    { key: 'Grizzlies', name: 'Memphis Grizzlies', conf: 'west', logo: 'mem', colors: ['#5d76a9', '#12173f'] },
    { key: 'Wolves', name: 'Minnesota Timberwolves', conf: 'west', logo: 'min', colors: ['#0c2340', '#78be20'] },
    { key: 'Pelicans', name: 'New Orleans Pelicans', conf: 'west', logo: 'no', colors: ['#0c2340', '#85714d'] },
    { key: 'Thunder', name: 'Oklahoma City Thunder', conf: 'west', logo: 'okc', colors: ['#007ac1', '#ef3b24'] },
    { key: 'Suns', name: 'Phoenix Suns', conf: 'west', logo: 'phx', colors: ['#1d1160', '#e56020'] },
    { key: 'Blazers', name: 'Portland Trail Blazers', conf: 'west', logo: 'por', colors: ['#e03a3e', '#000000'] },
    { key: 'Kings', name: 'Sacramento Kings', conf: 'west', logo: 'sac', colors: ['#5a2d81', '#63727a'] },
    { key: 'Spurs', name: 'San Antonio Spurs', conf: 'west', logo: 'sa', colors: ['#c4ced4', '#000000'] },
    { key: 'Jazz', name: 'Utah Jazz', conf: 'west', logo: 'utah', colors: ['#002b5c', '#f9a01b'] }
];

const Teams = (() => {
    const norm = value => String(value || '').trim().toLowerCase();
    const byKey = {}, byName = {}, byLogo = {};
    TEAMS.forEach(team => {
        byKey[norm(team.key)] = team;
        byName[norm(team.name)] = team;
        byLogo[team.logo] = team;
    });
    // Autres écritures rencontrées (ESPN, anciens fichiers)
    const ALIASES = { 'la clippers': 'Los Angeles Clippers', cavaliers: 'Cleveland Cavaliers', timberwolves: 'Minnesota Timberwolves', 'trail blazers': 'Portland Trail Blazers' };
    const ABBR_ALIASES = { nyk: 'ny', sas: 'sa', gsw: 'gs', nop: 'no', uta: 'utah', was: 'wsh', bro: 'bkn', pho: 'phx' };

    /** Une équipe à partir de n'importe quelle écriture : "Cavs", "Cleveland Cavaliers", "CLE", "LA Clippers"... */
    function find(value) {
        const v = norm(value);
        if (!v) return null;
        return byKey[v] || byName[v] || byName[norm(ALIASES[v])] || byLogo[ABBR_ALIASES[v] || v] || null;
    }

    const conference = conf => TEAMS.filter(team => team.conf === conf);
    const logoUrl = team => `https://a.espncdn.com/i/teamlogos/nba/500/${team.logo}.png`;

    /**
     * Logo d'une équipe, identique sur toutes les pages. Si l'image ne charge pas,
     * le sigle de l'équipe (ex. "BOS") s'affiche à la place.
     */
    function logoHtml(value, className = 'team-logo') {
        const team = find(value);
        if (!team) return `<span class="${className} team-logo--missing" aria-hidden="true"></span>`;
        return `<img class="${className}" src="${logoUrl(team)}" alt="" loading="lazy" width="24" height="24"
            onerror="this.onerror=null; this.outerHTML='<span class=&quot;${className} team-logo--missing&quot; aria-hidden=&quot;true&quot;>${team.logo.toUpperCase()}</span>'">`;
    }

    return { find, conference, logoUrl, logoHtml };
})();
