// ==========================================
// COMMUN À TOUTES LES PAGES
// Header dynamique + compte à rebours + utilitaire avatar partagé
// ==========================================

async function loadHeader() {
    const container = document.getElementById('header-container');
    if (!container) return;

    try {
        const response = await fetch('header.html');
        const html = await response.text();
        container.innerHTML = html;

        // Détection automatique de la page active (Version ultra-robuste pour l'accueil/leaderboard)
        const rawPath = window.location.pathname;
        const currentFileName = rawPath.split('/').pop().toLowerCase();
        const isHome = rawPath === '/' || currentFileName === '' || currentFileName === 'index.html';

        const navLinks = container.querySelectorAll('a');

        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;

            const cleanHref = href.split('/').pop().toLowerCase();
            const isLinkHome = href === '/' || href === './' || cleanHref === '' || cleanHref === 'index.html';

            // Si on est sur l'accueil et que le lien pointe vers l'accueil, OU si les noms de fichiers correspondent
            if ((isHome && isLinkHome) || (cleanHref && cleanHref === currentFileName)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Lancement du compte à rebours une fois le header injecté
        startCountdown();

    } catch (error) {
        console.error("Erreur lors du chargement du header commun :", error);
    }
}

function startCountdown() {
    const seasonStartDate = new Date('2026-10-20T00:00:00').getTime();
    const timerElement = document.getElementById('timer');

    if (!timerElement) return;

    function updateTimer() {
        const now = new Date().getTime();
        const distance = seasonStartDate - now;

        if (distance < 0) {
            timerElement.innerHTML = "C'est la saison ! 🏀";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        timerElement.innerHTML = `${days}j ${hours}h ${minutes}m ${seconds}s`;
    }

    updateTimer();
    setInterval(updateTimer, 1000);
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
