/**
 * ============================================================
 *  AIRBALL - Google Apps Script
 * ============================================================
 *  Routes GET (?page=...) :
 *    leaderboard  -> classement général            (protégé par la révélation)
 *    pronos       -> pronos de TOUS les joueurs    (protégé par la révélation)
 *                    + classements/leaders réels (NBA DATA) + scores
 *    historique   -> évolution du classement, semaine par semaine
 *    inscription  -> les inscriptions sont-elles ouvertes ? pseudo libre ? inscription enregistrée ?
 *    nba-data     -> stats & awards NBA réels (onglet "NBA DATA"), jamais cachés par la révélation
 *    halloffame   -> palmarès
 *    config       -> pages masquées (cases « Masquer "…" » de l'onglet CONFIG)
 *                    + état du reveal { closed, launched } + date de début de saison
 *    reveal       -> pronos de tous les joueurs pour la page Reveal, dès que le reveal est lancé
 *                    (ou avant, en aperçu, avec ?cle=<REVEAL_PREVIEW_KEY>)
 *  POST : inscription d'un joueur (ligne ajoutée dans "Form Responses 1")
 *
 *  Chaque joueur est identifié par son IDENTIFIANT (colonne BN), jamais par son pseudo :
 *  on peut corriger un pseudo sans perdre son historique.
 *
 *  Structure "Form Responses 1" (index de colonne à partir de 0) :
 *    0  photo (URL)          1  pseudo
 *    2..31  30 équipes (en-tête "[Hawks]"... = rang prédit)
 *    32..46 stats (5 catégories x 3 picks)
 *    47..64 awards (6 catégories x 3 picks)
 *    65 (BN) identifiant unique du joueur
 *
 *  Structure "LEADERBOARD" (à partir de la ligne 5) :
 *    C pseudo   D pts Est   E pts Ouest   F pts stats   G pts awards   H total   I avatar
 *
 *  Structure "HISTORIQUE" (à partir de la ligne 5) :
 *    B date   C pseudo   D classement   E points   F identifiant
 * ============================================================
 */

// Début de la saison régulière : ferme les inscriptions et révèle les pronos.
// Doit être identique à SEASON_START dans js/config.js (le site signale un écart dans la console).
var SEASON_START = new Date('2026-10-20T00:00:00');
var FORM_SHEET_NAME = "Form Responses 1";

var COL_PSEUDO = 1;
var COL_TEAMS_FIRST = 2;
var COL_TEAMS_COUNT = 30;
var COL_STATS_FIRST = 32;
var COL_AWARDS_FIRST = 47;
var COL_ID = 65; // colonne BN

// Mot de passe de l'aperçu du reveal (pour répéter avec les vraies données avant de le lancer).
// Laisse vide pour désactiver l'aperçu. Choisis un mot que toi seul connais.
var REVEAL_PREVIEW_KEY = "";

// Conférence de chaque équipe (noms des en-têtes du formulaire, sans crochets).
// Liste fixe : les pronos restent bien rangés même si l'onglet NBA DATA est vide avant la saison.
var EAST_TEAM_NAMES = ['Hawks', 'Celtics', 'Nets', 'Hornets', 'Bulls', 'Cavs', 'Pistons', 'Pacers', 'Heat', 'Bucks', 'Knicks', 'Magic', '76ers', 'Raptors', 'Wizards'];

var STAT_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk'];
var AWARD_KEYS = ['mvp', 'coy', 'roy', 'mip', 'dpoy', 'sixth'];

/**
 * Lit une case à cocher de l'onglet CONFIG d'après le début de son libellé (colonne A),
 * sans tenir compte des accents ni des majuscules. Ex. : configFlag(ss, "lancer le reveal").
 * On peut donc déplacer les lignes ou reformuler la fin des libellés sans rien casser.
 */
function normalizeLabel(value) {
  return cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Case à cocher fixe de l'onglet CONFIG (B2 = forcer la révélation, B3 = fermer les inscriptions). */
function configCell(ss, a1) {
  var sheet = ss.getSheetByName("CONFIG");
  return !!sheet && sheet.getRange(a1).getValue() === true;
}

function configFlag(ss, labelStart) {
  var sheet = ss.getSheetByName("CONFIG");
  if (!sheet || sheet.getLastRow() < 1) return false;
  var rows = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (normalizeLabel(rows[i][0]).indexOf(labelStart) === 0) return rows[i][1] === true;
  }
  return false;
}

