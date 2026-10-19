// Version du site (visible dans la console du navigateur) : sert à vérifier que la bonne version est en ligne
const AIRBALL_VERSION = '20261018p';
console.info('Airball version', AIRBALL_VERSION);

// ==========================================
// COMMUN À TOUTES LES PAGES
// Menu + barre du haut + chrono des jours restants + utilitaires partagés
// ==========================================

// Menu latéral + barre du haut, communs à toutes les pages.
// Écrits ici plutôt que dans un fichier header.html séparé : plus de requête
// réseau, plus de risque qu'une version incomplète du fichier soit servie.
const HEADER_HTML = `
<!-- Fond décoratif commun (terrain, texture, halos) -->
<div class="app-bg" aria-hidden="true"></div>

<!-- Menu latéral -->
<aside class="sidebar" id="sidebar">
  <div class="sidebar-main">
    <div class="sidebar-top">
        <a href="index.html" class="sidebar-logo" aria-label="Airball, accueil">
            <img src="img/logo-airball.svg" alt="airball">
        </a>
        <button type="button" class="sidebar-toggle" id="sidebar-toggle" aria-controls="sidebar" aria-expanded="true" aria-label="Réduire le menu" title="Réduire le menu">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M9 3v18" stroke="currentColor" stroke-width="1.2"/><path class="sidebar-toggle-chevron" d="M16 15l-3-3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
    </div>
    <nav class="nav-list" aria-label="Navigation principale">
        <a href="index.html" class="nav-item">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.667 9.773v1.56a.667.667 0 0 1-.667.667 1.333 1.333 0 0 0-1.333 1.333v1.334M9.334 9.773v1.56a.667.667 0 0 0 .666.667 1.333 1.333 0 0 1 1.334 1.333v1.334M11.943 6.666H13a1.667 1.667 0 0 0 1.666-1.667V3.333a.667.667 0 0 0-.667-.667h-2M2.667 14.666h10.667M4 6a4 4 0 0 0 8 0V2a.667.667 0 0 0-.667-.666H4.667A.667.667 0 0 0 4 2v4ZM4.056 6.666H3A1.667 1.667 0 0 1 1.333 5V3.333a.667.667 0 0 1 .667-.667h2"/></svg>
            <span class="nav-label">Home</span>
        </a>
        <a href="pronostics.html" class="nav-item">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.666 3.334H14M8.666 8H14M8.666 12.666H14M2 11.333l1.333 1.334L6 10M2 4.667 3.333 6 6 3.334"/></svg>
            <span class="nav-label">Pronostics</span>
        </a>
        <a href="standings.html" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3"/></svg>
            <span class="nav-label">Statistiques NBA</span>
        </a>
        <a href="rules.html" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>
            <span class="nav-label">Règles du jeu</span>
        </a>
        <a href="palmares.html" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15M11 12 5.12 2.2M13 12l5.88-9.8M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/></svg>
            <span class="nav-label">Hall of Fame</span>
        </a>
        <a href="reveal.html" class="nav-item nav-item--reveal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c.5 3 3 4.5 4 7 1.3 3.2-.6 7-4 7s-5.3-3.8-4-7c.4 1 1.2 1.6 2 1.7C9.5 9 10.5 6 12 3Z"/><path d="M5 21h14"/></svg>
            <span class="nav-label">Le reveal</span>
        </a>
    </nav>
  </div>

    <!-- Chrono façon horloge des 24 secondes : jours restants avant la saison -->
    <div class="shot-clock" id="shot-clock" role="timer">
        <p class="shot-clock-label" id="shot-clock-label">Jours restants</p>
        <div class="shot-clock-screen"><div class="shot-clock-grid" id="shot-clock-grid" aria-hidden="true"></div></div>
    </div>
</aside>

<!-- Barre du haut : le titre reprend automatiquement l'icône et le nom de la page active -->
<header class="topbar">
    <div class="topbar-heading">
        <h1 class="topbar-title" id="page-title"></h1>
        <p class="topbar-sub" id="page-sub"></p>
    </div>
</header>
`;

