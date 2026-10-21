// ==========================================
// STORIES DU REVEAL (page Pronostics)
// Une bulle par chapitre au-dessus de la liste des joueurs ; un clic ouvre le reveal en plein écran
// par-dessus la page, directement sur ce chapitre.
// Le reveal (reveal.html) est préchargé, invisible, dans une fenêtre intégrée : il envoie la liste
// de ses chapitres (les bulles n'affichent que ceux qui existent) et s'ouvre ensuite sans attente.
// Pas de bulles tant que le reveal n'est pas lancé, ni si la page « reveal » est masquée dans CONFIG.
// Première visite après le lancement : le reveal s'ouvre tout seul, une seule fois.
// Lien direct : pronostics.html?reveal=1 ouvre le reveal dès qu'il est prêt (bouton de la Home).
// ==========================================
(() => {
    const host = document.getElementById('stories');
    if (!host) return;

    const SEEN_KEY = 'airball:stories:seen';          // chapitres déjà regardés (contour gris)
    const AUTO_KEY = 'airball:stories:autoplayed';    // ouverture automatique déjà faite
    const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } };
    const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ } };

    let chapters = [];
    let ready = false, pendingOpen = null;   // reveal préchargé prêt ? bulle cliquée avant qu'il le soit
    const demoMode = typeof Demo !== 'undefined' && Demo.active();
    // Dernière liste de chapitres connue : les bulles s'affichent tout de suite, sans attendre le reveal
    const CACHE_KEY = `airball:stories:cache${demoMode ? ':demo' : ''}`;
    const askedByLink = new URLSearchParams(window.location.search).get('reveal') === '1';

    function render() {
        const done = read(SEEN_KEY, []);
        host.innerHTML = `<div class="stories-row" role="list">${chapters.map(c => `
            <button type="button" class="story${done.includes(c.label) ? ' is-seen' : ''}" data-chap="${escapeHtml(c.label)}" role="listitem" aria-label="Reveal : ${escapeHtml(c.label)}">
                <span class="story-ring"><span class="story-ico" aria-hidden="true">${c.icon}</span></span>
                <span class="story-label">${escapeHtml(c.label)}</span>
            </button>`).join('')}</div>`;
        host.hidden = !chapters.length;
    }
    function markSeen(label) {
        const done = read(SEEN_KEY, []);
        if (done.includes(label)) return;
        done.push(label);
        write(SEEN_KEY, done);
        render();
    }

    // ---------- Reveal préchargé, puis affiché en plein écran ----------
    const overlay = document.createElement('div');
    overlay.className = 'story-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Le reveal');
    overlay.setAttribute('aria-hidden', 'true');
    const frame = document.createElement('iframe');
    frame.title = 'Le reveal';
    frame.tabIndex = -1;
    overlay.appendChild(frame);
    let lastBubble = null, isOpen = false;

    function open(label, bubble) {
        if (!chapters.length) return;
        lastBubble = bubble || null;
        if (!ready) pendingOpen = label;   // le reveal affiche « Chargement… » puis s'ouvre sur ce chapitre
        const ring = bubble && bubble.querySelector('.story-ring');
        const box = ring ? ring.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
        overlay.style.setProperty('--ox', `${box.left + box.width / 2}px`);
        overlay.style.setProperty('--oy', `${box.top + box.height / 2}px`);
        if (ready) frame.contentWindow.postMessage({ airballStories: 'open', chap: label }, '*');
        markSeen(label);
        isOpen = true;
        overlay.setAttribute('aria-hidden', 'false');
        frame.tabIndex = 0;
        document.body.classList.add('has-story');
        overlay.classList.add('is-open');
        setTimeout(() => { try { frame.contentWindow.focus(); } catch (e) { /* rien */ } }, 50);
    }
    function close() {
        if (!isOpen) return;
        isOpen = false;
        pendingOpen = null;
        if (ready) frame.contentWindow.postMessage({ airballStories: 'pause' }, '*');
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        document.body.classList.remove('has-story');
        if (lastBubble) lastBubble.focus();
    }

    host.addEventListener('click', e => { const b = e.target.closest('.story'); if (b) open(b.dataset.chap, b); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); closePlayer(); } });

    // ---------- Story d'un joueur : sa photo en haut du Résumé (fiche ou comparatif) ----------
    const PSEEN_KEY = 'airball:stories:players-seen';
    let storyPlayers = [];       // ids des joueurs présents dans le reveal
    let playerOverlay = null, lastCard = null;
    function refreshCards() {
        const seenIds = read(PSEEN_KEY, []);
        document.body.classList.toggle('stories-on', storyPlayers.length > 0);
        document.querySelectorAll('.rs-story').forEach(btn => {
            const on = storyPlayers.includes(btn.dataset.id);
            btn.classList.toggle('has-story', on);
            btn.classList.toggle('is-seen', on && seenIds.includes(btn.dataset.id));
            btn.tabIndex = on ? 0 : -1;
            btn.disabled = !on;
        });
    }
    function openPlayer(btn) {
        const id = btn.dataset.id;
        lastCard = btn;
        const seenIds = read(PSEEN_KEY, []);
        if (!seenIds.includes(id)) { seenIds.push(id); write(PSEEN_KEY, seenIds); }
        const box = btn.getBoundingClientRect();
        const key = new URLSearchParams(window.location.search).get('cle');
        playerOverlay = document.createElement('div');
        playerOverlay.className = 'story-overlay';
        playerOverlay.setAttribute('role', 'dialog');
        playerOverlay.setAttribute('aria-label', 'Story du joueur');
        playerOverlay.style.setProperty('--ox', `${box.left + box.width / 2}px`);
        playerOverlay.style.setProperty('--oy', `${box.top + box.height / 2}px`);
        playerOverlay.innerHTML = `<iframe title="Story du joueur" src="reveal.html?embed=1&story=${encodeURIComponent(id)}${key ? `&cle=${encodeURIComponent(key)}` : ''}"></iframe>`;
        document.body.appendChild(playerOverlay);
        document.body.classList.add('has-story');
        requestAnimationFrame(() => requestAnimationFrame(() => playerOverlay && playerOverlay.classList.add('is-open')));
        const f = playerOverlay.querySelector('iframe');
        f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (e) { /* rien */ } });
        refreshCards();
    }
    function closePlayer() {
        if (!playerOverlay) return;
        const o = playerOverlay; playerOverlay = null;
        o.classList.remove('is-open');
        document.body.classList.remove('has-story');
        setTimeout(() => o.remove(), 400);
        if (lastCard && document.body.contains(lastCard)) lastCard.focus();
    }
    document.addEventListener('click', e => {
        const b = e.target.closest('.rs-story.has-story');
        if (!b) return;
        e.preventDefault(); e.stopPropagation();
        openPlayer(b);
    }, true);
    window.Stories = { refresh: refreshCards };
    window.addEventListener('message', e => {
        if (playerOverlay && e.source === playerOverlay.querySelector('iframe').contentWindow) {
            if ((e.data || {}).airballReveal === 'close') closePlayer();
            return;
        }
        if (e.source !== frame.contentWindow) return;
        const m = e.data || {};
        if (m.airballReveal === 'chapters' && Array.isArray(m.list)) {
            chapters = m.list;
            storyPlayers = Array.isArray(m.players) ? m.players.map(String) : [];
            ready = true;
            write(CACHE_KEY, { list: chapters, players: storyPlayers });
            render();
            refreshCards();
            if (pendingOpen) { const label = pendingOpen; pendingOpen = null; frame.contentWindow.postMessage({ airballStories: 'open', chap: label }, '*'); return; }
            // Lien « Regarder le reveal » de la Home, ou toute première visite après le lancement
            const onList = !new URLSearchParams(window.location.search).get('joueur');
            if (askedByLink || (onList && !read(AUTO_KEY, false))) {
                write(AUTO_KEY, true);
                open(chapters[0].label, host.querySelector('.story'));
            }
        } else if (m.airballReveal === 'close') close();
        else if (m.airballReveal === 'seen' && m.chap) markSeen(m.chap);
    });

    // ---------- Chargement : seulement si le reveal peut être lancé ----------
    const demo = typeof Demo !== 'undefined' && Demo.active();
    const local = typeof PageConfig !== 'undefined' && PageConfig.isLocal();
    let loaded = false;
    function load() {
        if (loaded) return;
        loaded = true;
        const cached = read(CACHE_KEY, null);
        if (cached && Array.isArray(cached.list) && cached.list.length && !chapters.length) {
            chapters = cached.list;
            storyPlayers = Array.isArray(cached.players) ? cached.players : [];
            render();
            refreshCards();
        }
        const key = new URLSearchParams(window.location.search).get('cle');
        frame.src = `reveal.html?embed=1${key ? `&cle=${encodeURIComponent(key)}` : ''}`;
        document.body.appendChild(overlay);
    }
    function update(pages, reveal) {
        const hidden = typeof PageConfig !== 'undefined' && PageConfig.statusOf(pages || {}, 'reveal') === 'hidden' && !PageConfig.isPreview();
        if (hidden && !demo && !local) { chapters = []; storyPlayers = []; try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* rien */ } render(); refreshCards(); return; }
        if (demo || local || (reveal && reveal.launched)) load();
    }
    render();
    if (typeof PageConfig !== 'undefined') PageConfig.watch(update);
    if (demo || local) load();
})();