function isSeasonStarted() {
  return new Date() >= SEASON_START;
}

/**
 * Reveal lancé : case « Lancer le reveal » cochée, ET inscriptions closes
 * (on ne peut pas dévoiler les pronos pendant que d'autres peuvent encore s'inscrire).
 */
function isRevealLaunched() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return !isRegistrationOpen() && configFlag(ss, "lancer le reveal");
}

/**
 * Pronos visibles (page Pronostics, page Reveal) :
 * au lancement de la saison, au lancement du reveal, ou en forçant avec CONFIG!B2.
 */
function isRevealed() {
  if (isSeasonStarted()) return true;
  if (configCell(SpreadsheetApp.getActiveSpreadsheet(), "B2")) return true;
  return isRevealLaunched();
}

/**
 * Classement général (Home) : à partir du lancement de la saison,
 * ou avant en cochant CONFIG!B2 (aperçu de la Home pendant que tu la modifies).
 * Le lancement du reveal, lui, ne l'affiche pas : la Home garde la popin « Regarder le reveal ».
 */
function isLeaderboardRevealed() {
  return isSeasonStarted() || configCell(SpreadsheetApp.getActiveSpreadsheet(), "B2");
}

/** Aperçu du reveal avant son lancement, réservé à qui connaît REVEAL_PREVIEW_KEY. */
function isValidPreviewKey(key) {
  return REVEAL_PREVIEW_KEY !== "" && String(key || "") === REVEAL_PREVIEW_KEY;
}

/**
 * Routeur principal
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params = (e && e.parameter) ? e.parameter : {};
    var page = (params.page || "").toLowerCase();

    switch (page) {
      case "pronos":
        return jsonResponse(getPronosData(ss, isRevealed()));

      case "historique":
        return jsonResponse(getHistorique(ss));

      case "inscription":
        return jsonResponse(getRegistrationStatus(ss, params));

      case "nba-data": {
        // Statistiques & Awards saisis à la main dans l'onglet "NBA DATA" du Sheet.
        // Info NBA réelle, sans rapport avec les pronos des joueurs : jamais cachée par la révélation.
        var realData = getRealData(ss);
        if (!realData) return jsonResponse({ error: "Onglet 'NBA DATA' introuvable." });
        return jsonResponse(realData);
      }

      case "halloffame":
        return jsonResponse(getHallOfFame(ss));

      case "config":
        // Pages masquées depuis l'onglet CONFIG (maintenance pendant les refontes) + état du reveal
        return jsonResponse(getPagesConfig(ss));

      case "reveal": {
        var launched = isRevealLaunched();
        var allowed = isRevealed() || isValidPreviewKey(params.cle);
        var result = getPronosData(ss, allowed);
        result.closed = !isRegistrationOpen();
        result.launched = launched;
        result.preview = allowed && !isRevealed();
        return jsonResponse(result);
      }

      case "leaderboard":
      default:
        return jsonResponse(getLeaderboard(ss, isLeaderboardRevealed()));
    }
  } catch (error) {
    return jsonResponse({ error: error.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
                       .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
//  PAGES MASQUÉES (onglet CONFIG)
// ------------------------------------------------------------
/**
 * Lit les lignes « Masquer "…" » de l'onglet CONFIG (libellé en A, case à cocher en B).
 * Chaque ligne est reconnue par un mot de son libellé, sans tenir compte des accents
 * ni des majuscules : on peut donc reformuler les libellés librement.
 * Les autres lignes (révélation B2, fermeture des inscriptions B3) sont ignorées ici.
 *
 * Réponse : { pages: { home: "en ligne", stats: "masquée", ... }, reveal: { closed, launched }, seasonStart: "2026-10-20" }
 * Le site retire du menu les pages masquées et affiche un écran de maintenance à leur place.
 */
var PAGE_KEYWORDS = [
  ['home', 'home'],
  ['pronost', 'pronostics'],
  ['statist', 'stats'],
  ['regles', 'regles'],
  ['hall of fame', 'halloffame'],
  ['inscription', 'inscription'],
  ['reveal', 'reveal']
];

