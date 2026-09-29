/**
 * ============================================================
 *  AIRBALL - Google Apps Script
 * ============================================================
 *  Routes GET (?page=...) :
 *    leaderboard  -> classement général            (protégé par la révélation)
 *    pronos       -> pronos de TOUS les joueurs    (protégé par la révélation)
 *                    + classements/leaders réels (NBA DATA) + scores
 *    historique   -> évolution du classement
 *    inscription  -> les inscriptions sont-elles ouvertes ? pseudo libre ? inscription enregistrée ?
 *    espn-standings -> relais ESPN (classements W/L), mis en cache 5 min
 *    nba-data       -> stats & awards NBA réels (onglet "NBA DATA"), jamais cachés par la révélation
 *    halloffame   -> palmarès
 *  POST : inscription d'un joueur (ligne ajoutée dans "Form Responses 1")
 *
 *  Structure "Form Responses 1" (index de colonne à partir de 0) :
 *    0  photo (URL)          1  pseudo
 *    2..31  30 équipes (en-tête "[Hawks]"... = rang prédit)
 *    32..46 stats (5 catégories x 3 picks)
 *    47..64 awards (6 catégories x 3 picks)
 *    65 (BN) identifiant unique du joueur
 * ============================================================
 */

var SEASON_START = new Date('2026-10-20T00:00:00');
var FORM_SHEET_NAME = "Form Responses 1";

var COL_PSEUDO = 1;
var COL_TEAMS_FIRST = 2;
var COL_TEAMS_COUNT = 30;
var COL_STATS_FIRST = 32;
var COL_AWARDS_FIRST = 47;
var COL_ID = 65; // colonne BN

var STAT_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk'];
var AWARD_KEYS = ['mvp', 'coy', 'roy', 'mip', 'dpoy', 'sixth'];

// ------------------------------------------------------------
//  RELAIS ESPN (classements W/L uniquement : le bloc "leaders" a été
//  retiré, ESPN ayant supprimé son adresse sans remplaçant documenté —
//  voir TODO.md). Le navigateur du visiteur ne peut plus appeler ESPN
//  directement ("Failed to fetch", probable CORS ou bloqueur de pub) ;
//  un appel serveur -> serveur n'y est pas soumis. Mis en cache 5 min
//  pour ne pas resolliciter ESPN à chaque visite et garder la page rapide.
// ------------------------------------------------------------
var ESPN_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";
var ESPN_CACHE_SECONDS = 300;

function getEspnData(cacheKey, url) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var code = response.getResponseCode();
    if (code !== 200) {
      return { error: "ESPN a répondu HTTP " + code };
    }

    var data = JSON.parse(response.getContentText());
    try {
      cache.put(cacheKey, JSON.stringify(data), ESPN_CACHE_SECONDS);
    } catch (cacheErr) {
      // Réponse trop volumineuse pour le cache (limite ~100 Ko) : pas grave,
      // on la renvoie quand même, seulement sans mise en cache cette fois.
    }
    return data;
  } catch (fetchErr) {
    return { error: "Relais ESPN impossible : " + fetchErr.toString() };
  }
}

/**
 * Révélation : automatique au lancement de la saison,
 * ou manuelle avant via la case à cocher CONFIG!B2.
 */
