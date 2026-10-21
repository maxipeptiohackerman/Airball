/**
 * AIRBALL - Parcours d'inscription (register.html)
 * Écran d'accueil, puis 5 étapes : identité, Est, Ouest, stats, awards,
 * et enfin une fenêtre de récapitulatif avant l'envoi.
 * Dépend de : config.js, api.js (Api), teams.js (Teams), pages-config.js (PageConfig)
 */

// ==========================================
// ÉTAT ET ÉLÉMENTS
// ==========================================
const TOTAL_STEPS = 6; // 1 identité, 2 Est, 3 Ouest, 4 stats, 5 awards, 6 récapitulatif
const RECAP_STEP = 6;
let currentStep = 0; // 0 = écran d'accueil
let currentSub = 0;  // étapes 4 et 5 : catégorie en cours (un écran par catégorie)
let nbaPlayers = [];
let nbaCoaches = [];

const welcome = document.getElementById('reg-welcome');
const form = document.getElementById('onboarding-form');
const stepper = document.getElementById('reg-stepper');
const steps = document.querySelectorAll('.wizard-step');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const nextLabel = nextBtn.querySelector('.reg-next-label');

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
// ÉQUIPES (js/teams.js ; data-team = nom utilisé dans le Sheet)
// ==========================================
// Ordre de départ des listes à classer (l'ordre d'envoi vers le Sheet, lui, est celui de TEAMS)
const START_ORDER = {
    east: ['Celtics', 'Bucks', 'Knicks', 'Cavs', 'Magic', 'Pacers', '76ers', 'Heat', 'Bulls', 'Hawks', 'Nets', 'Raptors', 'Hornets', 'Wizards', 'Pistons'],
    west: ['Thunder', 'Nuggets', 'Wolves', 'Clippers', 'Mavericks', 'Suns', 'Pelicans', 'Lakers', 'Kings', 'Warriors', 'Grizzlies', 'Rockets', 'Spurs', 'Jazz', 'Blazers']
};

const DRAG_ICON = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 3.33H14M2 8H14M2 12.67H14" stroke="currentColor" stroke-width="1.33" stroke-linecap="round"/></svg>';

// Flèches haut / bas (en plus du glisser-déposer)
const ICON_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

function buildTeamList(listId, keys) {
    const list = document.getElementById(listId);
    list.innerHTML = keys.map(Teams.find).map((team, i) => `
        <li class="team-row-item" data-team="${esc(team.key)}">
            <span class="team-rank">${i + 1}</span>
            ${Teams.logoHtml(team.key)}
            <span class="team-name-row">${esc(team.name)}</span>
            <span class="move-btns">
                <button type="button" class="move-btn" data-move="-1" aria-label="Monter ${esc(team.name)}">${ICON_UP}</button>
                <button type="button" class="move-btn" data-move="1" aria-label="Descendre ${esc(team.name)}">${ICON_DOWN}</button>
            </span>
            <span class="drag-handle" aria-hidden="true">${DRAG_ICON}</span>
        </li>`).join('');
}

function updateRanks(listId) {
    const items = document.querySelectorAll(`#${listId} .team-row-item`);
    items.forEach((item, index) => {
        item.querySelector('.team-rank').textContent = index + 1;
        // Pas de flèche haut pour la 1re place, ni de flèche bas pour la dernière
        item.querySelector('[data-move="-1"]').disabled = index === 0;
        item.querySelector('[data-move="1"]').disabled = index === items.length - 1;
    });
}

// Clic sur une flèche : l'équipe monte ou descend d'une place et sa ligne s'allume un instant
function moveTeam(button) {
    const item = button.closest('.team-row-item');
    const list = item.parentElement;
    const dir = Number(button.dataset.move);
    const target = dir < 0 ? item.previousElementSibling : item.nextElementSibling;
    if (!target) return;
    if (dir < 0) list.insertBefore(item, target); else list.insertBefore(target, item);
    updateRanks(list.id);
    item.classList.remove('is-moved');
    void item.offsetWidth; // relance l'animation si on clique plusieurs fois de suite
    item.classList.add('is-moved');
    clearTimeout(item._movedTimer);
    item._movedTimer = setTimeout(() => item.classList.remove('is-moved'), 900);
    // Le focus reste sur la flèche : on peut enchaîner au clavier
    const again = item.querySelector(`[data-move="${dir}"]`);
    (again.disabled ? item.querySelector(`[data-move="${-dir}"]`) : again).focus();
}