function getPagesConfig(ss) {
  var pages = {};
  var result = {
    pages: pages,
    reveal: { closed: !isRegistrationOpen(), launched: isRevealLaunched() },
    seasonStart: Utilities.formatDate(SEASON_START, Session.getScriptTimeZone(), "yyyy-MM-dd")
  };
  var sheet = ss.getSheetByName("CONFIG");
  if (!sheet || sheet.getLastRow() < 1) return result;

  var rows = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
  rows.forEach(function (row) {
    // "Masquer "Règles du jeu"" -> "masquer "regles du jeu""
    var text = normalizeLabel(row[0]);
    if (text.indexOf('masquer') !== 0) return;

    for (var i = 0; i < PAGE_KEYWORDS.length; i++) {
      if (text.indexOf(PAGE_KEYWORDS[i][0]) !== -1) {
        pages[PAGE_KEYWORDS[i][1]] = row[1] === true ? "masquée" : "en ligne";
        return;
      }
    }
  });
  return result;
}

// ------------------------------------------------------------
//  IDENTIFIANTS ET LEADERBOARD
// ------------------------------------------------------------
/** Identifiant d'une ligne de "Form Responses 1" (repli si l'ID n'est pas encore attribué). */
function rowPlayerId(row, rowNumber) {
  return cleanText(row[COL_ID]) || ("row" + rowNumber);
}

/**
 * Correspondance pseudo -> identifiant, d'après "Form Responses 1".
 * Sert aux onglets qui ne connaissent que le pseudo (LEADERBOARD, anciennes lignes de HISTORIQUE).
 */
function getIdsByPseudo(ss) {
  var ids = {};
  var sheet = ss.getSheetByName(FORM_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return ids;
  var nCols = Math.min(COL_ID + 1, sheet.getMaxColumns());
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, nCols).getValues();
  data.forEach(function (row, i) {
    var pseudo = normalizePseudo(row[COL_PSEUDO]).toLowerCase();
    if (pseudo) ids[pseudo] = rowPlayerId(row, i + 2);
  });
  return ids;
}

/** Identifiant d'un pseudo ; s'il est inconnu, une clé tirée du pseudo (jamais vide). */
function idForPseudo(idsByPseudo, pseudo) {
  var key = normalizePseudo(pseudo).toLowerCase();
  return idsByPseudo[key] || ("pseudo:" + key);
}

/**
 * Lignes de l'onglet LEADERBOARD (le Sheet fait foi pour les points) :
 * [{ id, pseudo, avatar, scores: { est, ouest, stats, awards, total } }]
 */
function readLeaderboard(ss) {
  var sheet = ss.getSheetByName("LEADERBOARD");
  if (!sheet || sheet.getLastRow() < 5) return [];

  var idsByPseudo = getIdsByPseudo(ss);
  var rows = sheet.getRange(5, 1, sheet.getLastRow() - 4, Math.max(sheet.getLastColumn(), 9)).getValues();
  var players = [];
  rows.forEach(function (row) {
    var pseudo = cleanText(row[2]);
    if (!pseudo || pseudo.toUpperCase() === "JOUEUR") return;
    players.push({
      id: idForPseudo(idsByPseudo, pseudo),
      pseudo: pseudo,
      avatar: cleanText(row[8]).indexOf("http") === 0 ? cleanText(row[8]) : "",
      scores: {
        est: Number(row[3]) || 0,
        ouest: Number(row[4]) || 0,
        stats: Number(row[5]) || 0,
        awards: Number(row[6]) || 0,
        total: Number(row[7]) || 0
      }
    });
  });
  return players;
}

/** Classement général : joueurs triés par total décroissant. */
function getLeaderboard(ss, revealed) {
  if (!revealed) return { revealed: false, players: [] };
  var players = readLeaderboard(ss).sort(function (a, b) { return b.scores.total - a.scores.total; });
  return { revealed: true, players: players };
}

