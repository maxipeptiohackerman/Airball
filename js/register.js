/**
 * AIRBALL - Fichier de logique pour l'onboarding et les pronostics (register.js)
 */

let currentStep = 1;
const totalSteps = 5;
let nbaPlayers = [];
let nbaCoaches = [];

const steps = document.querySelectorAll('.wizard-step');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const stepIndicators = document.querySelectorAll('.step-indicator');
const bannerTitle = document.getElementById('banner-title');

// Couleurs officielles des équipes NBA pour les maillots dynamiques
const teamColors = {
    "Los Angeles Lakers": "#552583",
    "Golden State Warriors": "#1D428A",
    "Dallas Mavericks": "#00538C",
    "Denver Nuggets": "#0E2240",
    "Boston Celtics": "#007A33",
    "Milwaukee Bucks": "#00471B",
    "Oklahoma City Thunder": "#007AC1",
    "San Antonio Spurs": "#111111",
    "Minnesota Timberwolves": "#0C2340",
    "Memphis Grizzlies": "#5D76A9",
    "Utah Jazz": "#002B5C",
    "Atlanta Hawks": "#E03A3E",
    "Indiana Pacers": "#FDBB30",
    "Orlando Magic": "#0077C0",
    "Phoenix Suns": "#E56020",
    "Philadelphia 76ers": "#006BB6",
    "Cleveland Cavaliers": "#6F263D",
    "New York Knicks": "#F58426",
    "Chicago Bulls": "#CE1141",
    "Miami Heat": "#98002E",
    "Brooklyn Nets": "#000000",
    "Toronto Raptors": "#CE1141",
    "New Orleans Pelicans": "#0C2340",
    "Sacramento Kings": "#5A2D81",
    "Washington Wizards": "#002B49",
    "Houston Rockets": "#CE1141",
    "Detroit Pistons": "#C8102E",
    "Charlotte Hornets": "#1D1160",
    "Portland Trail Blazers": "#E03A3E",
    "Los Angeles Clippers": "#C8102E"
};

/**
 * Générateur dynamique d'une illustration de maillot sécurisée par encodage
 */
function getTeamJerseySvg(teamName) {
    const color = teamColors[teamName] || "#94a3b8"; // Gris neutre par défaut (dummy maillot)
    
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M30,15 L40,8 C45,12 55,12 60,8 L70,15 L82,30 L70,38 L70,90 L30,90 L30,38 L18,30 Z" fill="${color}"/>
        <path d="M40,8 Q50,22 60,8 Z" fill="#ffffff" opacity="0.9"/>
        <circle cx="50" cy="55" r="15" fill="#ffffff" opacity="0.2"/>
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

// Catégories de Statistiques Individuelles
const statsCategories = [
    { id: 'pts', title: '🔥 Meilleur Marqueur (Points)' },
    { id: 'reb', title: '🛡️ Meilleur Rebondeur (Rebounds)' },
    { id: 'ast', title: '🎯 Meilleur Passeur (Assists)' },
    { id: 'stl', title: '⚡ Meilleur Intercepteur (Steals)' },
    { id: 'blk', title: '🧱 Meilleur Contreur (Blocks)' }
];

// Catégories des Awards de la Saison
const awardsCategories = [
    { id: 'mvp', title: '🥇 MVP (Most Valuable Player)' },
    { id: 'coy', title: '📋 COY (Coach Of the Year)' },
    { id: 'roy', title: '⭐ ROY (Rookie Of the Year)' },
    { id: 'mip', title: '📈 MIP (Most Improved Player)' },
    { id: 'dpoy', title: '🔒 DPOY (Defensive Player)' },
    { id: 'sixth', title: '🔥 6th Man Of the Year' }
];

/**
 * Chargement simultané des fichiers players.json et coaches.json
 */
async function loadData() {
    try {
        const [playersRes, coachesRes] = await Promise.all([
            fetch('players.json'),
            fetch('coaches.json')
        ]);
        
        if (!playersRes.ok || !coachesRes.ok) throw new Error("Impossible de charger les fichiers de données");
        
        nbaPlayers = await playersRes.json();
        nbaCoaches = await coachesRes.json();
        
        buildPodiumSections();
    } catch (error) {
        console.error("Erreur lors du chargement des données :", error);
    }
}

/**
 * Génération dynamique des blocs de podiums (Stats & Awards)
 */
function buildPodiumSections() {
    const statsContainer = document.getElementById('stats-container');
    if (statsContainer) {
        statsCategories.forEach(cat => {
            statsContainer.innerHTML += createCategoryHTML(cat.id, cat.title);
        });
    }

    const awardsContainer = document.getElementById('awards-container');
    if (awardsContainer) {
        awardsCategories.forEach(cat => {
            awardsContainer.innerHTML += createCategoryHTML(cat.id, cat.title);
        });
    }

    setupSearchListeners();
}

function createCategoryHTML(catId, catTitle) {
    const dummyJersey = getTeamJerseySvg("Default");
    // Placeholder spécifique pour le COY
    const placeholderText = (catId === 'coy') ? '🔍 Rechercher un coach...' : '🔍 Rechercher un joueur...';

    return `
        <div class="category-container">
            <div class="category-title">${catTitle}</div>
            <div class="podium-grid">
                ${[1, 2, 3].map(pickNum => `
                    <div class="podium-slot">
                        <span class="podium-label">Pick #${pickNum}</span>
                        <div class="player-search-container">
                            <input type="text" class="player-search-input" placeholder="${placeholderText}" data-category="${catId}" data-pick="${pickNum}" autocomplete="off">
                            <div class="search-results-dropdown"></div>
                        </div>
                        <div id="card-${catId}-${pickNum}" class="selected-player-card">
                            <img src='${dummyJersey}' alt='Maillot' style='width: 40px; height: 40px;'>
                            <div class="selected-player-info">
                                <div class="selected-player-name">Aucun sélectionné</div>
                            </div>
                        </div>
                        <input type="hidden" name="${catId}_pick_${pickNum}" id="input-${catId}-${pickNum}" value="">
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Gestion de la recherche interactive (joueurs ou coachs selon la catégorie)
 */
function setupSearchListeners() {
    document.querySelectorAll('.player-search-input').forEach(input => {
        const dropdown = input.nextElementSibling;
        const catId = input.getAttribute('data-category');
        const pickNum = input.getAttribute('data-pick');

        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            // Utilisation de la liste des coachs pour le COY, et des joueurs pour le reste
            const sourceList = (catId === 'coy') ? nbaCoaches : nbaPlayers;
            const filtered = sourceList.filter(item => item.name.toLowerCase().includes(query));

            if (filtered.length === 0) {
                const notFoundMsg = (catId === 'coy') ? 'Aucun coach trouvé' : 'Aucun joueur trouvé';
                dropdown.innerHTML = `<div class="search-result-item" style="color: #64748b; padding: 12px 16px;">${notFoundMsg}</div>`;
                dropdown.style.display = 'block';
                return;
            }

            dropdown.innerHTML = filtered.map(item => {
                return `
                    <div class="search-result-item" data-name="${item.name}" data-team="${item.team || ''}" style="padding: 10px 14px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9;">
                        <span style="font-weight: 600; color: #1e293b;">${item.name}</span>
                        <span style="font-size: 0.8rem; color: #64748b; background: #f8fafc; padding: 2px 6px; border-radius: 4px;">${item.team || ''}</span>
                    </div>
                `;
            }).join('');

            dropdown.style.display = 'block';
        });

        // Clic sur un élément de la liste déroulante
        dropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.search-result-item');
            if (!item) return;

            const name = item.getAttribute('data-name');
            const team = item.getAttribute('data-team');

            input.value = name;
            dropdown.style.display = 'none';

            // Injection dans l'input caché pour le formulaire
            document.getElementById(`input-${catId}-${pickNum}`).value = name;
            
            // Mise à jour de la carte visuelle avec le maillot de l'équipe
            const card = document.getElementById(`card-${catId}-${pickNum}`);
            const imgEl = card.querySelector('img');
            
            imgEl.src = getTeamJerseySvg(team);
            card.querySelector('.selected-player-name').textContent = `${name} (${team})`;
        });
    });

    // Fermer les dropdowns si on clique en dehors
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.player-search-container')) {
            document.querySelectorAll('.search-results-dropdown').forEach(d => d.style.display = 'none');
        }
    });
}

