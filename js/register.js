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

// Identifiant de cette inscription, choisi ici : si le joueur renvoie le formulaire
// (connexion coupée, second clic), le serveur reconnaît la même inscription et ne crée pas de doublon.
const registrationId = 'p' + Array.from(
    (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(4)) : [0, 0, 0, 0].map(() => Math.floor(Math.random() * 256)),
    byte => byte.toString(16).padStart(2, '0')
).join('');

// Après l'envoi, on vérifie que l'inscription est bien enregistrée (5 essais espacés)
const CONFIRM_ATTEMPTS = 5;
const CONFIRM_DELAY_MS = 1500;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const PSEUDO_MESSAGES = {
    too_short: 'Ton pseudo doit faire au moins 2 caractères.',
    too_long: 'Ton pseudo doit faire 24 caractères maximum.',
    bad_start: 'Ton pseudo ne peut pas commencer par = + - @ ou une apostrophe.',
    bad_chars: 'Ton pseudo contient un caractère interdit (< > " \\ `).',
    taken: 'Ce pseudo est déjà pris, choisis-en un autre.'
};

function normalizePseudo(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

// Mêmes règles que le serveur, pour répondre tout de suite sans attendre le réseau
function pseudoProblem(pseudo) {
    if (pseudo.length < 2) return 'too_short';
    if (pseudo.length > 24) return 'too_long';
    if (/^[=+\-@']/.test(pseudo)) return 'bad_start';
    if (/[<>"\\`\u0000-\u001f]/.test(pseudo)) return 'bad_chars';
    return '';
}

function showPseudoError(message) {
    const box = document.getElementById('pseudo-error');
    box.textContent = message;
    box.hidden = false;
    document.getElementById('pseudo').focus();
}

function clearPseudoError() {
    document.getElementById('pseudo-error').hidden = true;
}

function showSubmitError(message) {
    const box = document.getElementById('submit-error');
    box.textContent = message;
    box.hidden = !message;
}

// Remplace le formulaire par un message (inscriptions fermées, inscription confirmée)
function showNotice(title, text, linkLabel) {
    document.querySelector('.wizard-header-bar').hidden = true;
    document.querySelector('.wizard-progress-container').hidden = true;
    document.getElementById('onboarding-form').hidden = true;

    const notice = document.getElementById('register-notice');
    notice.innerHTML = `<h2></h2><p></p><a class="btn btn-next" href="index.html"></a>`;
    notice.querySelector('h2').textContent = title;
    notice.querySelector('p').textContent = text;
    notice.querySelector('a').textContent = linkLabel;
    notice.hidden = false;
    window.scrollTo({ top: 0 });
}

function showClosedNotice(duringFilling) {
    showNotice(
        '🔒 Les inscriptions sont fermées',
        duringFilling
            ? "Les inscriptions ont fermé pendant que tu remplissais le formulaire : ton inscription n'a malheureusement pas été enregistrée."
            : "La saison a commencé, ou l'organisateur a fermé les inscriptions : il n'est plus possible de s'inscrire pour cette saison.",
        'Voir le classement'
    );
}

// Couleurs officielles des équipes NBA pour les maillots dynamiques
const teamColors = {
    "Los Angeles Lakers": "#552583", "Golden State Warriors": "#1D428A",
    "Dallas Mavericks": "#00538C", "Denver Nuggets": "#0E2240",
    "Boston Celtics": "#007A33", "Milwaukee Bucks": "#00471B",
    "Oklahoma City Thunder": "#007AC1", "San Antonio Spurs": "#111111",
    "Minnesota Timberwolves": "#0C2340", "Memphis Grizzlies": "#5D76A9",
    "Utah Jazz": "#002B5C", "Atlanta Hawks": "#E03A3E",
    "Indiana Pacers": "#FDBB30", "Orlando Magic": "#0077C0",
    "Phoenix Suns": "#E56020", "Philadelphia 76ers": "#006BB6",
    "Cleveland Cavaliers": "#6F263D", "New York Knicks": "#F58426",
    "Chicago Bulls": "#CE1141", "Miami Heat": "#98002E",
    "Brooklyn Nets": "#000000", "Toronto Raptors": "#CE1141",
    "New Orleans Pelicans": "#0C2340", "Sacramento Kings": "#5A2D81",
    "Washington Wizards": "#002B49", "Houston Rockets": "#CE1141",
    "Detroit Pistons": "#C8102E", "Charlotte Hornets": "#1D1160",
    "Portland Trail Blazers": "#E03A3E", "Los Angeles Clippers": "#C8102E"
};

function getTeamJerseySvg(teamName) {
    const color = teamColors[teamName] || "#94a3b8";
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M30,15 L40,8 C45,12 55,12 60,8 L70,15 L82,30 L70,38 L70,90 L30,90 L30,38 L18,30 Z" fill="${color}"/>
        <path d="M40,8 Q50,22 60,8 Z" fill="#ffffff" opacity="0.9"/>
        <circle cx="50" cy="55" r="15" fill="#ffffff" opacity="0.2"/>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

const statsCategories = [
    { id: 'pts', title: '🔥 Meilleur Marqueur (Points)' },
    { id: 'reb', title: '🛡️ Meilleur Rebondeur (Rebounds)' },
    { id: 'ast', title: '🎯 Meilleur Passeur (Assists)' },
    { id: 'stl', title: '⚡ Meilleur Intercepteur (Steals)' },
    { id: 'blk', title: '🧱 Meilleur Contreur (Blocks)' }
];

const awardsCategories = [
    { id: 'mvp', title: '🥇 MVP (Most Valuable Player)' },
    { id: 'coy', title: '📋 COY (Coach Of the Year)' },
    { id: 'roy', title: '⭐ ROY (Rookie Of the Year)' },
    { id: 'mip', title: '📈 MIP (Most Improved Player)' },
    { id: 'dpoy', title: '🔒 DPOY (Defensive Player)' },
    { id: 'sixth', title: '🔥 6th Man Of the Year' }
];

async function loadData() {
    try {
        const [playersRes, coachesRes] = await Promise.all([
            fetch('players.json'), fetch('coaches.json')
        ]);
        if (!playersRes.ok || !coachesRes.ok) throw new Error("Erreur de chargement des données");
        nbaPlayers = await playersRes.json();
        nbaCoaches = await coachesRes.json();
        buildPodiumSections();
    } catch (error) {
        console.error("Erreur :", error);
    }
}

function buildPodiumSections() {
    const statsContainer = document.getElementById('stats-container');
    if (statsContainer) {
        statsCategories.forEach(cat => { statsContainer.innerHTML += createCategoryHTML(cat.id, cat.title); });
    }
    const awardsContainer = document.getElementById('awards-container');
    if (awardsContainer) {
        awardsCategories.forEach(cat => { awardsContainer.innerHTML += createCategoryHTML(cat.id, cat.title); });
    }
    setupSearchListeners();
}

function createCategoryHTML(catId, catTitle) {
    const dummyJersey = getTeamJerseySvg("Default");
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

function setupSearchListeners() {
    document.querySelectorAll('.player-search-input').forEach(input => {
        const dropdown = input.nextElementSibling;
        const catId = input.getAttribute('data-category');
        const pickNum = input.getAttribute('data-pick');

        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query.length === 0) { dropdown.style.display = 'none'; return; }

            const selectedNames = [];
            for (let i = 1; i <= 3; i++) {
                if (i.toString() !== String(pickNum)) {
                    const hiddenInput = document.getElementById(`input-${catId}-${i}`);
                    if (hiddenInput && hiddenInput.value) selectedNames.push(hiddenInput.value.toLowerCase());
                }
            }

            const sourceList = (catId === 'coy') ? nbaCoaches : nbaPlayers;
            const filtered = sourceList.filter(item => item.name.toLowerCase().includes(query) && !selectedNames.includes(item.name.toLowerCase()));

            if (filtered.length === 0) {
                dropdown.innerHTML = `<div class="search-result-item" style="color: #64748b; padding: 12px 16px;">Aucun résultat disponible</div>`;
                dropdown.style.display = 'block';
                return;
            }

            dropdown.innerHTML = filtered.map(item => `
                <div class="search-result-item" data-name="${item.name}" data-team="${item.team || ''}" style="padding: 10px 14px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-weight: 600; color: #1e293b;">${item.name}</span>
                    <span style="font-size: 0.8rem; color: #64748b; background: #f8fafc; padding: 2px 6px; border-radius: 4px;">${item.team || ''}</span>
                </div>
            `).join('');
            dropdown.style.display = 'block';
        });

        dropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.search-result-item');
            if (!item) return;
            const name = item.getAttribute('data-name');
            const team = item.getAttribute('data-team');
            input.value = name;
            dropdown.style.display = 'none';
            document.getElementById(`input-${catId}-${pickNum}`).value = name;
            const card = document.getElementById(`card-${catId}-${pickNum}`);
            card.querySelector('img').src = getTeamJerseySvg(team);
            card.querySelector('.selected-player-name').textContent = `${name} (${team})`;
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.player-search-container')) {
            document.querySelectorAll('.search-results-dropdown').forEach(d => d.style.display = 'none');
        }
    });
}

function updateRanks(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.team-row-item').forEach((item, index) => {
        const rank = index + 1;
        let suffix = 'th';
        if (rank === 1) suffix = 'st'; else if (rank === 2) suffix = 'nd'; else if (rank === 3) suffix = 'rd';
        item.querySelector('.team-rank-badge').textContent = `${rank}${suffix}`;
    });
}

function updateWizard() {
    steps.forEach((step, index) => { step.classList.toggle('active', index + 1 === currentStep); });
    if (stepIndicators.length) {
        stepIndicators.forEach(el => { el.textContent = `Étape ${currentStep} sur ${totalSteps}`; });
    }
    const progressFill = document.getElementById('wizard-progress-fill');
    if (progressFill) progressFill.style.width = `${(currentStep / totalSteps) * 100}%`;

    prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-block';
    
    const titles = ["Airball - S'inscrire", "Eastern Conference", "Western Conference", "Statistiques Individuelles", "Awards de la Saison"];
    bannerTitle.textContent = titles[currentStep - 1];

    if (currentStep === totalSteps) {
        nextBtn.textContent = "S'inscrire 🚀";
        nextBtn.className = 'btn btn-submit';
    } else {
        nextBtn.textContent = 'Suivant';
        nextBtn.className = 'btn btn-next';
    }
}

function validateCurrentStep() {
    if (currentStep === 1) {
        const pseudoInput = document.getElementById('pseudo');
        if (!pseudoInput || !pseudoInput.value.trim()) {
            showPseudoError("Merci d'indiquer ton pseudo pour continuer.");
            return false;
        }
    }

    if (currentStep === 4 || currentStep === 5) {
        const groupIndex = (currentStep === 4) ? 0 : 1;
        const groupList = [
            { ids: ['pts', 'reb', 'ast', 'stl', 'blk'] },
            { ids: ['mvp', 'coy', 'roy', 'mip', 'dpoy', 'sixth'] }
        ];
        for (let cat of groupList[groupIndex].ids) {
            const picks = [];
            for (let i = 1; i <= 3; i++) {
                const val = document.getElementById(`input-${cat}-${i}`)?.value.trim();
                if (!val) {
                    alert(`⚠️ Il te manque un choix dans la catégorie ${cat.toUpperCase()} (Pick #${i}).`);
                    return false;
                }
                picks.push(val.toLowerCase());
            }
            if (new Set(picks).size !== picks.length) {
                alert(`⚠️ Tu ne peux pas sélectionner plusieurs fois la même personne dans la catégorie ${cat.toUpperCase()} !`);
                return false;
            }
        }
    }
    return true;
}

/**
 * Redimensionnement et conversion de l'image en Base64
 */
function resizeAndConvertImage(file, maxWidth = 300, maxHeight = 300) {
    return new Promise((resolve) => {
        if (!file) { resolve(""); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                if (width > height) {
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else {
                    if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
                }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function submitOnboardingForm() {
    const pseudoInput = document.getElementById('pseudo');
    const pseudo = pseudoInput ? pseudoInput.value.trim() : "";

    const fileInput = document.getElementById('avatar-file');
    let avatarBase64 = "";
    if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
            nextBtn.textContent = 'Traitement de l\'image... 🖼️';
            avatarBase64 = await resizeAndConvertImage(fileInput.files[0]);
        } catch (err) {
            console.error("Erreur image:", err);
        }
    }

    const eastSheetHeaders = ["Hawks", "Celtics", "Nets", "Hornets", "Bulls", "Cavs", "Pistons", "Pacers", "Heat", "Bucks", "Knicks", "Magic", "76ers", "Raptors", "Wizards"];
    const eastMap = { "Cavs": "Cavaliers" };
    const westSheetHeaders = ["Mavericks", "Nuggets", "Warriors", "Rockets", "Clippers", "Lakers", "Grizzlies", "Wolves", "Pelicans", "Thunder", "Suns", "Blazers", "Kings", "Spurs", "Jazz"];
    const westMap = { "Wolves": "Timberwolves", "Blazers": "Trail Blazers" };

    const eastItems = Array.from(document.querySelectorAll('#east-list .team-row-item'));
    const westItems = Array.from(document.querySelectorAll('#west-list .team-row-item'));

    const eastRanks = eastSheetHeaders.map(sheetName => {
        const index = eastItems.findIndex(li => li.getAttribute('data-team') === (eastMap[sheetName] || sheetName));
        return index !== -1 ? index + 1 : "";
    });

    const westRanks = westSheetHeaders.map(sheetName => {
        const index = westItems.findIndex(li => li.getAttribute('data-team') === (westMap[sheetName] || sheetName));
        return index !== -1 ? index + 1 : "";
    });

    const payload = {
        pseudo: pseudo,
        avatarBase64: avatarBase64,
        east: eastRanks,
        west: westRanks,
        stats: {},
        awards: {}
    };

    ['pts', 'reb', 'ast', 'stl', 'blk'].forEach(cat => {
        payload.stats[cat] = [
            document.getElementById(`input-${cat}-1`)?.value || "",
            document.getElementById(`input-${cat}-2`)?.value || "",
            document.getElementById(`input-${cat}-3`)?.value || ""
        ];
    });

    ['mvp', 'coy', 'roy', 'mip', 'dpoy', 'sixth'].forEach(cat => {
        payload.awards[cat] = [
            document.getElementById(`input-${cat}-1`)?.value || "",
            document.getElementById(`input-${cat}-2`)?.value || "",
            document.getElementById(`input-${cat}-3`)?.value || ""
        ];
    });

    payload.id = registrationId;
    showSubmitError('');
    nextBtn.textContent = 'Inscription en cours... ⏳';
    nextBtn.disabled = true;

    try {
        await Api.postRegistration(payload);
    } catch (error) {
        // Le réseau a pu couper après l'envoi : on ne conclut rien, la vérification ci-dessous tranche.
        console.warn("Envoi de l'inscription :", error);
    }

    const outcome = await confirmRegistration(payload.pseudo);
    nextBtn.disabled = false;
    nextBtn.textContent = "S'inscrire 🚀";

    if (outcome === 'registered') {
        showNotice('🎉 Tu es inscrit !', 'Tes pronostics sont bien enregistrés. Ils resteront secrets jusqu\'à la révélation.', "Retour à l'accueil");
    } else if (outcome === 'closed') {
        showClosedNotice(true);
    } else if (outcome === 'taken') {
        currentStep = 1;
        updateWizard();
        showPseudoError("Ce pseudo vient d'être pris par quelqu'un d'autre, choisis-en un autre.");
    } else {
        showSubmitError("On n'a pas pu confirmer ton inscription (connexion instable ?). Appuie de nouveau sur « S'inscrire » : il n'y aura pas de doublon.");
    }
}

/**
 * Interroge le serveur jusqu'à voir notre inscription (identifiant) dans le Sheet.
 * Retourne 'registered', 'closed', 'taken' ou 'unknown'.
 */
async function confirmRegistration(pseudo) {
    for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
        try {
            const status = await Api.getRegistrationStatus({ id: registrationId });
            if (status.registered) return 'registered';
        } catch (error) {
            console.warn('Vérification :', error);
        }
        if (attempt < CONFIRM_ATTEMPTS - 1) await sleep(CONFIRM_DELAY_MS);
    }

    // Pas d'inscription trouvée : on cherche pourquoi
    try {
        const status = await Api.getRegistrationStatus({ pseudo });
        if (status.open === false) return 'closed';
        if (status.pseudo && status.pseudo.status === 'taken') return 'taken';
    } catch (error) {
        console.warn('Vérification :', error);
    }
    return 'unknown';
}

/** Étape 1 : le pseudo est-il valide et libre ? Retourne true si on peut continuer. */
async function checkPseudoStep() {
    const input = document.getElementById('pseudo');
    const pseudo = normalizePseudo(input.value);
    input.value = pseudo;

    const problem = pseudoProblem(pseudo);
    if (problem) { showPseudoError(PSEUDO_MESSAGES[problem]); return false; }

    const label = nextBtn.textContent;
    nextBtn.disabled = true;
    nextBtn.textContent = 'Vérification...';
    try {
        const status = await Api.getRegistrationStatus({ pseudo });
        if (status.open === false) { showClosedNotice(false); return false; }
        if (status.pseudo && status.pseudo.status === 'taken') { showPseudoError(PSEUDO_MESSAGES.taken); return false; }
        if (status.pseudo && status.pseudo.status === 'invalid') {
            showPseudoError(PSEUDO_MESSAGES[status.pseudo.reason] || 'Ce pseudo est invalide.');
            return false;
        }
    } catch (error) {
        // Serveur injoignable : on laisse continuer, il revérifiera au moment de l'envoi
        console.warn('Vérification du pseudo impossible :', error);
    } finally {
        nextBtn.disabled = false;
        nextBtn.textContent = label;
    }
    return true;
}

nextBtn.addEventListener('click', async () => {
    if (!validateCurrentStep()) return;
    if (currentStep === 1 && !(await checkPseudoStep())) return;
    if (currentStep < totalSteps) {
        currentStep++;
        updateWizard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        await submitOnboardingForm();
    }
});

prevBtn.addEventListener('click', () => {
    if (currentStep > 1) {
        currentStep--;
        updateWizard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

const eastList = document.getElementById('east-list');
const westList = document.getElementById('west-list');

// Sur écran tactile, on ne déplace une équipe que par sa poignée ☰ :
// sinon un doigt qui fait défiler la liste la réordonnerait par erreur.
const isTouchScreen = window.matchMedia('(pointer: coarse)').matches;
function sortableOptions(listId) {
    const options = { animation: 150, ghostClass: 'sortable-ghost', onEnd: () => updateRanks(listId) };
    if (isTouchScreen) options.handle = '.drag-handle';
    return options;
}
if (eastList) new Sortable(eastList, sortableOptions('east-list'));
if (westList) new Sortable(westList, sortableOptions('west-list'));

loadData();

document.getElementById('pseudo').addEventListener('input', clearPseudoError);

// Dès l'ouverture : si les inscriptions sont fermées, on le dit avant que le joueur remplisse 5 étapes
Api.getRegistrationStatus()
    .then(status => { if (status.open === false) showClosedNotice(false); })  // fermé seulement si le serveur le dit explicitement
    .catch(error => console.warn("Impossible de vérifier l'ouverture des inscriptions :", error));