// ------------------------------------------------------------
//  PRONOS (tous les joueurs d'un coup)
// ------------------------------------------------------------
function cleanText(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

function cleanTeamName(header) {
  return cleanText(header).replace(/[\[\]]/g, "").trim();
}

/**
 * Classements et leaders RÉELS, lus dans l'onglet "NBA DATA".
 *   Est  : C6:C20     Ouest : E6:E20
 *   Stats  : lignes 6-10  (1ST en J, 2ND en L, 3RD en N)
 *   Awards : lignes 15-20 (mêmes colonnes)
 */
function getRealData(ss) {
  var sheet = ss.getSheetByName("NBA DATA");
  if (!sheet) return null;

  function column(col) {
    return sheet.getRange(6, col, 15, 1).getValues().map(function (r) { return cleanText(r[0]); });
  }
  function picks(row) {
    return [cleanText(row[0]), cleanText(row[2]), cleanText(row[4])]; // J, L, N
  }

  var statsRaw = sheet.getRange(6, 10, STAT_KEYS.length, 5).getValues();
  var awardsRaw = sheet.getRange(15, 10, AWARD_KEYS.length, 5).getValues();

  var real = { east: column(3), west: column(5), stats: {}, awards: {} };
  STAT_KEYS.forEach(function (k, i) { real.stats[k] = picks(statsRaw[i]); });
  AWARD_KEYS.forEach(function (k, i) { real.awards[k] = picks(awardsRaw[i]); });
  return real;
}

function getPronosData(ss, revealed) {
  if (!revealed) return { revealed: false, real: null, players: [] };

  var real = getRealData(ss);
  if (!real) return { error: "Onglet 'NBA DATA' introuvable." };

  var sheet = ss.getSheetByName(FORM_SHEET_NAME);
  if (!sheet) return { error: "Onglet '" + FORM_SHEET_NAME + "' introuvable." };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { revealed: true, real: real, players: [] };

  var nCols = Math.min(COL_ID + 1, sheet.getMaxColumns());
  var data = sheet.getRange(1, 1, lastRow, nCols).getValues();
  var headers = data[0];

  var east = {};
  EAST_TEAM_NAMES.forEach(function (t) { east[t] = true; });
  real.east.forEach(function (t) { if (t) east[t] = true; });

  var scores = {};
  readLeaderboard(ss).forEach(function (p) { scores[p.id] = p.scores; });
  var players = [];

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var pseudo = cleanText(row[COL_PSEUDO]);
    if (!pseudo) continue;

    var avatar = cleanText(row[0]);
    if (avatar.indexOf("http") !== 0) avatar = "";

    var playerEast = {}, playerWest = {};
    for (var c = COL_TEAMS_FIRST; c < COL_TEAMS_FIRST + COL_TEAMS_COUNT && c < row.length; c++) {
      var team = cleanTeamName(headers[c]);
      var rank = Number(row[c]);
      if (!team || !isFinite(rank) || rank <= 0) continue;
      if (east[team]) playerEast[team] = rank;
      else playerWest[team] = rank;
    }

    var stats = {}, awards = {};
    STAT_KEYS.forEach(function (k, i) {
      var start = COL_STATS_FIRST + i * 3;
      stats[k] = [cleanText(row[start]), cleanText(row[start + 1]), cleanText(row[start + 2])];
    });
    AWARD_KEYS.forEach(function (k, i) {
      var start = COL_AWARDS_FIRST + i * 3;
      awards[k] = [cleanText(row[start]), cleanText(row[start + 1]), cleanText(row[start + 2])];
    });

    var id = rowPlayerId(row, r + 1);
    players.push({
      id: id,
      pseudo: pseudo,
      avatar: avatar,
      east: playerEast,
      west: playerWest,
      stats: stats,
      awards: awards,
      scores: scores[id] || { est: 0, ouest: 0, stats: 0, awards: 0, total: 0 }
    });
  }

  return { revealed: true, real: real, players: players };
}

// ------------------------------------------------------------
//  HISTORIQUE
// ------------------------------------------------------------
/**
 * Si Sheets a converti la date en vraie date, JSON la renverrait en heure UTC
 * (la veille à 23h ou 22h pour la France) : on la formate donc ici, dans le bon fuseau.
 */
function formatHistoryDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  return value;
}

/**
 * Relevés hebdomadaires : [{ id, joueur, semaine, classement, points }]
 * Les anciennes lignes sans identifiant (colonne F vide) sont rattachées d'après le pseudo.
 */
function getHistorique(ss) {
  var sheet = ss.getSheetByName("HISTORIQUE");
  if (!sheet || sheet.getLastRow() < HISTORY_FIRST_ROW) return [];

  var idsByPseudo = getIdsByPseudo(ss);
  var rows = sheet.getRange(HISTORY_FIRST_ROW, HISTORY_FIRST_COL, sheet.getLastRow() - HISTORY_FIRST_ROW + 1, 5).getValues();
  var result = [];

  rows.forEach(function (row) {
    var pseudo = cleanText(row[1]);
    if (!pseudo) return;
    result.push({
      id: cleanText(row[4]) || idForPseudo(idsByPseudo, pseudo), // F
      joueur: pseudo,                     // C
      semaine: formatHistoryDate(row[0]), // B
      classement: row[2],                 // D
      points: row[3]                      // E
    });
  });
  return result;
}