function isRevealed() {
  if (new Date() >= SEASON_START) return true;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetConfig = ss.getSheetByName("CONFIG");
  if (!sheetConfig) return false;

  return sheetConfig.getRange("B2").getValue() === true;
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
        return jsonResponse(getHistorique(ss, params.joueur));

      case "inscription":
        return jsonResponse(getRegistrationStatus(ss, params));

      case "espn-standings":
        return jsonResponse(getEspnData("espn_standings", ESPN_STANDINGS_URL));

      case "nba-data": {
        // Statistiques & Awards saisis à la main dans l'onglet "NBA DATA" du Sheet.
        // Info NBA réelle, sans rapport avec les pronos des joueurs : jamais cachée par la révélation.
        var realData = getRealData(ss);
        if (!realData) return jsonResponse({ error: "Onglet 'NBA DATA' introuvable." });
        return jsonResponse(realData);
      }

      case "halloffame":
      case "palmares":
        return jsonResponse(getHallOfFame(ss));

      case "leaderboard":
      default:
        return jsonResponse(getLeaderboard(ss, isRevealed()));
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
//  LEADERBOARD
// ------------------------------------------------------------
function getLeaderboard(ss, revealed) {
  if (!revealed) return { revealed: false, rows: [] };

  var sheet = ss.getSheetByName("LEADERBOARD") || ss.getSheetByName("Leaderboard") || ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 5) return { revealed: true, rows: [] };

  return { revealed: true, rows: sheet.getRange(5, 1, lastRow - 4, lastCol).getValues() };
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

/**
 * Points par joueur, lus dans LEADERBOARD (le Sheet fait foi pour les totaux).
 * Retourne { "pseudo en minuscules": {est, ouest, stats, awards, total} }
 */
function getScoresByPseudo(ss) {
  var sheet = ss.getSheetByName("LEADERBOARD") || ss.getSheetByName("Leaderboard");
  var scores = {};
  if (!sheet) return scores;

  var lastRow = sheet.getLastRow();
  if (lastRow < 5) return scores;

  var rows = sheet.getRange(5, 1, lastRow - 4, Math.max(sheet.getLastColumn(), 8)).getValues();
  rows.forEach(function (row) {
    var pseudo = cleanText(row[2]);
    if (!pseudo || pseudo.toUpperCase() === "JOUEUR") return;
    scores[pseudo.toLowerCase()] = {
      est: Number(row[3]) || 0,
      ouest: Number(row[4]) || 0,
      stats: Number(row[5]) || 0,
      awards: Number(row[6]) || 0,
      total: Number(row[7]) || 0
    };
  });
  return scores;
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

  var east = {}, west = {};
  real.east.forEach(function (t) { east[t] = true; });
  real.west.forEach(function (t) { west[t] = true; });

  var scores = getScoresByPseudo(ss);
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
      else if (west[team]) playerWest[team] = rank;
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

    players.push({
      id: cleanText(row[COL_ID]) || ("row" + (r + 1)), // repli si l'ID n'est pas encore attribué
      pseudo: pseudo,
      avatar: avatar,
      east: playerEast,
      west: playerWest,
      stats: stats,
      awards: awards,
      scores: scores[pseudo.toLowerCase()] || { est: 0, ouest: 0, stats: 0, awards: 0, total: 0 }
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

function getHistorique(ss, joueurDemande) {
  var sheet = ss.getSheetByName("HISTORIQUE");
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 5) return [];

  var rows = sheet.getRange(5, 2, lastRow - 4, 4).getValues();
  var result = [];

  rows.forEach(function (row) {
    var nom = row[1];
    if (!nom) return;
    if (joueurDemande && String(nom).trim().toLowerCase() !== String(joueurDemande).trim().toLowerCase()) return;

    result.push({
      joueur: String(nom).trim(), // Colonne C
      semaine: formatHistoryDate(row[0]), // Colonne B (Date)
      classement: row[2],         // Colonne D
      points: row[3]              // Colonne E
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
//  Écrit dans HISTORIQUE, colonnes B à E, à partir de la ligne 5 :
//    B = date   C = joueur   D = classement   E = points
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
  var sheetLb = ss.getSheetByName("LEADERBOARD");
  if (!sheetLb) return;

  var lastRow = sheetLb.getLastRow();
  var lastCol = sheetLb.getLastColumn();
  if (lastRow < 5) return;

  var dataLb = sheetLb.getRange(5, 1, lastRow - 4, lastCol).getValues();

  var validRows = dataLb.filter(function (row) {
    var joueur = row[2];
    return joueur && String(joueur).trim() !== "" && String(joueur).toUpperCase() !== "JOUEUR";
  });
  if (validRows.length === 0) return;

  validRows.sort(function (a, b) {
    return parseFloat(b[7] || 0) - parseFloat(a[7] || 0);
  });

  var sheetHist = ss.getSheetByName("HISTORIQUE");
  if (!sheetHist) return;

  var dateDuJour = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

  var lignes = validRows.map(function (row, index) {
    return [dateDuJour, row[2], index + 1, row[7] || 0];
  });

  var startRow = firstEmptyRowInColumn(sheetHist, HISTORY_FIRST_COL, HISTORY_FIRST_ROW);
  sheetHist.getRange(startRow, HISTORY_FIRST_COL, lignes.length, 4).setValues(lignes);
}

/**
 * À LANCER UNE SEULE FOIS depuis l'éditeur pour réparer les lignes déjà
 * enregistrées de travers (date en colonne A au lieu de B) : elles sont
 * décalées d'une colonne vers la droite. Les lignes déjà correctes ne sont
 * pas touchées, et la relancer ne change rien.
 * Conseil : dupliquer l'onglet HISTORIQUE avant (clic droit -> Dupliquer).
 */
function corrigerHistoriqueDecalage() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("HISTORIQUE");
  if (!sheet) throw new Error("Onglet 'HISTORIQUE' introuvable.");

  var last = sheet.getLastRow();
  if (last < HISTORY_FIRST_ROW) return;

  var n = last - HISTORY_FIRST_ROW + 1;
  var colA = sheet.getRange(HISTORY_FIRST_ROW, 1, n, 1).getValues();
  var colE = sheet.getRange(HISTORY_FIRST_ROW, 5, n, 1).getValues();

  var moved = 0;
  for (var i = 0; i < n; i++) {
    var misaligned = cleanText(colA[i][0]) !== "" && cleanText(colE[i][0]) === "";
    if (!misaligned) continue;

    var row = HISTORY_FIRST_ROW + i;
    var values = sheet.getRange(row, 1, 1, 4).getValues(); // A:D
    sheet.getRange(row, 2, 1, 4).setValues(values);         // -> B:E
    sheet.getRange(row, 1).setValue("");                    // A vidée
    moved++;
  }
  Logger.log(moved + " ligne(s) remise(s) en colonnes B à E.");
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
  if (new Date() >= SEASON_START) return false;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetConfig = ss.getSheetByName("CONFIG");
  if (!sheetConfig) return true; // pas d'onglet CONFIG = ouvertes par défaut avant la saison

  return sheetConfig.getRange("B3").getValue() !== true;
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