function loadHeader() {
    const container = document.getElementById('header-container');
    if (!container) return;

    container.innerHTML = HEADER_HTML;

    // Page active : on compare le nom du fichier courant à celui de chaque lien du menu
    const rawPath = window.location.pathname;
    const currentFileName = rawPath.split('/').pop().toLowerCase();
    const isHome = currentFileName === '' || currentFileName === 'index.html';

    container.querySelectorAll('.nav-item').forEach(link => {
        const cleanHref = (link.getAttribute('href') || '').split('/').pop().toLowerCase();
        const isLinkHome = cleanHref === '' || cleanHref === 'index.html';
        const isActive = (isHome && isLinkHome) || (cleanHref !== '' && cleanHref === currentFileName);
        link.classList.toggle('active', isActive);
        if (isActive) link.setAttribute('aria-current', 'page');
    });

    // Titre de la barre du haut : icône + nom du lien actif du menu, et une phrase d'introduction
    const activeLink = container.querySelector('.nav-item.active');
    const pageTitle = document.getElementById('page-title');
    if (activeLink && pageTitle) {
        const icon = activeLink.querySelector('svg');
        if (icon) pageTitle.appendChild(icon.cloneNode(true));
        pageTitle.appendChild(document.createTextNode(activeLink.textContent.trim()));
    }
    const PAGE_SUBTITLES = {
        'index.html': `Le classement général de la saison ${SEASON_LABEL}, mis à jour chaque semaine.`,
        'pronostics.html': 'Les pronos de chaque joueur, ligne par ligne, et leur évolution.',
        'standings.html': 'Les classements des conférences et les leaders NBA en direct.',
        'rules.html': 'Le barème des points et le lot de la saison.',
        'palmares.html': 'Les vainqueurs des saisons précédentes.'
    };
    const pageSub = document.getElementById('page-sub');
    if (pageSub) {
        const file = isHome ? 'index.html' : currentFileName;
        pageSub.textContent = PAGE_SUBTITLES[file] || '';
        pageSub.hidden = !pageSub.textContent;
    }

    setupSidebarToggle(container);
    startShotClock();

    // Pages en maintenance ou masquées (onglet CONFIG du Sheet)
    if (typeof PageConfig !== 'undefined') {
        const preview = PageConfig.isPreview();
        PageConfig.watch((pages, reveal) => applyPageStatuses(container, pages, isHome ? 'index.html' : currentFileName, preview, reveal));
    }
}

// ---------- Pages masquées et état des inscriptions / du reveal ----------
function applyPageStatuses(container, pages, currentFile, preview, reveal = {}) {
    // Inscriptions closes : les boutons « Je prépare mes pronos » (data-signup) disparaissent
    // et les fausses popins proposent le reveal ; reveal lancé : lien « Le reveal » du menu
    document.body.classList.toggle('registration-closed', !!reveal.closed);
    document.body.classList.toggle('reveal-launched', !!reveal.launched);

    // Menu : liens des pages masquées retirés
    container.querySelectorAll('.nav-item').forEach(link => {
        const file = (link.getAttribute('href') || '').split('/').pop();
        link.hidden = PageConfig.statusOf(pages, PageConfig.keyOfFile(file)) === 'hidden' && !preview;
    });

    // Page d'inscription masquée : boutons « Je prépare mes pronos » retirés aussi
    document.body.classList.toggle('signup-hidden', PageConfig.statusOf(pages, 'inscription') === 'hidden' && !preview);

    // Page en cours : écran de maintenance à la place du contenu (sauf en aperçu)
    const status = PageConfig.statusOf(pages, PageConfig.keyOfFile(currentFile));
    const blocked = status === 'hidden' && !preview;
    document.body.classList.toggle('is-maintenance', blocked);
    const page = document.querySelector('.container');
    let screen = document.getElementById('maintenance-screen');
    if (blocked && !screen && page) {
        screen = document.createElement('section');
        screen.id = 'maintenance-screen';
        screen.className = 'maintenance-card';
        screen.innerHTML = `
            <span class="maintenance-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </span>
            <h2 class="maintenance-title">Page en maintenance</h2>
            <p class="maintenance-text">On refait une beauté à cette page. Elle revient très vite !</p>
            <a class="btn-primary" href="index.html">Retour au classement</a>`;
        page.appendChild(screen);
    } else if (!blocked && screen) {
        screen.remove();
    }

    // Bandeau discret en mode aperçu, pour ne pas oublier qu'il est actif
    if (preview && !document.getElementById('preview-banner')) {
        const local = PageConfig.isLocal();
        const banner = document.createElement(local ? 'p' : 'a');
        banner.id = 'preview-banner';
        banner.className = 'preview-banner';
        if (local) {
            banner.textContent = 'Version locale : les pages masquées restent visibles';
        } else {
            banner.href = '?apercu=0';
            banner.textContent = 'Mode aperçu : les pages masquées sont visibles · Quitter';
        }
        document.body.appendChild(banner);
    }
}