// ------------------------------------------------------------
//  HALL OF FAME
// ------------------------------------------------------------
function getHallOfFame(ss) {
  var sheet = ss.getSheetByName("HALL OF FAME");
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 5) return [];

  var rows = sheet.getRange(5, 2, lastRow - 4, 6).getValues();
  var list = [];

  rows.forEach(function (r) {
    if (r[0] || r[1]) {
      list.push({
        saison: r[0],
        vainqueur: r[1],
        ptsVainqueur: r[2],
        deuxieme: r[3],
        ptsDeuxieme: r[4],
        maillot: r[5]
      });
    }
  });
  return list;
}

// ------------------------------------------------------------
//  ENREGISTREMENT HEBDOMADAIRE (déclencheur automatique du lundi)
//  Écrit dans HISTORIQUE, colonnes B à F, à partir de la ligne 5 :
//    B = date   C = joueur   D = classement   E = points   F = identifiant
// ------------------------------------------------------------
var HISTORY_FIRST_ROW = 5;
var HISTORY_FIRST_COL = 2; // colonne B

/**
 * Première ligne libre d'une colonne, à partir de startRow.
 * On regarde la colonne de dates (B) plutôt que la dernière ligne de la feuille :
 * une remarque tapée ailleurs dans l'onglet ne décale ainsi jamais les données.
 */
function firstEmptyRowInColumn(sheet, col, startRow) {
  var last = sheet.getLastRow();
  if (last < startRow) return startRow;

  var values = sheet.getRange(startRow, col, last - startRow + 1, 1).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (cleanText(values[i][0]) !== "") return startRow + i + 1;
  }
  return startRow;
}

function enregistrerHistoriqueHebdo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetHist = ss.getSheetByName("HISTORIQUE");
  if (!sheetHist) return;

  var players = getLeaderboard(ss, true).players; // déjà trié par total
  if (players.length === 0) return;

  var dateDuJour = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  var lignes = players.map(function (p, index) {
    return [dateDuJour, p.pseudo, index + 1, p.scores.total, p.id];
  });

  var startRow = firstEmptyRowInColumn(sheetHist, HISTORY_FIRST_COL, HISTORY_FIRST_ROW);
  sheetHist.getRange(startRow, HISTORY_FIRST_COL, lignes.length, 5).setValues(lignes);
}

/**
 * À LANCER UNE SEULE FOIS depuis l'éditeur (menu déroulant -> Exécuter), AVANT de modifier un pseudo :
 * remplit la colonne F (identifiant) des relevés déjà enregistrés, d'après le pseudo.
 * Sans danger si relancée : les identifiants déjà présents ne sont jamais modifiés.
 */
function completerIdentifiantsHistorique() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("HISTORIQUE");
  if (!sheet) throw new Error("Onglet 'HISTORIQUE' introuvable.");
  if (sheet.getLastRow() < HISTORY_FIRST_ROW) return;

  var idsByPseudo = getIdsByPseudo(ss);
  var n = sheet.getLastRow() - HISTORY_FIRST_ROW + 1;
  var pseudos = sheet.getRange(HISTORY_FIRST_ROW, HISTORY_FIRST_COL + 1, n, 1).getValues(); // C
  var idRange = sheet.getRange(HISTORY_FIRST_ROW, HISTORY_FIRST_COL + 4, n, 1);           // F
  var ids = idRange.getValues();
  var filled = 0;
  for (var i = 0; i < n; i++) {
    if (cleanText(pseudos[i][0]) && !cleanText(ids[i][0])) {
      ids[i][0] = idForPseudo(idsByPseudo, pseudos[i][0]);
      filled++;
    }
  }
  idRange.setValues(ids);
  Logger.log(filled + " identifiant(s) ajouté(s) dans HISTORIQUE.");
}

// ------------------------------------------------------------
//  IDENTIFIANTS JOUEURS
// ------------------------------------------------------------
function newPlayerId() {
  return "p" + Utilities.getUuid().replace(/-/g, "").substring(0, 8);
}

/**
 * À LANCER UNE SEULE FOIS depuis l'éditeur (menu déroulant -> Exécuter) :
 * attribue un identifiant à chaque joueur déjà inscrit (colonne BN).
 * Sans danger si relancée : les identifiants existants ne sont jamais modifiés.
 */