// ==========================================
// STATS & AWARDS : un écran par catégorie, 3 cartes (Pick 1 au centre)
// Un clic sur une carte ouvre le panneau latéral de sélection.
// ==========================================
const STATS_CATEGORIES = [
    { id: 'pts', short: 'Points', title: 'Meilleurs marqueurs', hint: 'Le joueur qui finira la saison avec le plus de points par match.' },
    { id: 'reb', short: 'Rebonds', title: 'Meilleurs rebondeurs', hint: 'Le joueur qui finira la saison avec le plus de rebonds par match.' },
    { id: 'ast', short: 'Passes', title: 'Meilleurs passeurs', hint: 'Le joueur qui finira la saison avec le plus de passes décisives par match.' },
    { id: 'stl', short: 'Interceptions', title: 'Meilleurs intercepteurs', hint: 'Le joueur qui finira la saison avec le plus d’interceptions par match.' },
    { id: 'blk', short: 'Contres', title: 'Meilleurs contreurs', hint: 'Le joueur qui finira la saison avec le plus de contres par match.' }
];
const AWARDS_CATEGORIES = [
    { id: 'mvp', short: 'MVP', title: 'MVP', hint: 'Most Valuable Player : le meilleur joueur de la saison régulière.' },
    { id: 'coy', short: 'COY', title: 'Coach de l’année', hint: 'Coach of the Year : le coach qui a le plus impressionné.', kind: 'coach' },
    { id: 'roy', short: 'ROY', title: 'Rookie de l’année', hint: 'Rookie of the Year : le meilleur joueur de première année.', kind: 'rookie' },
    { id: 'mip', short: 'MIP', title: 'Meilleure progression', hint: 'Most Improved Player : le joueur qui a le plus progressé.' },
    { id: 'dpoy', short: 'DPOY', title: 'Défenseur de l’année', hint: 'Defensive Player of the Year : le meilleur défenseur.' },
    { id: 'sixth', short: '6th Man', title: '6e homme de l’année', hint: 'Sixth Man of the Year : le meilleur joueur sorti du banc.' }
];
const STEP_CATEGORIES = { 4: STATS_CATEGORIES, 5: AWARDS_CATEGORIES };
const ALL_CATEGORIES = [...STATS_CATEGORIES, ...AWARDS_CATEGORIES];

// Choix du joueur : picks.pts = [{ name, team }, null, null] (index 0 = Pick 1)
const picks = {};
ALL_CATEGORIES.forEach(cat => { picks[cat.id] = [null, null, null]; });
const pickNames = catId => picks[catId].map(p => (p ? p.name : ''));

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

const rookies = () => nbaPlayers.filter(p => p.rookie === true || p.rookie === 'true');

// Liste proposée : coachs pour le COY, rookies pour le ROY (si connus)
function sourceFor(cat) {
    if (cat.kind === 'coach') return nbaCoaches;
    if (cat.kind === 'rookie' && rookies().length) return rookies();
    return nbaPlayers;
}

// Maillot illustré aux couleurs de l'équipe (js/jersey.js) ; grand format avec numéro sur les cartes
// Coachs : polo (vu de face, nom de la franchise) à la place du maillot
function jerseyIcon(team, className = 'pick-card-jersey', number = '', coach = false) {
    const mini = className !== 'pick-card-jersey';
    return coach ? Jersey.coach(team, { className, mini }) : Jersey.svg(team, { className, number, mini });
}

// Icône « ajouter » de la maquette (carré pointillé avec un +), en couleur du texte
const ADD_ICON = '<svg class="pick-card-add" viewBox="0 0 16 16" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round"><path d="M3.33 2A1.33 1.33 0 0 0 2 3.33M12.67 2A1.33 1.33 0 0 1 14 3.33M14 12.67A1.33 1.33 0 0 1 12.67 14M3.33 14A1.33 1.33 0 0 1 2 12.67M6 2h.67M6 14h.67M9.33 2H10M9.33 14H10M2 6v.67M14 6v.67M2 9.33V10M14 9.33V10M5.33 8h5.34M8 5.33v5.34"/></svg>';

// Trapèze façon parquet en perspective, derrière les cartes
const STAGE_FLOOR = '<svg class="pick-floor" viewBox="0 0 1136 378" preserveAspectRatio="none" aria-hidden="true"><polygon points="148,0.5 986,0.5 1135.5,377.5 0.5,377.5" vector-effect="non-scaling-stroke"/></svg>';

const ORDINALS = ['premier', 'deuxième', 'troisième'];