// ---------- Menu latéral réductible (état mémorisé d'une visite à l'autre) ----------
const SIDEBAR_KEY = 'airball:sidebarCollapsed';

function readSidebarPref() {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch (e) { return false; }
}

// Appliqué dès le chargement du script, avant l'injection du menu, pour éviter un saut de mise en page
if (readSidebarPref()) document.documentElement.classList.add('sidebar-collapsed');

function setupSidebarToggle(container) {
    const button = container.querySelector('#sidebar-toggle');
    if (!button) return;

    const apply = collapsed => {
        document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
        const label = collapsed ? 'Étendre le menu' : 'Réduire le menu';
        button.setAttribute('aria-expanded', String(!collapsed));
        button.setAttribute('aria-label', label);
        button.title = label;
        // Menu réduit : le nom de la page s'affiche au survol de l'icône
        container.querySelectorAll('.nav-item').forEach(link => {
            if (collapsed) link.title = link.textContent.trim(); else link.removeAttribute('title');
        });
    };

    apply(readSidebarPref());
    button.addEventListener('click', () => {
        const collapsed = !document.documentElement.classList.contains('sidebar-collapsed');
        apply(collapsed);
        try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch (e) { /* navigation privée : non mémorisé */ }
    });
}

// ==========================================
// CHRONO "SHOT CLOCK" : jours restants, en matrice de LED
//   avant le 20 oct. : jours avant le début · le 20 oct. : GO
//   pendant la saison : jours avant la fin · le dernier jour : 0 · ensuite : FIN
// Dates de la saison : js/config.js (SEASON_START, SEASON_END)
// ==========================================

// Police 5 × 7 points (1 = LED allumée), comme sur les horloges des 24 secondes
const LED_FONT = {
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
    'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001']
};

// Nombre de jours (calendaires) entre aujourd'hui et une date
function daysUntil(date, now = new Date()) {
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - today) / 86400000);
}

// Ce que le chrono affiche selon la période de la saison
function shotClockState(now = new Date()) {
    const toStart = daysUntil(SEASON_START, now);
    const toEnd = daysUntil(SEASON_END, now);
    const plural = n => (n > 1 ? 's' : '');
    if (toStart > 0) return { text: String(toStart), label: 'Début dans', aria: `${toStart} jour${plural(toStart)} avant le début de la saison` };
    if (toStart === 0) return { text: 'GO', label: "C'est parti !", aria: 'La saison commence aujourd’hui' };
    if (toEnd > 0) return { text: String(toEnd), label: 'Fin dans', aria: `${toEnd} jour${plural(toEnd)} avant la fin de la saison régulière` };
    if (toEnd === 0) return { text: '0', label: 'Dernier jour !', aria: 'Dernier jour de la saison régulière' };
    return { text: 'FIN', label: 'Saison terminée', aria: 'La saison régulière est terminée' };
}

function renderShotClock() {
    const clock = document.getElementById('shot-clock');
    const grid = document.getElementById('shot-clock-grid');
    if (!clock || !grid || !grid.parentElement.clientWidth) return;

    const { text, label, aria } = shotClockState();
    document.getElementById('shot-clock-label').textContent = label;
    clock.setAttribute('aria-label', aria);
    clock.title = aria;

    // Taille de la matrice : autant de LED que l'écran peut en contenir
    const screen = grid.parentElement;
    const css = getComputedStyle(screen);
    const led = parseFloat(css.getPropertyValue('--led')) || 3.635;
    const gap = parseFloat(css.getPropertyValue('--led-gap')) || 1;
    const cols = Math.floor((screen.clientWidth + gap) / (led + gap));
    const rows = Math.floor((screen.clientHeight + gap) / (led + gap));

    // Caractères de 5 × 7 LED séparés d'une colonne, centrés dans l'écran
    const textWidth = text.length * 6 - 1;
    const left = Math.floor((cols - textWidth) / 2);
    const top = Math.floor((rows - 7) / 2);

    const on = new Set();
    [...text].forEach((char, i) => {
        (LED_FONT[char] || []).forEach((line, y) => {
            [...line].forEach((bit, x) => {
                if (bit === '1') on.add((top + y) * cols + left + i * 6 + x);
            });
        });
    });

    grid.style.gridTemplateColumns = `repeat(${cols}, var(--led))`;
    let html = '';
    for (let i = 0; i < rows * cols; i++) html += '<i class="led"></i>';

    // Effet de profondeur (maquette) : les LED allumées sont dessinées sur un calque
    // légèrement plus espacé que la grille (+2 %), et un halo flou un peu plus décalé (+3 %)
    // en reprend une partie. Les carreaux « glissent » donc un peu hors de la grille.
    const pitch = led + gap;
    const cx = (left + textWidth / 2) * pitch;
    const cy = (top + 3.5) * pitch;
    const place = (index, stretch, shift) => {
        const x = (index % cols) * pitch, y = Math.floor(index / cols) * pitch;
        return `left:${(cx + (x - cx) * stretch + shift).toFixed(2)}px;top:${(cy + (y - cy) * stretch + shift).toFixed(2)}px`;
    };
    let lit = '', glow = '';
    on.forEach(index => {
        lit += `<i class="led-lit" style="${place(index, 1.02, 0)}"></i>`;
        // Halo sur environ 3 LED sur 4 (choix fixe, pas de scintillement)
        if ((index * 7) % 4 !== 0) glow += `<i class="led-glow" style="${place(index, 1.03, 0.8)}"></i>`;
    });
    grid.innerHTML = html + `<span class="led-layer" aria-hidden="true">${glow}${lit}</span>`;
}