function attribuerIdentifiants() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(FORM_SHEET_NAME);
  if (!sheet) throw new Error("Onglet '" + FORM_SHEET_NAME + "' introuvable.");

  var idCol = COL_ID + 1; // BN = colonne 66
  if (sheet.getMaxColumns() < idCol) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), idCol - sheet.getMaxColumns());
  }

  if (!cleanText(sheet.getRange(1, idCol).getValue())) {
    sheet.getRange(1, idCol).setValue("ID (ne pas modifier)");
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var pseudos = sheet.getRange(2, COL_PSEUDO + 1, lastRow - 1, 1).getValues();
  var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();

  var created = 0;
  for (var i = 0; i < ids.length; i++) {
    if (cleanText(pseudos[i][0]) && !cleanText(ids[i][0])) {
      ids[i][0] = newPlayerId();
      created++;
    }
  }

  sheet.getRange(2, idCol, ids.length, 1).setValues(ids);
  Logger.log(created + " identifiant(s) créé(s).");
}

// ------------------------------------------------------------
//  INSCRIPTION : ouverture, règles et vérifications
// ------------------------------------------------------------
var PSEUDO_MIN_LENGTH = 2;
var PSEUDO_MAX_LENGTH = 24;
var PICK_MAX_LENGTH = 80;
var AVATAR_MAX_LENGTH = 700000; // caractères base64 (environ 500 Ko)

/**
 * Les inscriptions se ferment automatiquement au lancement de la saison,
 * ou dès que TOI tu coches CONFIG!B3 ("Fermer les inscriptions").
 * Volontairement indépendant de CONFIG!B2 (la révélation) : cocher B2 pour
 * un aperçu ou une soirée reveal ne doit pas fermer les inscriptions tout
 * seul, et les rouvrir ne doit pas re-cacher les pronos.
 */
function isRegistrationOpen() {
  if (isSeasonStarted()) return false;
  return !configCell(SpreadsheetApp.getActiveSpreadsheet(), "B3");
}

function normalizePseudo(value) {
  return cleanText(value).replace(/\s+/g, " ");
}