// Écran de la catégorie en cours : titre, sous-titre et 3 cartes
function renderCategory(step, sub) {
    const cat = STEP_CATEGORIES[step][sub];
    const section = steps[step - 1];
    section.querySelector('.reg-title').textContent = cat.title;
    section.querySelector('.reg-sub').textContent = cat.hint;
    const what = cat.kind === 'coach' ? 'coach' : 'joueur';

    section.querySelector('.pick-stage').innerHTML = STAGE_FLOOR + [1, 2, 3].map(n => {
        const pick = picks[cat.id][n - 1];
        return pick
            ? `<button type="button" class="pick-card pick-card--${n} is-filled" data-pick="${n}" aria-label="Pick ${n} : ${esc(pick.name)}${pick.team ? ', ' + esc(pick.team) : ''}. Changer de ${what}">
                <span class="pick-card-title">Pick ${n}</span>
                ${jerseyIcon(pick.team, 'pick-card-jersey', pick.num || n, cat.kind === 'coach')}
                <span class="pick-card-name">${esc(pick.name)}</span>
                <span class="pick-card-team">${esc(pick.team || '')}</span>
            </button>`
            : `<button type="button" class="pick-card pick-card--${n}" data-pick="${n}" aria-label="Pick ${n} : choisir un ${what}">
                <span class="pick-card-title">Pick ${n}</span>
                ${ADD_ICON}
                <span class="pick-card-empty">Ajouter</span>
            </button>`;
    }).join('');
}

// ---------- panneau latéral de sélection ----------
const panel = document.getElementById('pick-panel');
const panelState = { cat: null, pick: 1, team: '', pos: '' };

function panelResults() {
    const cat = panelState.cat;
    const query = fold(document.getElementById('pick-search').value);
    const taken = pickNames(cat.id).filter((name, i) => name && i !== panelState.pick - 1).map(n => n.toLowerCase());

    return sourceFor(cat).filter(item => {
        const name = item.name.toLowerCase();
        if (taken.includes(name)) return false;
        if (panelState.team && item.team !== panelState.team) return false;
        if (panelState.pos && cat.kind !== 'coach' && !matchesPosition(item, panelState.pos)) return false;
        return !query || fold(item.name).includes(query) || fold(item.team).includes(query);
    }).sort((a, b) => {
        // Rookies : dans l'ordre de la draft quand le numéro est connu
        if (cat.kind === 'rookie' && (a.draft || b.draft)) return (Number(a.draft) || 999) - (Number(b.draft) || 999);
        // Filtre par équipe : titulaires d'abord, puis le banc (champ "depth" de players.json)
        if (panelState.team && (a.depth || b.depth)) return (Number(a.depth) || 99) - (Number(b.depth) || 99) || a.name.localeCompare(b.name, 'fr');
        // Sinon : les têtes d'affiche en premier, dans l'ordre de leur rang ("star": 1, 2, 3...),
        // puis tous les autres par ordre alphabétique
        if (cat.kind !== 'coach' && (isStar(a) || isStar(b))) return starRank(a) - starRank(b) || a.name.localeCompare(b.name, 'fr');
        return a.name.localeCompare(b.name, 'fr');
    });
}

// Recherche insensible aux accents et aux majuscules : "jokic" trouve "Jokić"
const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
// "star": 1 (premier de la liste), 2, 3... ; "star": true = tête d'affiche sans rang, placée après les rangs
const isStar = item => item.star === true || item.star === 'true' || Number(item.star) > 0;
const starRank = item => !isStar(item) ? Infinity : Number(item.star) > 0 ? Number(item.star) : 999;

// Titres de section de la liste : « Têtes d'affiche » puis « Tous les joueurs »
// (vue par défaut seulement : sans recherche ni filtre d'équipe)
function resultsGroupTitle(item, previous) {
    const cat = panelState.cat;
    if (cat.kind === 'coach' || cat.kind === 'rookie' || panelState.team || document.getElementById('pick-search').value.trim()) return '';
    if (!previous && isStar(item)) return 'Têtes d’affiche';
    if (!isStar(item) && (!previous || isStar(previous))) return previous ? 'Tous les joueurs' : '';
    return '';
}

