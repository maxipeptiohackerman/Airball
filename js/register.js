/**
 * AIRBALL - Parcours d'inscription (register.html)
 * Écran d'accueil, puis 5 étapes : identité, Est, Ouest, stats, awards,
 * et enfin une fenêtre de récapitulatif avant l'envoi.
 * L'envoi vers le Sheet (format du payload, vérification) est inchangé.
 */

// ==========================================
// ÉTAT ET ÉLÉMENTS
// ==========================================
const TOTAL_STEPS = 5;
let currentStep = 0; // 0 = écran d'accueil
let nbaPlayers = [];
let nbaCoaches = [];

const welcome = document.getElementById('reg-welcome');
const form = document.getElementById('onboarding-form');
const stepper = document.getElementById('reg-stepper');
const steps = document.querySelectorAll('.wizard-step');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const nextLabel = nextBtn.querySelector('.reg-next-label');
const recapDialog = document.getElementById('recap-dialog');
const confirmBtn = document.getElementById('confirm-btn');

const esc = value => String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

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

// ==========================================
// ÉQUIPES (data-team = nom utilisé pour l'envoi vers le Sheet)
// ==========================================
const EAST_TEAMS = [
    ['Celtics', 'Boston Celtics', 'bos'], ['Bucks', 'Milwaukee Bucks', 'mil'], ['Knicks', 'New York Knicks', 'nyk'],
    ['Cavaliers', 'Cleveland Cavaliers', 'cle'], ['Magic', 'Orlando Magic', 'orl'], ['Pacers', 'Indiana Pacers', 'ind'],
    ['76ers', 'Philadelphia 76ers', 'phi'], ['Heat', 'Miami Heat', 'mia'], ['Bulls', 'Chicago Bulls', 'chi'],
    ['Hawks', 'Atlanta Hawks', 'atl'], ['Nets', 'Brooklyn Nets', 'bkn'], ['Raptors', 'Toronto Raptors', 'tor'],
    ['Hornets', 'Charlotte Hornets', 'cha'], ['Wizards', 'Washington Wizards', 'wsh'], ['Pistons', 'Detroit Pistons', 'det']
];
const WEST_TEAMS = [
    ['Thunder', 'Oklahoma City Thunder', 'okc'], ['Nuggets', 'Denver Nuggets', 'den'], ['Timberwolves', 'Minnesota Timberwolves', 'min'],
    ['Clippers', 'LA Clippers', 'lac'], ['Mavericks', 'Dallas Mavericks', 'dal'], ['Suns', 'Phoenix Suns', 'phx'],
    ['Pelicans', 'New Orleans Pelicans', 'no'], ['Lakers', 'Los Angeles Lakers', 'lal'], ['Kings', 'Sacramento Kings', 'sac'],
    ['Warriors', 'Golden State Warriors', 'gsw'], ['Grizzlies', 'Memphis Grizzlies', 'mem'], ['Rockets', 'Houston Rockets', 'hou'],
    ['Spurs', 'San Antonio Spurs', 'sas'], ['Jazz', 'Utah Jazz', 'utah'], ['Trail Blazers', 'Portland Trail Blazers', 'por']
];
const TEAM_NAMES = {};
[...EAST_TEAMS, ...WEST_TEAMS].forEach(([key, name]) => { TEAM_NAMES[key] = name; });

const DRAG_ICON = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 3.33H14M2 8H14M2 12.67H14" stroke="currentColor" stroke-width="1.33" stroke-linecap="round"/></svg>';

function buildTeamList(listId, teams) {
    const list = document.getElementById(listId);
    list.innerHTML = teams.map(([key, name, logo], i) => `
        <li class="team-row-item" data-team="${esc(key)}">
            <span class="team-rank">${i + 1}</span>
            <img class="team-logo-row" src="https://a.espncdn.com/i/teamlogos/nba/500/${logo}.png" alt="" onerror="this.onerror=null; this.style.visibility='hidden'">
            <span class="team-name-row">${esc(name)}</span>
            <span class="drag-handle" aria-hidden="true">${DRAG_ICON}</span>
        </li>`).join('');
}

function updateRanks(listId) {
    document.querySelectorAll(`#${listId} .team-row-item`).forEach((item, index) => {
        item.querySelector('.team-rank').textContent = index + 1;
    });
}