/** Retourne "" si le pseudo est valide, sinon un code d'erreur. */
function validatePseudo(pseudo) {
  if (pseudo.length < PSEUDO_MIN_LENGTH) return "too_short";
  if (pseudo.length > PSEUDO_MAX_LENGTH) return "too_long";
  // Un pseudo commençant par = + - @ serait interprété comme une formule par Google Sheets
  if (/^[=+\-@']/.test(pseudo)) return "bad_start";
  if (/[<>"\\`\u0000-\u001f]/.test(pseudo)) return "bad_chars";
  return "";
}

/** Valeur libre saisie par un joueur (pick) : jamais interprétée comme une formule. */
function sanitizeCell(value) {
  return cleanText(value).replace(/^[=+\-@\s]+/, "").substring(0, PICK_MAX_LENGTH);
}

/** Classement valide = les entiers de 1 à 15, chacun une seule fois. */
function isValidRanking(list) {
  if (!Array.isArray(list) || list.length !== 15) return false;
  var seen = {};
  for (var i = 0; i < list.length; i++) {
    var n = Number(list[i]);
    if (list[i] === "" || list[i] === null || !isFinite(n) || n % 1 !== 0 || n < 1 || n > 15 || seen[n]) return false;
    seen[n] = true;
  }
  return true;
}

/** Lit les 3 picks de chaque catégorie ; complete = false si un pick manque. */
function readPicks(group, keys) {
  var picks = [];
  var complete = true;
  keys.forEach(function (cat) {
    var list = (group && Array.isArray(group[cat])) ? group[cat] : [];
    for (var i = 0; i < 3; i++) {
      var pick = sanitizeCell(list[i]);
      if (!pick) complete = false;
      picks.push(pick);
    }
  });
  return { picks: picks, complete: complete };
}

function isPseudoTaken(sheet, pseudo) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var wanted = pseudo.toLowerCase();
  var pseudos = sheet.getRange(2, COL_PSEUDO + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < pseudos.length; i++) {
    if (normalizePseudo(pseudos[i][0]).toLowerCase() === wanted) return true;
  }
  return false;
}

function isIdRegistered(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2 || sheet.getMaxColumns() < COL_ID + 1) return false;
  var ids = sheet.getRange(2, COL_ID + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (cleanText(ids[i][0]) === id) return true;
  }
  return false;
}

/**
 * Route ?page=inscription (lecture seule). Le formulaire l'utilise pour :
 *   - savoir si les inscriptions sont ouvertes            -> open
 *   - savoir si un pseudo est libre (&pseudo=...)         -> pseudo.status : ok | taken | invalid
 *   - confirmer qu'une inscription est bien enregistrée (&id=...) -> registered
 */
function getRegistrationStatus(ss, params) {
  var out = { open: isRegistrationOpen() };
  var sheet = ss.getSheetByName(FORM_SHEET_NAME);
  if (!sheet) return out;

  if (params.pseudo !== undefined) {
    var pseudo = normalizePseudo(params.pseudo);
    var problem = validatePseudo(pseudo);
    if (problem) out.pseudo = { status: "invalid", reason: problem };
    else out.pseudo = { status: isPseudoTaken(sheet, pseudo) ? "taken" : "ok" };
  }
  if (params.id) out.registered = isIdRegistered(sheet, cleanText(params.id));
  return out;
}

// ------------------------------------------------------------
//  INSCRIPTION (POST)
// ------------------------------------------------------------
function doPost(e) {
  // Une seule inscription à la fois : évite deux joueurs avec le même pseudo au même instant
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (lockError) {
    return jsonResponse({ result: "error", code: "busy" });
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(FORM_SHEET_NAME);
    if (!sheet) {
      return jsonResponse({ result: "error", message: "Feuille '" + FORM_SHEET_NAME + "' introuvable." });
    }

    var data = JSON.parse(e.postData.contents);

    // Identifiant choisi par le navigateur : si le joueur renvoie le même formulaire
    // (connexion coupée, second clic...), on ne crée jamais de doublon.
    var id = cleanText(data.id);
    if (/^p[0-9a-f]{8}$/.test(id)) {
      if (isIdRegistered(sheet, id)) return jsonResponse({ result: "success", already: true });
    } else {
      id = newPlayerId();
      for (var attempt = 0; attempt < 10 && isIdRegistered(sheet, id); attempt++) id = newPlayerId();
    }

    if (!isRegistrationOpen()) return jsonResponse({ result: "error", code: "closed" });

    var pseudo = normalizePseudo(data.pseudo);
    var pseudoProblem = validatePseudo(pseudo);
    if (pseudoProblem) return jsonResponse({ result: "error", code: pseudoProblem });
    if (isPseudoTaken(sheet, pseudo)) return jsonResponse({ result: "error", code: "pseudo_taken" });

    if (!isValidRanking(data.east) || !isValidRanking(data.west)) {
      return jsonResponse({ result: "error", code: "invalid_data" });
    }

    var stats = readPicks(data.stats, STAT_KEYS);
    var awards = readPicks(data.awards, AWARD_KEYS);
    if (!stats.complete || !awards.complete) return jsonResponse({ result: "error", code: "invalid_data" });
    var picks = stats.picks.concat(awards.picks);

    // Avatar -> Google Drive (URL "thumbnail", la seule compatible avec les affichages image)
    var avatarUrl = "";
    var rawAvatar = cleanText(data.avatarBase64);
    if (!rawAvatar) {
      avatarUrl = "⚠️ Aucune image reçue";
    } else if (rawAvatar.indexOf("data:image/") !== 0 || rawAvatar.length > AVATAR_MAX_LENGTH) {
      avatarUrl = "⚠️ Image refusée (format ou taille)";
    } else {
      try {
        var parts = rawAvatar.split(',');
        if (parts.length < 2) throw new Error("Format Base64 corrompu ou incomplet");
        var blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), "image/jpeg", pseudo + "_avatar.jpg");
        var file = DriveApp.getRootFolder().createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        avatarUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
      } catch (imgErr) {
        avatarUrl = "❌ ERREUR: " + imgErr.toString();
      }
    }

    var rowData = [avatarUrl, pseudo];
    data.east.forEach(function (val) { rowData.push(Number(val)); });
    data.west.forEach(function (val) { rowData.push(Number(val)); });
    picks.forEach(function (pick) { rowData.push(pick); });
    rowData.push(id); // colonne BN

    sheet.appendRow(rowData);

    return jsonResponse({ result: "success" });

  } catch (error) {
    return jsonResponse({ result: "error", message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}