function renderPanelResults() {
    const results = panelResults();
    const current = pickNames(panelState.cat.id)[panelState.pick - 1];
    document.getElementById('pick-results-count').textContent = `${results.length} résultat${results.length > 1 ? 's' : ''}`;
    document.getElementById('pick-results').innerHTML = results.length
        ? results.map((item, i) => `${(title => title ? `<p class="pick-results-group" role="presentation">${title}</p>` : '')(resultsGroupTitle(item, results[i - 1]))}
            <button type="button" class="pick-result${item.name === current ? ' is-current' : ''}" role="option" aria-selected="${item.name === current}" data-name="${esc(item.name)}" data-team="${esc(item.team || '')}" data-num="${esc(item.num || '')}">
                ${jerseyIcon(item.team, 'pick-result-jersey', '', panelState.cat.kind === 'coach')}
                <span class="pick-result-text">
                    <span class="pick-result-name">${esc(item.name)}</span>
                    <span class="pick-result-meta">${esc([item.draft ? `#${item.draft}` : '', item.team, item.pos].filter(Boolean).join(' · '))}</span>
                </span>
            </button>`).join('')
        : '<p class="pick-results-empty">Aucun résultat avec ces critères.</p>';
    document.getElementById('filter-reset').hidden = !(panelState.team || panelState.pos || document.getElementById('pick-search').value);
}

// Listes des filtres (le filtre de poste n'apparaît que si players.json contient les postes)
function buildPanelFilters() {
    const teams = [...new Set([...nbaPlayers, ...nbaCoaches].map(p => p.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    document.getElementById('filter-team').innerHTML = '<option value="">Équipes</option>' +
        teams.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    document.getElementById('filter-pos').innerHTML = '<option value="">Postes</option>' +
        POSITION_GROUPS.map(g => `<option value="${g.value}">${g.label}</option>`).join('');
}

function openPanel(cat, pickNum) {
    panelState.cat = cat;
    panelState.pick = pickNum;
    const isCoach = cat.kind === 'coach';
    document.getElementById('pick-panel-title').textContent = `Pick ${pickNum}`;
    document.getElementById('pick-panel-lead').textContent = isCoach ? 'Sélectionner un coach' : cat.kind === 'rookie' ? 'Sélectionner un rookie' : 'Sélectionner un joueur';
    document.getElementById('pick-panel-hint').textContent = `Choisis ton ${ORDINALS[pickNum - 1]} pick dans la liste.`;
    document.getElementById('pick-results-label').textContent = isCoach ? 'Coachs' : cat.kind === 'rookie' ? 'Rookies' : 'Joueurs';
    const search = document.getElementById('pick-search');
    search.value = '';
    search.placeholder = isCoach ? 'Rechercher un coach ou une équipe' : 'Rechercher un joueur ou une équipe';
    document.getElementById('filter-pos').hidden = isCoach || !nbaPlayers.some(p => p.pos);
    renderPanelResults();

    if (typeof panel.showModal === 'function') panel.showModal(); else panel.setAttribute('open', '');
    document.getElementById('pick-results').scrollTop = 0;
    search.focus();
}

function closePanel() {
    if (!panel.open) return;
    panel.classList.add('is-closing');
    // Laisse le panneau glisser vers la droite avant de le fermer
    setTimeout(() => {
        panel.classList.remove('is-closing');
        if (typeof panel.close === 'function') panel.close(); else panel.removeAttribute('open');
        const card = steps[currentStep - 1] && steps[currentStep - 1].querySelector(`.pick-card[data-pick="${panelState.pick}"]`);
        if (card) card.focus();
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
}

function setupPicks() {
    // Cartes : ouvrent le panneau (délégation, les cartes sont redessinées à chaque choix)
    [4, 5].forEach(step => {
        steps[step - 1].querySelector('.pick-stage').addEventListener('click', e => {
            const card = e.target.closest('.pick-card');
            if (card) openPanel(STEP_CATEGORIES[step][currentSub], Number(card.dataset.pick));
        });
    });

    document.getElementById('pick-search').addEventListener('input', renderPanelResults);
    document.getElementById('filter-team').addEventListener('change', e => { panelState.team = e.target.value; renderPanelResults(); });
    document.getElementById('filter-pos').addEventListener('change', e => { panelState.pos = e.target.value; renderPanelResults(); });
    document.getElementById('filter-reset').addEventListener('click', () => {
        panelState.team = ''; panelState.pos = '';
        document.getElementById('filter-team').value = '';
        document.getElementById('filter-pos').value = '';
        document.getElementById('pick-search').value = '';
        renderPanelResults();
        document.getElementById('pick-search').focus();
    });

    document.getElementById('pick-results').addEventListener('click', e => {
        const item = e.target.closest('.pick-result');
        if (!item) return;
        picks[panelState.cat.id][panelState.pick - 1] = { name: item.dataset.name, team: item.dataset.team, num: item.dataset.num || '' };
        renderCategory(currentStep, currentSub);
        clearStepError();
        refreshNextState();
        closePanel();
    });

    document.getElementById('pick-panel-close').addEventListener('click', closePanel);
    panel.addEventListener('click', e => { if (e.target === panel) closePanel(); }); // clic sur le fond assombri
    // Touche Échap : ferme le panneau (même quand le champ de recherche, qui l'intercepte, a le focus)
    panel.addEventListener('cancel', e => { e.preventDefault(); closePanel(); });
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closePanel(); } });
}

async function loadData() {
    try {
        const [playersRes, coachesRes] = await Promise.all([fetch('players.json'), fetch('coaches.json')]);
        if (!playersRes.ok || !coachesRes.ok) throw new Error('Erreur de chargement des données');
        nbaPlayers = await playersRes.json();
        nbaCoaches = await coachesRes.json();
        buildPanelFilters();
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

// Prénom : obligatoire, 30 caractères maximum, pas de caractère qui casserait le Sheet
const prenomValue = () => normalizePseudo(document.getElementById('prenom').value);
function prenomProblem(prenom) {
    if (!prenom) return 'Indique ton prénom pour continuer.';
    if (prenom.length > 30) return 'Ton prénom doit faire 30 caractères maximum.';
    if (/^[=+\-@']/.test(prenom) || /[<>"\\`\u0000-\u001f]/.test(prenom)) return 'Ton prénom contient un caractère interdit.';
    return '';
}
function showPrenomError(message) {
    const box = document.getElementById('prenom-error');
    box.textContent = message;
    box.hidden = false;
    document.getElementById('prenom').setAttribute('aria-invalid', 'true');
    document.getElementById('prenom').focus();
}
function clearPrenomError() {
    document.getElementById('prenom-error').hidden = true;
    document.getElementById('prenom').removeAttribute('aria-invalid');
}

