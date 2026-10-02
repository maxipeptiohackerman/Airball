// ==========================================
// COMMUN À TOUTES LES PAGES
// Menu + barre du haut + compte à rebours + utilitaires partagés
// ==========================================

// Menu latéral + barre du haut, communs à toutes les pages.
// Écrits ici plutôt que dans un fichier header.html séparé : plus de requête
// réseau, plus de risque qu'une version incomplète du fichier soit servie.
const HEADER_HTML = `
<!-- Fond décoratif commun (terrain, texture, halos) -->
<div class="app-bg" aria-hidden="true"></div>

<!-- Menu latéral -->
<aside class="sidebar" id="sidebar">
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
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12.5 17.4993V10.8327C12.5 10.6117 12.4122 10.3997 12.2559 10.2434C12.0996 10.0871 11.8877 9.99935 11.6667 9.99935H8.33333C8.11232 9.99935 7.90036 10.0871 7.74408 10.2434C7.5878 10.3997 7.5 10.6117 7.5 10.8327V17.4993M2.5 8.33308C2.49994 8.09064 2.55278 7.8511 2.65482 7.63118C2.75687 7.41126 2.90566 7.21625 3.09083 7.05975L8.92417 2.05975C9.22499 1.80551 9.60613 1.66602 10 1.66602C10.3939 1.66602 10.775 1.80551 11.0758 2.05975L16.9092 7.05975C17.0943 7.21625 17.2431 7.41126 17.3452 7.63118C17.4472 7.8511 17.5001 8.09064 17.5 8.33308V15.8331C17.5 16.2751 17.3244 16.699 17.0118 17.0116C16.6993 17.3242 16.2754 17.4997 15.8333 17.4997H4.16667C3.72464 17.4997 3.30072 17.3242 2.98816 17.0116C2.67559 16.699 2.5 16.2751 2.5 15.8331V8.33308Z" stroke="currentColor" stroke-linecap="round"/></svg>
            <span class="nav-label">Home</span>
        </a>
        <a href="pronostics.html" class="nav-item">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M17.8458 16.1779C17.5332 16.4904 17.1093 16.666 16.6672 16.666H3.33282C2.89075 16.666 2.4668 16.4904 2.15421 16.1779C1.84162 15.8653 1.66602 15.4414 1.66602 14.9994V4.16659C1.66602 3.72458 1.84162 3.30068 2.15421 2.98813C2.4668 2.67559 2.89075 2.5 3.33282 2.5H6.60808C6.88402 2.50005 7.15564 2.56859 7.39856 2.69949C7.64147 2.83038 7.84809 3.01953 7.99986 3.24996L8.67491 4.24992C8.82822 4.48272 9.03748 4.67335 9.28354 4.80437C9.5296 4.9354 9.80459 5.00262 10.0834 4.99988H16.6672C17.1093 4.99988 17.5332 5.17547 17.8458 5.48801C18.1584 5.80056 18.334 6.22446 18.334 6.66647V14.9994C18.334 15.4414 18.1584 15.8653 17.8458 16.1779Z" stroke="currentColor" stroke-linecap="round"/></svg>
            <span class="nav-label">Pronostics</span>
        </a>
        <!-- Absent de la maquette : conservé pour ne pas rendre la page inaccessible -->
        <a href="standings.html" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="nav-label">Statistiques NBA</span>
        </a>
        <a href="rules.html" class="nav-item">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 5.83333V17.5M10 5.83333C10 4.94928 9.6488 4.10143 9.02363 3.47631C8.39846 2.85119 7.55054 2.5 6.66642 2.5H2.49942C2.27838 2.5 2.06641 2.5878 1.91011 2.74408C1.75382 2.90036 1.66602 3.11232 1.66602 3.33333V14.1667C1.66602 14.3877 1.75382 14.5996 1.91011 14.7559C2.06641 14.9122 2.27838 15 2.49942 15H7.49982C8.16291 15 8.79885 15.2634 9.26772 15.7322C9.7366 16.2011 10 16.837 10 17.5M10 5.83333C10 4.94928 10.3512 4.10143 10.9764 3.47631C11.6016 2.85119 12.4495 2.5 13.3336 2.5H17.5006C17.7216 2.5 17.9336 2.5878 18.0899 2.74408C18.2462 2.90036 18.334 3.11232 18.334 3.33333V14.1667C18.334 14.3877 18.2462 14.5996 18.0899 14.7559C17.9336 14.9122 17.7216 15 17.5006 15H12.5002C11.8371 15 11.2012 15.2634 10.7323 15.7322C10.2634 16.2011 10 16.837 10 17.5" stroke="currentColor" stroke-linecap="round"/></svg>
            <span class="nav-label">Règles du jeu</span>
        </a>
        <a href="palmares.html" class="nav-item">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="nav-label">Hall of Fame</span>
        </a>
    </nav>
</aside>

<!-- Barre du haut : le titre reprend automatiquement l'icône et le nom de la page active -->
<header class="topbar">
    <h1 class="topbar-title" id="page-title"></h1>
    <div class="countdown" id="timer" role="timer" title="Temps restant avant le lancement de la saison (jours.heures.minutes.secondes)">--.--.--.--</div>
    <div class="topbar-actions">
        <a href="https://docs.google.com/spreadsheets/d/1Xql6edK-9Lowd3c0d8BIYzlCJrxolXDB/export?format=xlsx" class="btn-cta btn-cta--light" title="Télécharger le modèle Excel pour préparer ses pronos">Je me prépare</a>
        <a href="register.html" class="btn-cta btn-cta--lime">Je m’inscris</a>
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

    // Titre de la barre du haut : icône + nom du lien actif du menu
    const activeLink = container.querySelector('.nav-item.active');
    const pageTitle = document.getElementById('page-title');
    if (activeLink && pageTitle) {
        const icon = activeLink.querySelector('svg');
        if (icon) pageTitle.appendChild(icon.cloneNode(true));
        pageTitle.appendChild(document.createTextNode(activeLink.textContent.trim()));
    }

    setupSidebarToggle(container);
    startCountdown();
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

function startCountdown() {
    const seasonStartDate = new Date('2026-10-20T00:00:00').getTime();
    const timerElement = document.getElementById('timer');

    if (!timerElement) return;

    function updateTimer() {
        const now = new Date().getTime();
        const distance = seasonStartDate - now;

        if (distance < 0) {
            timerElement.textContent = "C'est la saison !";
            clearInterval(timerId);
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        const pad = n => String(n).padStart(2, '0');

        // Format de la maquette : jours.heures.minutes.secondes (ex. 23.12.57.48)
        timerElement.textContent = `${pad(days)}.${pad(hours)}.${pad(minutes)}.${pad(seconds)}`;
    }

    const timerId = setInterval(updateTimer, 1000);
    updateTimer();
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
 * Génère le HTML d'un avatar à partir du contenu brut renvoyé par le Sheet
 * (une URL ou data:image -> <img>, sinon la première lettre du pseudo en repli).
 * Utilisé à la fois par le Leaderboard et la Fiche joueur, pour ne pas dupliquer
 * cette logique à deux endroits différents.
 */
function renderAvatarHtml(avatarContent, playerName) {
    const avatarStr = avatarContent ? String(avatarContent).trim() : '';
    if (avatarStr.startsWith('http') || avatarStr.startsWith('data:image')) {
        return `<img src="${escapeHtml(avatarStr)}" alt="${escapeHtml(playerName)}">`;
    }
    if (avatarStr) return escapeHtml(avatarStr);
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
