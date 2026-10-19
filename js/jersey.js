// ==========================================
// MAILLOTS ILLUSTRÉS (inscription : cartes des picks, liste de sélection, récapitulatif)
// ==========================================
// Style « affiche » : débardeur élancé, contour encré fin, liseré couleur + blanc au col et
// aux emmanchures, nom de l'équipe en arc et numéro à triple contour.
// Jersey.svg(team, { number, mini, className })
//   team   : n'importe quelle écriture d'équipe ("Knicks", "New York Knicks", "NY"...)
//   number : numéro affiché sur le maillot (grand format seulement)
//   mini   : petit format (listes) : forme et liserés seulement, contour clair pour les fonds sombres
// Polices : Rokkitt (lettrage) et Saira Extra Condensed (numéro), déclarées dans style.css
// Dépend de : teams.js (Teams)
const Jersey = (() => {
    const INK = '#1d1a24';
    const WORD_FONT = "'Rokkitt', Georgia, serif";
    const NUM_FONT = "'Saira Extra Condensed', 'Arial Narrow', sans-serif";
    let uid = 0;

    const luminance = hex => {
        const h = String(hex).replace('#', '');
        const [r, g, b] = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const isWhite = hex => luminance(hex) > 0.9;
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    // viewBox 100 x 156 : bretelles larges, col en U, emmanchures jusqu'au tiers, côtés presque droits
    const BODY = 'M18 3L34 2C34.6 15 41 24 50 24C59 24 65.4 15 66 2L82 3C82 25 87 45 96 56L95.6 151C70 154.5 30 154.5 4.4 151L4 56C13 45 18 25 18 3Z';
    const EDGES = [
        'M34 2C34.6 15 41 24 50 24C59 24 65.4 15 66 2',  // col
        'M18 3C18 25 13 45 4 56',                         // emmanchure gauche
        'M82 3C82 25 87 45 96 56'                         // emmanchure droite
    ];
    // Dos du maillot : col beaucoup moins échancré
    const BODY_BACK = 'M18 3L34 2C35 9 42 12 50 12C58 12 65 9 66 2L82 3C82 25 87 45 96 56L95.6 151C70 154.5 30 154.5 4.4 151L4 56C13 45 18 25 18 3Z';
    const EDGES_BACK = ['M34 2C35 9 42 12 50 12C58 12 65 9 66 2', EDGES[1], EDGES[2]];

    // Nom au dos : nom de famille en capitales, sans accents ("Jokić" -> "JOKIC", "Jaren Jackson Jr." -> "JACKSON JR.")
    function backName(fullName) {
        const parts = String(fullName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().split(/\s+/);
        if (parts.length < 2) return parts.join(' ').toUpperCase();
        const suffix = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1]) ? parts.pop() : '';
        return (parts.slice(1).join(' ') + (suffix ? ' ' + suffix : '')).toUpperCase();
    }

    function svg(teamValue, { number = '', mini = false, className = 'jersey', name = '' } = {}) {
        const team = typeof Teams !== 'undefined' ? Teams.find(teamValue) : null;
        const [body, trim] = team ? team.colors : ['#8e8d91', '#ffffff'];
        const id = 'jsy' + (++uid);
        const inner = isWhite(trim) ? body : '#ffffff';      // bande intérieure : blanche, sauf si la couleur est déjà blanche
        const letter = luminance(body) > 0.62 ? INK : '#ffffff';
        const numBorder = isWhite(trim) ? body : '#ffffff';

        if (mini) {
            const bands = EDGES.map(d => `<path d="${d}" stroke="${inner}" stroke-width="16"/><path d="${d}" stroke="${trim}" stroke-width="9"/>`).join('');
            return `<svg class="${className}" viewBox="0 0 100 156" aria-hidden="true">
                <defs><clipPath id="${id}c"><path d="${BODY}"/></clipPath></defs>
                <path d="${BODY}" fill="${body}"/>
                <g clip-path="url(#${id}c)" fill="none">${bands}</g>
                <path d="${BODY}" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="3.4" stroke-linejoin="round"/>
            </svg>`;
        }

        const back = !!name;                                 // un nom = maillot vu de dos
        const shape = back ? BODY_BACK : BODY;

        // Liseré, du bord vers l'intérieur : couleur | trait fin | blanc | trait fin
        // (traits centrés sur le bord du maillot, la moitié extérieure est coupée par la forme)
        const bands = (back ? EDGES_BACK : EDGES).map(d => `
            <path d="${d}" stroke="${INK}" stroke-width="15.2"/>
            <path d="${d}" stroke="${inner}" stroke-width="14"/>
            <path d="${d}" stroke="${INK}" stroke-width="8.2"/>
            <path d="${d}" stroke="${trim}" stroke-width="7"/>`).join('');

        // Devant : nom de l'équipe. Dos : nom du joueur, plus haut ; les noms longs se resserrent
        // puis rapetissent un peu pour rester entre les emmanchures.
        const word = back ? backName(name) : (team ? team.key.toUpperCase() : '');
        const size = back ? Math.max(9.5, Math.min(15, 15 * 9 / Math.max(word.length, 9))) : 17;
        const width = Math.min(back ? 58 : 66, word.length * size * 0.5);
        const arc = back ? 'M16 60Q50 51 84 60' : 'M14 62Q50 53 86 62';
        const lettering = word ? `
            <path id="${id}a" d="${arc}" fill="none"/>
            <text font-family="${WORD_FONT}" font-weight="500" font-size="${size.toFixed(1)}" fill="${letter}" stroke="${INK}" stroke-width="0.9" stroke-linejoin="round" paint-order="stroke" text-anchor="middle">
                <textPath href="#${id}a" xlink:href="#${id}a" startOffset="50%" textLength="${width.toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(word)}</textPath>
            </text>` : '';

        const num = String(number === null || number === undefined ? '' : number).trim();
        const numbering = num ? `
            <g font-family="${NUM_FONT}" font-weight="700" font-size="${back ? 64 : 60}" text-anchor="middle" stroke-linejoin="miter" stroke-miterlimit="2">
                <text x="50" y="${back ? 127 : 121}" fill="none" stroke="${INK}" stroke-width="7.4">${esc(num)}</text>
                <text x="50" y="${back ? 127 : 121}" fill="none" stroke="${numBorder}" stroke-width="6">${esc(num)}</text>
                <text x="50" y="${back ? 127 : 121}" fill="${trim}" stroke="${INK}" stroke-width="1.4" paint-order="stroke">${esc(num)}</text>
            </g>` : '';

        return `<svg class="${className}" viewBox="0 0 100 156" aria-hidden="true">
            <defs>
                <clipPath id="${id}c"><path d="${shape}"/></clipPath>
                <filter id="${id}w" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="${uid % 9}"/><feDisplacementMap in="SourceGraphic" scale="0.6"/></filter>
            </defs>
            <path d="${shape}" fill="${body}"/>
            <g clip-path="url(#${id}c)" fill="none">${bands}</g>
            ${lettering}
            ${numbering}
            <path d="${shape}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round" filter="url(#${id}w)"/>
        </svg>`;
    }

    return { svg };
})();
