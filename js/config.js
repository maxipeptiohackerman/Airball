// ==========================================
// CONFIGURATION GLOBALE DU SITE
// ==========================================
// Tout ce qui change d'une saison à l'autre, ou lors d'un redéploiement, se règle ICI.

// Adresse du script Apps Script. Nouvelle version d'un déploiement existant = même URL ;
// nouveau déploiement = nouvelle URL, à recopier ici.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxHwqLOe_S1_j-V9mGdn_OjeBuqRU5b10tWBydlL_3L-k9UH5Fxwk607si7di5D/exec';

// Saison régulière NBA (dates officielles), à mettre à jour chaque été.
// SEASON_START doit être identique à celui du script Apps Script (fermeture des inscriptions,
// révélation des pronos) : la console du navigateur signale un écart entre les deux.
const SEASON_LABEL = '2026-27';
const SEASON_START = new Date(2026, 9, 20); // 20 octobre 2026 (les mois commencent à 0)
const SEASON_END = new Date(2027, 3, 11);   // 11 avril 2027