// ==========================================
// STATS & AWARDS (podiums)
// ==========================================
const STATS_CATEGORIES = [
    { id: 'pts', title: 'Points', hint: 'Meilleur marqueur' },
    { id: 'reb', title: 'Rebonds', hint: 'Meilleur rebondeur' },
    { id: 'ast', title: 'Passes', hint: 'Meilleur passeur' },
    { id: 'stl', title: 'Interceptions', hint: 'Meilleur intercepteur' },
    { id: 'blk', title: 'Contres', hint: 'Meilleur contreur' }
];
const AWARDS_CATEGORIES = [
    { id: 'mvp', title: 'MVP', hint: 'Most Valuable Player' },
    { id: 'coy', title: 'COY', hint: 'Coach of the Year' },
    { id: 'roy', title: 'ROY', hint: 'Rookie of the Year' },
    { id: 'mip', title: 'MIP', hint: 'Most Improved Player' },
    { id: 'dpoy', title: 'DPOY', hint: 'Defensive Player of the Year' },
    { id: 'sixth', title: '6th Man', hint: 'Sixth Man of the Year' }
];
const STEP_CATEGORIES = { 4: STATS_CATEGORIES, 5: AWARDS_CATEGORIES };

// Filtres actifs par étape (équipe, poste), partagés par tous les champs de l'étape
const filters = { 4: { team: '', pos: '' }, 5: { team: '', pos: '' } };

// Postes : "G" (meneur/arrière), "F" (ailier), "C" (pivot). Accepte aussi PG, SG, SF, PF, "G-F"...
const POSITION_GROUPS = [
    { value: 'G', label: 'Meneurs et arrières', codes: ['G', 'PG', 'SG'] },
    { value: 'F', label: 'Ailiers', codes: ['F', 'SF', 'PF'] },
    { value: 'C', label: 'Pivots', codes: ['C'] }
];
function matchesPosition(player, group) {
    if (!group) return true;
    const codes = String(player.pos || '').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
    const wanted = POSITION_GROUPS.find(g => g.value === group).codes;
    return codes.some(code => wanted.includes(code));
}

const hasPositions = () => nbaPlayers.some(p => p.pos);
const rookies = () => nbaPlayers.filter(p => p.rookie === true || p.rookie === 'true');

// Liste dans laquelle cherche un champ : coachs pour le COY, rookies pour le ROY (si connus)
function sourceFor(catId) {
    if (catId === 'coy') return nbaCoaches;
    if (catId === 'roy' && rookies().length) return rookies();
    return nbaPlayers;
}

function categoryHTML(cat) {
    const placeholder = cat.id === 'coy' ? 'Rechercher un coach' : cat.id === 'roy' ? 'Rechercher un rookie' : 'Rechercher un joueur';
    return `
        <div class="pick-row">
            <div class="pick-cat">
                <span class="pick-cat-title">${esc(cat.title)}</span>
                <span class="pick-cat-hint">${esc(cat.hint)}</span>
            </div>
            <div class="pick-slots">
                ${[1, 2, 3].map(n => `
                    <div class="pick-slot">
                        <label class="pick-label" for="search-${cat.id}-${n}">Pick ${n}</label>
                        <div class="player-search-container">
                            <input type="text" class="player-search-input" id="search-${cat.id}-${n}" placeholder="${placeholder}"
                                data-category="${cat.id}" data-pick="${n}" autocomplete="off" role="combobox"
                                aria-expanded="false" aria-controls="results-${cat.id}-${n}">
                            <div class="search-results-dropdown" id="results-${cat.id}-${n}" role="listbox" hidden></div>
                        </div>
                        <input type="hidden" id="input-${cat.id}-${n}" value="">
                    </div>`).join('')}
            </div>
        </div>`;
}