function startShotClock() {
    renderShotClock();
    // Le nombre de jours change à minuit : on vérifie toutes les minutes
    setInterval(renderShotClock, 60 * 1000);
    // Menu réduit, rotation d'écran, passage mobile : la matrice s'adapte
    const screen = document.querySelector('.shot-clock-screen');
    if (screen && window.ResizeObserver) new ResizeObserver(() => renderShotClock()).observe(screen);
}

/**
 * Lit une date de l'onglet historique, quel que soit son format :
 * "2026-11-08", "2026-11-08T23:00:00.000Z", "08/11/2026" ou "08/11/26" (jour/mois/année).
 * Renvoie null si la date est invalide (ex. "20/20/26").
 */
function parseWeek(value) {
    const text = String(value || '').trim();
    let year, month, day;
    let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        // Date ISO envoyée par Apps Script : on la ramène à midi, heure locale, pour éviter les décalages de fuseau
        const parsed = new Date(text);
        if (isNaN(parsed)) return null;
        year = parsed.getFullYear(); month = parsed.getMonth() + 1; day = parsed.getDate();
        if (text.length === 10) { year = +m[1]; month = +m[2]; day = +m[3]; }
    } else if ((m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {
        day = +m[1]; month = +m[2]; year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    } else {
        return null;
    }
    const date = new Date(year, month - 1, day, 12);
    // Refuse les dates impossibles (mois 20, 31 février...)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
}

/**
 * Neutralise le HTML d'un texte venant du Sheet (pseudo, noms...).
 * À utiliser à chaque fois qu'une valeur saisie par un joueur est
 * insérée dans la page via innerHTML.
 */
function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
}

/**
 * Avatar d'un joueur (Home et Pronostics) : sa photo si le Sheet en fournit une,
 * sinon la première lettre de son pseudo.
 */
function renderAvatarHtml(avatarUrl, playerName) {
    const url = avatarUrl ? String(avatarUrl).trim() : '';
    // Photo en ligne, image encodée, ou photo du site (img/..., utilisée par le mode démo)
    if (url.startsWith('http') || url.startsWith('data:image') || /^img\/[\w\/.-]+\.(jpe?g|png|webp|gif)$/i.test(url)) {
        return `<img src="${escapeHtml(url)}" alt="${escapeHtml(playerName)}">`;
    }
    return escapeHtml(String(playerName).charAt(0).toUpperCase());
}

// Catégories de stats et d'awards, partagées par pronostics.js et standings.js
const STAT_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk'];
const AWARD_KEYS = ['mvp', 'coy', 'roy', 'mip', 'dpoy', 'sixth'];
const CATEGORY_LABELS = {
    pts: 'Points', reb: 'Rebonds', ast: 'Passes', stl: 'Interceptions', blk: 'Contres',
    mvp: 'MVP', coy: 'COY', roy: 'ROY', mip: 'MIP', dpoy: 'DPOY', sixth: '6th Man'
};

document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
});