/** Étape 1 : le pseudo est-il valide et libre ? Retourne true si on peut continuer. */
async function checkPseudoStep() {
    const input = document.getElementById('pseudo');
    const pseudo = normalizePseudo(input.value);
    input.value = pseudo;

    const problem = pseudoProblem(pseudo);
    if (problem) { showPseudoError(PSEUDO_MESSAGES[problem]); return false; }
    document.getElementById('prenom').value = prenomValue();
    const prenomIssue = prenomProblem(prenomValue());
    if (prenomIssue) { showPrenomError(prenomIssue); return false; }

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

// Aperçu vide : un « + » dans un cercle (la photo est facultative)
const ICON_ADD_PHOTO = '<svg class="reg-avatar-add" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9.25" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

function setupAvatarPreview() {
    const fileInput = document.getElementById('avatar-file');
    const preview = document.getElementById('avatar-preview');
    const name = document.getElementById('avatar-name');
    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) { preview.innerHTML = ICON_ADD_PHOTO; name.textContent = 'Choisir une image'; return; }
        const url = URL.createObjectURL(file);
        preview.innerHTML = `<img src="${url}" alt="">`;
        name.textContent = file.name;
    });
}

// ==========================================
// NAVIGATION ENTRE LES ÉTAPES
// ==========================================
function setBusy(busy, label) {
    nextBtn.disabled = busy;
    nextBtn.classList.toggle('is-busy', busy);
    if (busy) nextLabel.textContent = label;
    else updateNextLabel();
}

// Icône du bouton : chevron pour avancer, coche pour valider l'inscription
const ICON_NEXT = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CHECK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 14.67A6.67 6.67 0 1 0 8 1.33a6.67 6.67 0 0 0 0 13.34Z" stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.67 6 7 9.67 5.33 8" stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function updateNextLabel() {
    const onRecap = currentStep === RECAP_STEP;
    nextLabel.textContent = 'Valider';
    nextBtn.querySelector('svg').outerHTML = onRecap ? ICON_CHECK : ICON_NEXT;
    nextBtn.setAttribute('aria-label', onRecap ? 'Valider mon inscription' : 'Valider cette étape');
}

// Il manque quelque chose dans l'écran en cours ? (le bouton Valider reste alors grisé)
function stepIsComplete(step) {
    if (step === 1) return normalizePseudo(document.getElementById('pseudo').value).length > 0 && prenomValue().length > 0;
    const cats = STEP_CATEGORIES[step];
    if (cats) return pickNames(cats[currentSub].id).every(Boolean);
    return true;
}

function refreshNextState() {
    if (nextBtn.classList.contains('is-busy')) return;
    const complete = stepIsComplete(currentStep);
    nextBtn.classList.toggle('is-incomplete', !complete);
    nextBtn.setAttribute('aria-disabled', String(!complete));
}

// Message sous le titre de l'étape en cours
function showStepError(message) {
    const head = steps[currentStep - 1].querySelector('.reg-step-head');
    const target = head.querySelector('.reg-error') || head.appendChild(Object.assign(document.createElement('p'), { className: 'reg-error reg-error--center', role: 'alert' }));
    target.textContent = message;
    target.hidden = !message;
}

function clearStepError() {
    document.querySelectorAll('.reg-step-head .reg-error').forEach(el => { el.hidden = true; });
}

function validateCurrentStep() {
    if (currentStep === 1 && !normalizePseudo(document.getElementById('pseudo').value)) {
        showPseudoError("Indique ton pseudo pour continuer.");
        return false;
    }
    if (currentStep === 1 && !prenomValue()) {
        showPrenomError('Indique ton prénom pour continuer.');
        return false;
    }
    const cats = STEP_CATEGORIES[currentStep];
    if (cats) {
        const missing = pickNames(cats[currentSub].id).findIndex(name => !name);
        if (missing !== -1) {
            showStepError(`Il te manque le Pick ${missing + 1}. Clique sur sa carte pour le choisir.`);
            steps[currentStep - 1].querySelector(`.pick-card[data-pick="${missing + 1}"]`).focus();
            return false;
        }
    }
    return true;
}