// Barre de filtres d'une étape (le filtre de poste n'apparaît que si players.json contient les postes)
function buildFilterBar(step) {
    const bar = document.querySelector(`[data-filters-for="${step === 4 ? 'stats-container' : 'awards-container'}"]`);
    const teams = [...new Set([...nbaPlayers, ...nbaCoaches].map(p => p.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    bar.innerHTML = `
        <span class="pick-filters-label">Filtrer</span>
        <label class="visually-hidden" for="filter-team-${step}">Équipe</label>
        <select id="filter-team-${step}" class="pick-filter" data-filter="team">
            <option value="">Toutes les équipes</option>
            ${teams.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
        </select>
        ${hasPositions() ? `
        <label class="visually-hidden" for="filter-pos-${step}">Poste</label>
        <select id="filter-pos-${step}" class="pick-filter" data-filter="pos">
            <option value="">Tous les postes</option>
            ${POSITION_GROUPS.map(g => `<option value="${g.value}">${g.label}</option>`).join('')}
        </select>` : ''}
        <button type="button" class="pick-filters-reset" hidden>Effacer</button>`;

    const reset = bar.querySelector('.pick-filters-reset');
    const sync = () => { reset.hidden = !(filters[step].team || filters[step].pos); };
    bar.querySelectorAll('.pick-filter').forEach(select => {
        select.addEventListener('change', () => { filters[step][select.dataset.filter] = select.value; sync(); });
    });
    reset.addEventListener('click', () => {
        filters[step] = { team: '', pos: '' };
        bar.querySelectorAll('.pick-filter').forEach(select => { select.value = ''; });
        sync();
    });
}

function buildPodiumSections() {
    document.getElementById('stats-container').innerHTML = STATS_CATEGORIES.map(categoryHTML).join('');
    document.getElementById('awards-container').innerHTML = AWARDS_CATEGORIES.map(categoryHTML).join('');
    setupSearchListeners();
}

const stepOfCategory = catId => (STATS_CATEGORIES.some(c => c.id === catId) ? 4 : 5);

// Résultats d'un champ : nom ou équipe contenant le texte tapé, filtres de l'étape appliqués
function searchResults(catId, pickNum, query) {
    const { team, pos } = filters[stepOfCategory(catId)];
    const taken = [1, 2, 3].filter(i => String(i) !== String(pickNum))
        .map(i => document.getElementById(`input-${catId}-${i}`).value.toLowerCase())
        .filter(Boolean);

    return sourceFor(catId).filter(item => {
        const name = item.name.toLowerCase();
        if (taken.includes(name)) return false;
        if (team && item.team !== team) return false;
        if (pos && catId !== 'coy' && !matchesPosition(item, pos)) return false;
        if (!query) return true;
        return name.includes(query) || String(item.team || '').toLowerCase().includes(query);
    }).sort((a, b) => {
        // Rookies : dans l'ordre de la draft quand le numéro est connu
        if (catId === 'roy' && (a.draft || b.draft)) return (Number(a.draft) || 999) - (Number(b.draft) || 999);
        return a.name.localeCompare(b.name, 'fr');
    });
}

// Un filtre est actif : on peut parcourir la liste sans rien taper
function hasActiveFilter(catId) {
    const { team, pos } = filters[stepOfCategory(catId)];
    return Boolean(team || (pos && catId !== 'coy'));
}


function setupSearchListeners() {
    document.querySelectorAll('.player-search-input').forEach(input => {
        const dropdown = input.nextElementSibling;
        const catId = input.dataset.category;
        const pickNum = input.dataset.pick;
        const hidden = document.getElementById(`input-${catId}-${pickNum}`);

        const close = () => { dropdown.hidden = true; input.setAttribute('aria-expanded', 'false'); };

        const open = () => {
            // Une seule liste ouverte à la fois
            document.querySelectorAll('.search-results-dropdown').forEach(d => { if (d !== dropdown) d.hidden = true; });
            const query = input.value.toLowerCase().trim();
            if (!query && !hasActiveFilter(catId)) { close(); return; }
            const results = searchResults(catId, pickNum, query).slice(0, 40);

            dropdown.innerHTML = results.length
                ? results.map(item => `
                    <button type="button" class="search-result-item" role="option" data-name="${esc(item.name)}" data-team="${esc(item.team || '')}">
                        <span class="result-name">${esc(item.name)}</span>
                        <span class="result-team">${esc([item.draft ? `#${item.draft}` : '', item.team, item.pos].filter(Boolean).join(' · '))}</span>
                    </button>`).join('')
                : '<div class="search-result-empty">Aucun résultat avec ces critères</div>';
            dropdown.hidden = false;
            input.setAttribute('aria-expanded', 'true');

            // Pas assez de place sous le champ (bas de la zone qui défile) : la liste s'ouvre vers le haut
            dropdown.classList.remove('drop-up');
            const panel = input.closest('.reg-panel');
            if (panel && dropdown.getBoundingClientRect().bottom > panel.getBoundingClientRect().bottom) {
                dropdown.classList.add('drop-up');
            }
        };

        input.addEventListener('input', () => {
            // Le texte tapé n'est plus un choix validé tant qu'on n'a pas cliqué un résultat
            hidden.value = '';
            input.classList.remove('is-picked');
            refreshNextState();
            open();
        });
        // Avec un filtre actif, un simple clic dans un champ vide affiche la liste filtrée
        input.addEventListener('focus', () => {
            document.querySelectorAll('.search-results-dropdown').forEach(d => { if (d !== dropdown) d.hidden = true; });
            if (!hidden.value) open();
        });

        dropdown.addEventListener('click', e => {
            const item = e.target.closest('.search-result-item');
            if (!item) return;
            input.value = item.dataset.name;
            hidden.value = item.dataset.name;
            input.classList.add('is-picked');
            input.title = item.dataset.team ? `${item.dataset.name} (${item.dataset.team})` : item.dataset.name;
            close();
            clearStepError();
            refreshNextState();
        });

        input.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.player-search-container')) {
            document.querySelectorAll('.search-results-dropdown').forEach(d => { d.hidden = true; });
            document.querySelectorAll('.player-search-input').forEach(i => i.setAttribute('aria-expanded', 'false'));
        }
    });
}

async function loadData() {
    try {
        const [playersRes, coachesRes] = await Promise.all([fetch('players.json'), fetch('coaches.json')]);
        if (!playersRes.ok || !coachesRes.ok) throw new Error('Erreur de chargement des données');
        // Une même équipe peut être écrite de deux façons dans le fichier : on harmonise
        const TEAM_ALIASES = { 'LA Clippers': 'Los Angeles Clippers' };
        const clean = item => ({ ...item, team: TEAM_ALIASES[item.team] || item.team });
        nbaPlayers = (await playersRes.json()).map(clean);
        nbaCoaches = (await coachesRes.json()).map(clean);
        buildFilterBar(4);
        buildFilterBar(5);
    } catch (error) {
        console.error('Erreur :', error);
    }
}

// ==========================================
// PSEUDO ET AVATAR
// ==========================================
const PSEUDO_MESSAGES = {
    too_short: 'Ton pseudo doit faire au moins 2 caractères.',
    too_long: 'Ton pseudo doit faire 24 caractères maximum.',
    bad_start: 'Ton pseudo ne peut pas commencer par = + - @ ou une apostrophe.',
    bad_chars: 'Ton pseudo contient un caractère interdit (< > " \\ `).',
    taken: 'Ce pseudo est déjà pris, choisis-en un autre.'
};

const normalizePseudo = value => String(value || '').trim().replace(/\s+/g, ' ');

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
    document.getElementById('pseudo').setAttribute('aria-invalid', 'true');
    document.getElementById('pseudo').focus();
}

function clearPseudoError() {
    document.getElementById('pseudo-error').hidden = true;
    document.getElementById('pseudo').removeAttribute('aria-invalid');
}

/** Étape 1 : le pseudo est-il valide et libre ? Retourne true si on peut continuer. */
async function checkPseudoStep() {
    const input = document.getElementById('pseudo');
    const pseudo = normalizePseudo(input.value);
    input.value = pseudo;

    const problem = pseudoProblem(pseudo);
    if (problem) { showPseudoError(PSEUDO_MESSAGES[problem]); return false; }

    setBusy(true, 'Vérification…');
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
        setBusy(false);
    }
    return true;
}

/** Redimensionnement et conversion de l'image en Base64 */
function resizeAndConvertImage(file, maxWidth = 300, maxHeight = 300) {
    return new Promise(resolve => {
        if (!file) { resolve(''); return; }
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                if (width > height) {
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => resolve('');
            img.src = e.target.result;
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
}

function setupAvatarPreview() {
    const fileInput = document.getElementById('avatar-file');
    const preview = document.getElementById('avatar-preview');
    const name = document.getElementById('avatar-name');
    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) { preview.innerHTML = '?'; name.textContent = 'Choisir une image'; return; }
        const url = URL.createObjectURL(file);
        preview.innerHTML = `<img src="${url}" alt="">`;
        name.textContent = file.name;
    });
}

// ==========================================
// NAVIGATION ENTRE LES ÉTAPES
// ==========================================
function setBusy(busy, label, button = nextBtn) {
    button.disabled = busy;
    button.classList.toggle('is-busy', busy);
    const text = button.querySelector('.reg-next-label');
    if (busy) text.textContent = label;
    else if (button === nextBtn) updateNextLabel();
    else text.textContent = 'Valider mon inscription';
}

function updateNextLabel() {
    nextLabel.textContent = currentStep === TOTAL_STEPS ? 'Voir le récapitulatif' : 'Suivant';
}

// Il manque quelque chose dans l'étape en cours ? (le bouton Suivant reste alors grisé)
function stepIsComplete(step) {
    if (step === 1) return normalizePseudo(document.getElementById('pseudo').value).length > 0;
    const cats = STEP_CATEGORIES[step];
    if (cats) return cats.every(cat => [1, 2, 3].every(n => document.getElementById(`input-${cat.id}-${n}`).value));
    return true;
}

function refreshNextState() {
    if (nextBtn.classList.contains('is-busy')) return;
    const complete = stepIsComplete(currentStep);
    nextBtn.classList.toggle('is-incomplete', !complete);
    nextBtn.setAttribute('aria-disabled', String(!complete));
}

function showStepError(message) {
    const box = document.getElementById('submit-error');
    // Fenêtre de récapitulatif ouverte : message dans la fenêtre, sinon sous le titre de l'étape
    let target = box;
    if (!recapDialog.open) {
        const head = steps[currentStep - 1].querySelector('.reg-step-head');
        target = head.querySelector('.reg-error') || head.appendChild(Object.assign(document.createElement('p'), { className: 'reg-error reg-error--center', role: 'alert' }));
    }
    target.textContent = message;
    target.hidden = !message;
}

function clearStepError() {
    document.querySelectorAll('.reg-step-head .reg-error, #submit-error').forEach(el => { el.hidden = true; });
}

function validateCurrentStep() {
    if (currentStep === 1 && !normalizePseudo(document.getElementById('pseudo').value)) {
        showPseudoError("Indique ton pseudo pour continuer.");
        return false;
    }
    const cats = STEP_CATEGORIES[currentStep];
    if (cats) {
        for (const cat of cats) {
            const picks = [1, 2, 3].map(n => document.getElementById(`input-${cat.id}-${n}`).value.trim());
            const missing = picks.findIndex(p => !p);
            if (missing !== -1) {
                showStepError(`Il te manque le Pick ${missing + 1} en ${cat.title}. Tape un nom puis choisis-le dans la liste.`);
                document.getElementById(`search-${cat.id}-${missing + 1}`).focus();
                return false;
            }
            if (new Set(picks.map(p => p.toLowerCase())).size !== 3) {
                showStepError(`Tu as choisi plusieurs fois la même personne en ${cat.title}.`);
                return false;
            }
        }
    }
    return true;
}

function goTo(step) {
    currentStep = step;
    clearStepError();

    const onWelcome = step === 0;
    welcome.hidden = !onWelcome;
    form.hidden = onWelcome;
    stepper.hidden = onWelcome;
    document.body.classList.toggle('reg--steps', !onWelcome);

    steps.forEach(s => { s.hidden = Number(s.dataset.step) !== step; });
    if (!onWelcome) {
        document.getElementById('step-indicator').textContent = `Étape ${step}/${TOTAL_STEPS}`;
        document.getElementById('wizard-progress-fill').style.width = `${(step / TOTAL_STEPS) * 100}%`;
        updateNextLabel();
        refreshNextState();
        const panel = steps[step - 1].querySelector('.reg-panel');
        if (panel) panel.scrollTop = 0;
        steps[step - 1].querySelector('.reg-title').focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0 });
}

// ==========================================
// RÉCAPITULATIF
// ==========================================
function teamOrder(listId) {
    return Array.from(document.querySelectorAll(`#${listId} .team-row-item`)).map(li => li.dataset.team);
}

function buildRecap() {
    const pseudo = normalizePseudo(document.getElementById('pseudo').value);
    const avatar = document.querySelector('#avatar-preview img');
    const editBtn = step => `<button type="button" class="reg-edit" data-goto="${step}">Modifier</button>`;
    const teamsCard = (title, listId, step) => `
        <section class="reg-card recap-card">
            <header class="recap-head"><h2>${title}</h2>${editBtn(step)}</header>
            <ol class="recap-teams">${teamOrder(listId).map(key => `<li>${esc(TEAM_NAMES[key] || key)}</li>`).join('')}</ol>
        </section>`;
    const picksCard = (title, cats, step) => `
        <section class="reg-card recap-card">
            <header class="recap-head"><h2>${title}</h2>${editBtn(step)}</header>
            <ul class="recap-picks">${cats.map(cat => `
                <li><span class="recap-cat">${esc(cat.title)}</span>
                    <span class="recap-names">${[1, 2, 3].map(n => esc(document.getElementById(`input-${cat.id}-${n}`).value)).join(' · ')}</span></li>`).join('')}
            </ul>
        </section>`;

    document.getElementById('recap').innerHTML = `
        <section class="reg-card recap-card recap-card--wide">
            <header class="recap-head"><h2>Identité</h2>${editBtn(1)}</header>
            <div class="recap-identity">
                <span class="reg-avatar-preview">${avatar ? `<img src="${avatar.src}" alt="">` : esc(pseudo.charAt(0).toUpperCase())}</span>
                <strong>${esc(pseudo)}</strong>
            </div>
        </section>
        ${teamsCard('Conférence Est', 'east-list', 2)}
        ${teamsCard('Conférence Ouest', 'west-list', 3)}
        ${picksCard('Statistiques', STATS_CATEGORIES, 4)}
        ${picksCard('Awards', AWARDS_CATEGORIES, 5)}`;
}

function openRecap() {
    buildRecap();
    document.getElementById('submit-error').hidden = true;
    if (typeof recapDialog.showModal === 'function') recapDialog.showModal();
    else recapDialog.setAttribute('open', '');
    recapDialog.querySelector('.reg-dialog-body').scrollTop = 0;
}

function closeRecap() {
    if (confirmBtn.classList.contains('is-busy')) return; // pas pendant l'envoi
    if (typeof recapDialog.close === 'function') recapDialog.close();
    else recapDialog.removeAttribute('open');
}

document.getElementById('recap').addEventListener('click', e => {
    const btn = e.target.closest('[data-goto]');
    if (!btn) return;
    closeRecap();
    goTo(Number(btn.dataset.goto));
});
document.getElementById('recap-close').addEventListener('click', closeRecap);
document.getElementById('recap-back').addEventListener('click', closeRecap);
// Clic sur le fond sombre autour de la fenêtre : fermeture
recapDialog.addEventListener('click', e => { if (e.target === recapDialog) closeRecap(); });
// Échap pendant l'envoi : ignoré
recapDialog.addEventListener('cancel', e => { if (confirmBtn.classList.contains('is-busy')) e.preventDefault(); });
confirmBtn.addEventListener('click', () => { if (!confirmBtn.disabled) submitOnboardingForm(); });


// ==========================================
// MESSAGES (fermé / confirmé)
// ==========================================
function showNotice(title, text, linkLabel) {
    if (recapDialog.open) { confirmBtn.classList.remove('is-busy'); closeRecap(); }
    welcome.hidden = true;
    form.hidden = true;
    stepper.hidden = true;
    document.body.classList.remove('reg--steps');
    const notice = document.getElementById('register-notice');
    notice.innerHTML = `<h1 class="reg-hero reg-hero--small"></h1><p class="reg-notice-text"></p><a class="reg-start" href="index.html"></a>`;
    notice.querySelector('h1').textContent = title;
    notice.querySelector('p').textContent = text;
    notice.querySelector('a').textContent = linkLabel;
    notice.hidden = false;
    window.scrollTo({ top: 0 });
}

function showClosedNotice(duringFilling) {
    showNotice(
        'Inscriptions fermées',
        duringFilling
            ? "Les inscriptions ont fermé pendant que tu remplissais le formulaire : ton inscription n'a malheureusement pas été enregistrée."
            : "La saison a commencé, ou l'organisateur a fermé les inscriptions : il n'est plus possible de s'inscrire pour cette saison.",
        'Voir le classement'
    );
}

// ==========================================
// ENVOI (format identique à l'ancienne version)
// ==========================================
async function submitOnboardingForm() {
    const pseudo = normalizePseudo(document.getElementById('pseudo').value);

    const fileInput = document.getElementById('avatar-file');
    let avatarBase64 = '';
    if (fileInput.files && fileInput.files[0]) {
        setBusy(true, "Traitement de l'image…", confirmBtn);
        avatarBase64 = await resizeAndConvertImage(fileInput.files[0]);
    }

    const eastSheetHeaders = ['Hawks', 'Celtics', 'Nets', 'Hornets', 'Bulls', 'Cavs', 'Pistons', 'Pacers', 'Heat', 'Bucks', 'Knicks', 'Magic', '76ers', 'Raptors', 'Wizards'];
    const eastMap = { Cavs: 'Cavaliers' };
    const westSheetHeaders = ['Mavericks', 'Nuggets', 'Warriors', 'Rockets', 'Clippers', 'Lakers', 'Grizzlies', 'Wolves', 'Pelicans', 'Thunder', 'Suns', 'Blazers', 'Kings', 'Spurs', 'Jazz'];
    const westMap = { Wolves: 'Timberwolves', Blazers: 'Trail Blazers' };

    const east = teamOrder('east-list');
    const west = teamOrder('west-list');
    const rankOf = (order, key) => { const i = order.indexOf(key); return i !== -1 ? i + 1 : ''; };

    const payload = {
        pseudo,
        avatarBase64,
        east: eastSheetHeaders.map(h => rankOf(east, eastMap[h] || h)),
        west: westSheetHeaders.map(h => rankOf(west, westMap[h] || h)),
        stats: {},
        awards: {}
    };
    const picksOf = id => [1, 2, 3].map(n => document.getElementById(`input-${id}-${n}`).value || '');
    STATS_CATEGORIES.forEach(cat => { payload.stats[cat.id] = picksOf(cat.id); });
    AWARDS_CATEGORIES.forEach(cat => { payload.awards[cat.id] = picksOf(cat.id); });
    payload.id = registrationId;

    showStepError('');
    setBusy(true, 'Inscription en cours…', confirmBtn);

    try {
        await Api.postRegistration(payload);
    } catch (error) {
        // Le réseau a pu couper après l'envoi : on ne conclut rien, la vérification ci-dessous tranche.
        console.warn("Envoi de l'inscription :", error);
    }

    const outcome = await confirmRegistration(pseudo);
    setBusy(false, '', confirmBtn);

    if (outcome === 'registered') {
        showNotice('Tu es inscrit !', "Tes pronostics sont bien enregistrés. Ils resteront secrets jusqu'à la révélation.", "Retour à l'accueil");
    } else if (outcome === 'closed') {
        showClosedNotice(true);
    } else if (outcome === 'taken') {
        closeRecap();
        goTo(1);
        showPseudoError("Ce pseudo vient d'être pris par quelqu'un d'autre, choisis-en un autre.");
    } else {
        showStepError("On n'a pas pu confirmer ton inscription (connexion instable ?). Appuie de nouveau sur « Valider mon inscription » : il n'y aura pas de doublon.");
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
    try {
        const status = await Api.getRegistrationStatus({ pseudo });
        if (status.open === false) return 'closed';
        if (status.pseudo && status.pseudo.status === 'taken') return 'taken';
    } catch (error) {
        console.warn('Vérification :', error);
    }
    return 'unknown';
}

// ==========================================
// DÉMARRAGE
// ==========================================
buildTeamList('east-list', EAST_TEAMS);
buildTeamList('west-list', WEST_TEAMS);
buildPodiumSections();
setupAvatarPreview();
loadData();

// Sur écran tactile, on ne déplace une équipe que par sa poignée :
// sinon un doigt qui fait défiler la liste la réordonnerait par erreur.
const isTouchScreen = window.matchMedia('(pointer: coarse)').matches;
['east-list', 'west-list'].forEach(id => {
    const options = { animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', onEnd: () => updateRanks(id) };
    if (isTouchScreen) options.handle = '.drag-handle';
    if (window.Sortable) new Sortable(document.getElementById(id), options);
});

document.getElementById('start-btn').addEventListener('click', () => goTo(1));

document.getElementById('pseudo').addEventListener('input', () => { clearPseudoError(); refreshNextState(); });
document.getElementById('pseudo').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nextBtn.click(); } });

nextBtn.addEventListener('click', async () => {
    if (nextBtn.disabled) return;
    if (!validateCurrentStep()) return;
    if (currentStep === 1 && !(await checkPseudoStep())) return;
    if (currentStep < TOTAL_STEPS) goTo(currentStep + 1);
    else openRecap();
});

prevBtn.addEventListener('click', () => goTo(Math.max(0, currentStep - 1)));

// Dès l'ouverture : si les inscriptions sont fermées, on le dit avant que le joueur remplisse 5 étapes
Api.getRegistrationStatus()
    .then(status => { if (status.open === false) showClosedNotice(false); })
    .catch(error => console.warn("Impossible de vérifier l'ouverture des inscriptions :", error));

goTo(0);
