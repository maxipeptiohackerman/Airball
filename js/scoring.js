// ==========================================
// RÈGLES DE POINTS (fonctions pures, sans accès à la page)
// ==========================================
// Équipes : rang exact = 2 pts, 1 place d'écart = 1 pt, sinon 0.
// Stats & awards : seul le 1er réel compte.
//   Pick 1 = 2 pts, Pick 2 = 1 pt, Pick 3 = 0,5 pt.
// Les TOTAUX affichés dans l'en-tête viennent du Sheet (LEADERBOARD) :
// ce fichier ne sert qu'à détailler ligne par ligne.
const Scoring = (() => {
    const PICK_POINTS = [2, 1, 0.5];
    const norm = value => String(value === null || value === undefined ? '' : value).trim().toLowerCase();

    function rankPoints(gap) {
        if (gap === 0) return 2;
        if (gap === 1) return 1;
        return 0;
    }

    // predicted : { "Cavs": 4, ... }   realList : ["Hawks", "Celtics", ...] (index 0 = 1er)
    function conferenceRows(predicted, realList) {
        const realRank = {};
        (realList || []).forEach((team, i) => { if (team) realRank[team] = i + 1; });

        return Object.keys(predicted || {}).map(team => {
            const pred = predicted[team];
            const real = realRank[team] || null;
            const gap = real === null ? null : Math.abs(pred - real);
            return { team, predicted: pred, real, gap, pts: gap === null ? null : rankPoints(gap) };
        }).sort((a, b) => a.predicted - b.predicted);
    }

    // picks : [pick1, pick2, pick3]   realFirst : nom du leader/gagnant réel ("" si inconnu)
    function pickRow(picks, realFirst) {
        const known = norm(realFirst) !== '';
        const hits = (picks || []).map(p => known && norm(p) === norm(realFirst));
        const pts = known ? hits.reduce((sum, hit, i) => sum + (hit ? PICK_POINTS[i] : 0), 0) : null;
        return { picks: picks || [], hits, pts };
    }

    function sumPoints(rows) {
        return rows.reduce((sum, row) => sum + (row.pts || 0), 0);
    }

    // Rang "à égalité" : 2 joueurs à 12 pts sont tous les deux 1er.
    function rankOf(players, player, key) {
        const value = player.scores[key] || 0;
        return 1 + players.filter(p => (p.scores[key] || 0) > value).length;
    }

    // Duel : une ligne par équipe, avec le rang prédit par chacun, l'écart entre eux et le rang réel.
    function duelConferenceRows(predA, predB, realList) {
        const rowsB = {};
        conferenceRows(predB, realList).forEach(row => { rowsB[row.team] = row; });

        return conferenceRows(predA, realList).filter(rowA => rowsB[rowA.team]).map(rowA => {
            const rowB = rowsB[rowA.team];
            return {
                team: rowA.team, real: rowA.real,
                a: rowA.predicted, b: rowB.predicted, diff: Math.abs(rowA.predicted - rowB.predicted),
                aPts: rowA.pts, bPts: rowB.pts
            };
        });
    }

    // Résumé d'un duel : accords, plus gros désaccord, écart de points.
    function duelSummary(a, b, categories) {
        let sameTeams = 0, totalTeams = 0, biggest = null;
        ['east', 'west'].forEach(conf => {
            Object.keys(a[conf] || {}).forEach(team => {
                if (!(team in (b[conf] || {}))) return;
                totalTeams++;
                const diff = Math.abs(a[conf][team] - b[conf][team]);
                if (diff === 0) sameTeams++;
                if (!biggest || diff > biggest.diff) biggest = { team, a: a[conf][team], b: b[conf][team], diff };
            });
        });

        let samePick1 = 0, totalCats = 0;
        categories.forEach(key => {
            const pickA = ((a.stats[key] || a.awards[key] || [])[0]);
            const pickB = ((b.stats[key] || b.awards[key] || [])[0]);
            totalCats++;
            if (norm(pickA) !== '' && norm(pickA) === norm(pickB)) samePick1++;
        });

        return {
            sameTeams, totalTeams, biggest: biggest && biggest.diff > 0 ? biggest : null,
            samePick1, totalCats,
            pointsGap: (a.scores.total || 0) - (b.scores.total || 0)
        };
    }

    return { rankPoints, conferenceRows, pickRow, sumPoints, rankOf, duelConferenceRows, duelSummary, norm, PICK_POINTS };
})();

if (typeof module !== 'undefined') module.exports = Scoring;