// Barre de progression : les étapes 4 et 5 avancent catégorie par catégorie
function progressRatio(step, sub) {
    const cats = STEP_CATEGORIES[step];
    return (step - 1 + (cats ? (sub + 1) / cats.length : 1)) / TOTAL_STEPS;
}

function goTo(step, sub = 0) {
    currentStep = step;
    currentSub = sub;
    clearStepError();

    const onWelcome = step === 0;
    welcome.hidden = !onWelcome;
    form.hidden = onWelcome;
    stepper.hidden = onWelcome;
    document.body.classList.toggle('reg--steps', !onWelcome);

    steps.forEach(s => { s.hidden = Number(s.dataset.step) !== step; });
    if (!onWelcome) {
        document.getElementById('step-indicator').textContent = `Étape ${step}/${TOTAL_STEPS}`;
        document.getElementById('wizard-progress-fill').style.width = `${progressRatio(step, sub) * 100}%`;
        document.body.dataset.step = step;
        if (STEP_CATEGORIES[step]) renderCategory(step, sub);
        if (step === RECAP_STEP) { editingFromRecap = false; renderRecap(); }
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

// Le récapitulatif est la 6e étape : un onglet par partie, et un bouton « Modifier »
// qui ramène sur l'écran concerné. Après une modification, « Valider » revient ici directement.
let editingFromRecap = false;
let recapTab = 'identity';
const RECAP_TABS = ['identity', 'east', 'west', 'stats', 'awards'];
const EDIT_ICON_SEP = { 6: 'Playoffs', 10: 'Play-in' }; // séparateurs après la 6e et la 10e place

// Bouton « Modifier » : une icône crayon (le libellé complet est lu par les lecteurs d'écran et s'affiche au survol)
const ICON_EDIT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.83 2.83 0 0 0-4-4L4 16v4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m13.5 6.5 4 4" stroke="currentColor" stroke-width="1.6"/></svg>';

function editButton(step, sub, label, extraClass = '') {
    return `<button type="button" class="recap-edit${extraClass ? ' ' + extraClass : ''}" data-goto="${step}" data-sub="${sub || 0}" aria-label="${esc(label)}" title="${esc(label)}">${ICON_EDIT}</button>`;
}

// Sans photo : mêmes initiales colorées que sur le reste du site (voir avatarFallbackHtml dans common.js)
function recapFallback(name) {
    const colors = ['#dcfe5f', '#f08a3c', '#5fb8fe', '#4fd1a5', '#ff7ac6'];
    let h = 0;
    for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const words = String(name || '?').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
    const initials = words.length ? (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase() : '?';
    return `<span class="av-fb" style="--c:${colors[h % colors.length]}" aria-hidden="true"><b>${esc(initials)}</b></span>`;
}

function recapIdentity() {
    const pseudo = normalizePseudo(document.getElementById('pseudo').value);
    const avatar = document.querySelector('#avatar-preview img');
    return `<div class="recap-identity">
            <span class="recap-avatar">${avatar ? `<img src="${avatar.src}" alt="">` : recapFallback(pseudo)}</span>
            <span class="recap-names"><strong class="recap-pseudo">${esc(pseudo)}</strong><small class="recap-prenom">${esc(prenomValue())}</small></span>
        </div>
        ${editButton(1, 0, 'Modifier ton identité', 'recap-edit--float')}`;
}

function recapTeams(listId, step, confLabel) {
    const rows = teamOrder(listId).map((key, i) => {
        const team = Teams.find(key);
        const sep = EDIT_ICON_SEP[i + 1];
        return `<li class="recap-team"><span class="recap-team-rank">${i + 1}</span>${Teams.logoHtml(key, 'team-logo recap-team-logo')}<span>${esc(team.name)}</span></li>`
            + (sep ? `<li class="recap-sep recap-sep--${sep === 'Playoffs' ? 'playoffs' : 'playin'}" aria-hidden="true"><span>${sep}</span></li>` : '');
    }).join('');
    return `<ol class="recap-team-list">${rows}</ol>
        ${editButton(step, 0, `Modifier ton classement de la ${confLabel}`, 'recap-edit--float')}`;
}

function recapPicks(cats, step) {
    return `<ul class="recap-pick-rows">${cats.map((cat, sub) => `
        <li class="recap-pick-row">
            <span class="recap-pick-cat">${esc(cat.title)}</span>
            ${picks[cat.id].map((pick, i) => `
                <span class="recap-chip">
                    <span class="recap-chip-rank">${i + 1}</span>
                    ${pick ? jerseyIcon(pick.team, 'recap-chip-jersey', '', cat.kind === 'coach') : ''}
                    <span class="recap-chip-name">${esc(pick ? pick.name : '—')}</span>
                </span>`).join('')}
            ${editButton(step, sub, `Modifier : ${cat.title}`)}
        </li>`).join('')}
    </ul>`;
}

function renderRecap() {
    const panels = {
        identity: recapIdentity(),
        east: recapTeams('east-list', 2, 'Conférence Est'),
        west: recapTeams('west-list', 3, 'Conférence Ouest'),
        stats: recapPicks(STATS_CATEGORIES, 4),
        awards: recapPicks(AWARDS_CATEGORIES, 5)
    };
    RECAP_TABS.forEach(tab => { document.getElementById(`recap-panel-${tab}`).innerHTML = panels[tab]; });
    setRecapTab(recapTab);
}

function setRecapTab(tab) {
    recapTab = tab;
    document.querySelectorAll('.recap-tab').forEach(btn => {
        const active = btn.dataset.tab === tab;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', String(active));
        btn.tabIndex = active ? 0 : -1;
    });
    RECAP_TABS.forEach(t => { document.getElementById(`recap-panel-${t}`).hidden = t !== tab; });
}

document.getElementById('recap-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.recap-tab');
    if (btn) setRecapTab(btn.dataset.tab);
});
// Flèches gauche / droite pour passer d'un onglet à l'autre
document.getElementById('recap-tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = RECAP_TABS.indexOf(recapTab) + (e.key === 'ArrowRight' ? 1 : -1);
    const next = RECAP_TABS[(i + RECAP_TABS.length) % RECAP_TABS.length];
    setRecapTab(next);
    document.querySelector(`.recap-tab[data-tab="${next}"]`).focus();
    e.preventDefault();
});
document.getElementById('recap-panels').addEventListener('click', e => {
    const btn = e.target.closest('[data-goto]');
    if (!btn) return;
    editingFromRecap = true;
    goTo(Number(btn.dataset.goto), Number(btn.dataset.sub) || 0);
});