/**
 * Mise à jour dynamique des badges de classement lors du Drag & Drop
 */
function updateRanks(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const items = container.querySelectorAll('.team-row-item');
    items.forEach((item, index) => {
        const rankBadge = item.querySelector('.team-rank-badge');
        const rank = index + 1;
        let suffix = 'th';
        if (rank === 1) suffix = 'st';
        else if (rank === 2) suffix = 'nd';
        else if (rank === 3) suffix = 'rd';
        rankBadge.textContent = `${rank}${suffix}`;
    });
}

/**
 * Gestion de la navigation dans le Wizard (Étapes 1 à 5)
 */
/**
 * Gestion de la navigation dans le Wizard (Étapes 1 à 5)
 */
function updateWizard() {
    steps.forEach((step, index) => {
        step.classList.toggle('active', index + 1 === currentStep);
    });

        // Mise à jour de l'indicateur textuel (haut ET bas du wizard)
    if (stepIndicators.length) {
        stepIndicators.forEach(el => {
            el.textContent = `Étape ${currentStep} sur ${totalSteps}`;
        });
    }
    
    // Mise à jour dynamique de la progress bar en pourcentage
    const progressFill = document.getElementById('wizard-progress-fill');
    if (progressFill) {
        const percentage = (currentStep / totalSteps) * 100;
        progressFill.style.width = `${percentage}%`;
    }

    prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-block';
    
    if (currentStep === 1) bannerTitle.textContent = "Airball - Inscription";
    else if (currentStep === 2) bannerTitle.textContent = "Eastern Conference";
    else if (currentStep === 3) bannerTitle.textContent = "Western Conference";
    else if (currentStep === 4) bannerTitle.textContent = "Statistiques Individuelles";
    else if (currentStep === 5) bannerTitle.textContent = "Awards de la Saison";

    if (currentStep === totalSteps) {
        nextBtn.textContent = 'Valider mes pronos 🚀';
        nextBtn.className = 'btn btn-submit';
    } else {
        nextBtn.textContent = 'Suivant';
        nextBtn.className = 'btn btn-next';
    }
}

nextBtn.addEventListener('click', () => {
    if (currentStep < totalSteps) {
        currentStep++;
        updateWizard();
    } else {
        alert("🎉 Tous tes pronos ont été validés avec succès !");
    }
});

prevBtn.addEventListener('click', () => {
    if (currentStep > 1) {
        currentStep--;
        updateWizard();
    }
});

/**
 * Initialisation de SortableJS pour les classements Est et Ouest
 */
const eastList = document.getElementById('east-list');
const westList = document.getElementById('west-list');

if (eastList) {
    new Sortable(eastList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: () => updateRanks('east-list')
    });
}

if (westList) {
    new Sortable(westList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: () => updateRanks('west-list')
    });
}

// Lancement automatique du chargement des données au démarrage
loadData();