// ==========================================
// FAUSSE POPIN « AVANT LA RÉVÉLATION » (Home, Pronostics)
// Affichée dès le chargement avant le début de la saison, sans attendre le Google Sheet.
// Le dernier état connu (reveal forcé ou non) est retenu dans le navigateur.
// ==========================================
const RevealLock = (() => {
    const REVEAL_DATE = SEASON_START;
    const KEY = 'airball:revealed';
    const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="#717171" stroke-width="2" stroke-linecap="round"/></svg>';

    function countdownText() {
        const days = daysUntil(REVEAL_DATE);
        if (days > 1) return `Tip-off dans ${days} jours`;
        if (days === 1) return 'Tip-off demain';
        return 'Tip-off imminent';
    }

    // scope : 'home' (classement) ou 'pronos' : chaque page retient son propre état
    function remember(revealed, scope = 'home') {
        try { localStorage.setItem(`${KEY}:${scope}`, revealed ? '1' : '0'); } catch (e) { /* stockage indisponible */ }
    }

    function shouldLockNow(scope = 'home') {
        let saved = null;
        try { saved = localStorage.getItem(`${KEY}:${scope}`); } catch (e) { /* stockage indisponible */ }
        if (saved === '1') return false;
        if (saved === '0') return true;
        return new Date() < REVEAL_DATE;
    }

    // target : le bloc de contenu à masquer ; options : textes propres à la page
    function show(target, o) {
        if (!target || document.getElementById('reveal-lock')) return;
        target.hidden = true;
        document.body.classList.add('is-reveal-locked');
        const bar = faded => `<div class="deco-popin-bar${faded ? ' is-faded' : ''}"><span>${o.windowName}</span>${CLOSE_ICON}</div>`;
        target.insertAdjacentHTML('afterend', `
            <section class="reveal-lock" id="reveal-lock" aria-labelledby="reveal-title">
                <div class="reveal-stack" aria-hidden="true">
                    <div class="deco-popin reveal-popin reveal-popin--back2">${bar(true)}<div class="deco-popin-view"></div></div>
                    <div class="deco-popin reveal-popin reveal-popin--back1">${bar(true)}<div class="deco-popin-view"></div></div>
                    <div class="deco-popin reveal-popin reveal-popin--front">${bar(false)}<div class="deco-popin-view"><img src="${o.gif}" alt="" onerror="this.remove()"></div></div>
                </div>
                <div class="reveal-copy">
                    <p class="reg-kicker reveal-kicker">${countdownText()}</p>
                    <h2 class="reveal-title" id="reveal-title"><span class="rv-pre">${o.title}</span><span class="rv-launched">${o.launchedTitle}</span></h2>
                    <p class="reveal-text rv-open">${o.text}</p>
                    <p class="reveal-text rv-closed">${o.closedText}</p>
                    <p class="reveal-text rv-launched">${o.launchedText}</p>
                    <div class="reveal-actions rv-open">
                        <a href="register.html" class="btn-primary reveal-cta" data-signup>Je prépare mes pronos <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></a>
                        <a href="rules.html" class="reveal-link">Lire le playbook</a>
                    </div>
                    <div class="reveal-actions rv-closed">
                        <span class="btn-primary reveal-cta is-disabled" aria-disabled="true">Regarder le reveal <span class="soon-tag">Bientôt</span></span>
                    </div>
                    <div class="reveal-actions rv-launched">
                        <a href="reveal.html" class="btn-primary reveal-cta">Regarder le reveal</a>
                    </div>
                </div>
            </section>`);
    }

    function hide(target) {
        const lock = document.getElementById('reveal-lock');
        if (lock) lock.remove();
        if (target) target.hidden = false;
        document.body.classList.remove('is-reveal-locked');
    }

    return { show, hide, remember, shouldLockNow };
})();

const REVEAL_TEXTS = {
    home: {
        windowName: 'vestiaire_airball',
        gif: 'img/home/reveal.gif',
        title: 'On s’échauffe',
        text: 'Le 20 octobre, le classement tombe et les excuses aussi. Fais tes pronos avant qu’il ne soit trop tard.',
        closedText: 'L’effectif est complet. Le reveal des pronos arrive très bientôt&nbsp;: hot takes, âmes sœurs et grosses surprises au programme.',
        launchedTitle: 'Le reveal est là',
        launchedText: 'Les pronos de chacun sont enfin dévoilés. Installe-toi, mets pause quand tu veux, et prépare tes arguments.'
    },
    pronostics: {
        windowName: 'pronos_confidentiels',
        gif: 'img/pronostics/reveal.gif',
        title: 'Vestiaire fermé',
        text: 'Les pronos de chacun restent au vestiaire jusqu’au 20 octobre. Pas de copie possible&nbsp;: prépare les tiens.',
        closedText: 'Les pronos de chacun restent au vestiaire jusqu’au reveal. Encore un peu de patience&nbsp;!',
        launchedTitle: 'Le reveal est là',
        launchedText: 'Les pronos sont dévoilés : commence par le reveal, tout est dedans.'
    }
};