// ==========================================
// MESSAGES (fermé / confirmé)
// ==========================================
function showNotice(title, text, linkLabel) {
    nextBtn.classList.remove('is-busy');
    welcome.hidden = true;
    form.hidden = true;
    stepper.hidden = true;
    document.body.classList.remove('reg--steps');
    const notice = document.getElementById('register-notice');
    notice.innerHTML = `<h1 class="reg-hero reg-hero--small"></h1><p class="reg-notice-text"></p><a class="btn-primary" href="index.html"></a>`;
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
// ENVOI (format attendu par doPost dans Apps Script)
// ==========================================
async function submitOnboardingForm() {
    const pseudo = normalizePseudo(document.getElementById('pseudo').value);

    const fileInput = document.getElementById('avatar-file');
    let avatarBase64 = '';
    if (fileInput.files && fileInput.files[0]) {
        setBusy(true, "Traitement de l'image…");
        avatarBase64 = await resizeAndConvertImage(fileInput.files[0]);
    }

    const east = teamOrder('east-list');
    const west = teamOrder('west-list');
    const rankOf = (order, key) => { const i = order.indexOf(key); return i !== -1 ? i + 1 : ''; };

    const payload = {
        pseudo,
        prenom: prenomValue(),
        avatarBase64,
        // Rang de chaque équipe, dans l'ordre des colonnes du Sheet
        east: Teams.conference('east').map(team => rankOf(east, team.key)),
        west: Teams.conference('west').map(team => rankOf(west, team.key)),
        stats: {},
        awards: {}
    };
    const picksOf = pickNames;
    STATS_CATEGORIES.forEach(cat => { payload.stats[cat.id] = picksOf(cat.id); });
    AWARDS_CATEGORIES.forEach(cat => { payload.awards[cat.id] = picksOf(cat.id); });
    payload.id = registrationId;

    showStepError('');
    setBusy(true, 'Inscription en cours…');

    try {
        await Api.postRegistration(payload);
    } catch (error) {
        // Le réseau a pu couper après l'envoi : on ne conclut rien, la vérification ci-dessous tranche.
        console.warn("Envoi de l'inscription :", error);
    }

    const outcome = await confirmRegistration(pseudo);
    setBusy(false);

    if (outcome === 'registered') {
        registrationDone = true;
        showNotice('Tu es inscrit !', "Tes pronostics sont bien enregistrés. Ils resteront secrets jusqu'à la révélation.", "Retour à l'accueil");
    } else if (outcome === 'closed') {
        showClosedNotice(true);
    } else if (outcome === 'taken') {
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
// QUITTER : confirmation si une sélection est en cours
// ==========================================
const exitDialog = document.getElementById('exit-dialog');
const exitGif = document.getElementById('exit-gif');
let registrationDone = false;

function openExitDialog() {
    // La vidéo n'est téléchargée qu'à la première ouverture
    const sources = exitGif.querySelectorAll('source[data-src]');
    if (sources.length) {
        sources.forEach(source => { source.src = source.dataset.src; source.removeAttribute('data-src'); });
        exitGif.load();
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) exitGif.play().catch(() => {});
    if (typeof exitDialog.showModal === 'function') exitDialog.showModal();
    else exitDialog.setAttribute('open', '');
}

function closeExitDialog() {
    exitGif.pause();
    if (typeof exitDialog.close === 'function') exitDialog.close();
    else exitDialog.removeAttribute('open');
}

document.getElementById('reg-exit').addEventListener('click', e => {
    // Accueil, message final ou inscription envoyée : on part directement
    if (currentStep === 0 || registrationDone || form.hidden) return;
    e.preventDefault();
    openExitDialog();
});
document.getElementById('exit-cancel').addEventListener('click', closeExitDialog);
exitDialog.addEventListener('click', e => { if (e.target === exitDialog) closeExitDialog(); });
exitDialog.addEventListener('close', () => exitGif.pause());


// ==========================================
// DÉCOR DE L'ACCUEIL : GIF chargés seulement si le décor est visible (grand écran)
// ==========================================
function loadDecoVideos() {
    if (!window.matchMedia('(min-width: 1101px)').matches) return; // décor masqué : rien à télécharger
    // GIF d'origine (qualité intacte), chargés seulement sur grand écran
    document.querySelectorAll('.deco-gif[data-src]').forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
    });
}

// ==========================================
// DÉMARRAGE
// ==========================================
buildTeamList('east-list', START_ORDER.east);
buildTeamList('west-list', START_ORDER.west);
setupPicks();
setupAvatarPreview();
loadData();

// Sur écran tactile, on ne déplace une équipe que par sa poignée :
// sinon un doigt qui fait défiler la liste la réordonnerait par erreur.
const isTouchScreen = window.matchMedia('(pointer: coarse)').matches;
['east-list', 'west-list'].forEach(id => {
    const options = { animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', onEnd: () => updateRanks(id),
        filter: '.move-btn', preventOnFilter: false }; // un clic sur une flèche ne lance pas de glisser-déposer
    const list = document.getElementById(id);
    updateRanks(id);
    list.addEventListener('click', e => { const btn = e.target.closest('.move-btn'); if (btn) moveTeam(btn); });
    if (isTouchScreen) options.handle = '.drag-handle';
    if (window.Sortable) new Sortable(document.getElementById(id), options);
});

loadDecoVideos();
window.matchMedia('(min-width: 1101px)').addEventListener('change', loadDecoVideos);
document.getElementById('start-btn').addEventListener('click', () => goTo(1));

document.getElementById('pseudo').addEventListener('input', () => { clearPseudoError(); refreshNextState(); });
document.getElementById('prenom').addEventListener('input', () => { clearPrenomError(); refreshNextState(); });
document.getElementById('prenom').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nextBtn.click(); } });
document.getElementById('pseudo').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nextBtn.click(); } });

nextBtn.addEventListener('click', async () => {
    if (nextBtn.disabled) return;
    if (!validateCurrentStep()) return;
    if (currentStep === 1 && !(await checkPseudoStep())) return;
    if (currentStep === RECAP_STEP) { submitOnboardingForm(); return; }
    const cats = STEP_CATEGORIES[currentStep];
    if (editingFromRecap) goTo(RECAP_STEP);                      // modification terminée : retour au récap
    else if (cats && currentSub < cats.length - 1) goTo(currentStep, currentSub + 1);
    else goTo(currentStep + 1);
});

prevBtn.addEventListener('click', () => {
    if (STEP_CATEGORIES[currentStep] && currentSub > 0) goTo(currentStep, currentSub - 1);
    else if (STEP_CATEGORIES[currentStep - 1]) goTo(currentStep - 1, STEP_CATEGORIES[currentStep - 1].length - 1);
    else goTo(Math.max(0, currentStep - 1));
});

// Inscription en maintenance ou masquée depuis l'onglet CONFIG du Sheet (sauf en mode aperçu)
if (typeof PageConfig !== 'undefined' && !PageConfig.isPreview()) {
    PageConfig.watch(pages => {
        if (PageConfig.statusOf(pages, 'inscription') !== 'online' && currentStep === 0) {
            showNotice('Inscriptions en maintenance', "On peaufine le formulaire d'inscription. Reviens dans quelques instants !", "Retour à l'accueil");
        }
    });
}

// Dès l'ouverture : si les inscriptions sont fermées, on le dit avant que le joueur remplisse 5 étapes
Api.getRegistrationStatus()
    .then(status => { if (status.open === false) showClosedNotice(false); })
    .catch(error => console.warn("Impossible de vérifier l'ouverture des inscriptions :", error));

goTo(0);
