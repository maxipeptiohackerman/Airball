# Airball : idées et chantiers à venir

## Pronostics (page)
- [x] Onglets Classements / Stats & Awards / Évolution
- [x] Écart prono / réel, picks gagnants, lien direct par joueur
- [x] ~~Podium par catégorie~~ retiré : redondant avec les pastilles (le rang de chaque catégorie y est déjà) et lourd quand plusieurs joueurs sont à égalité
- [x] Duel entre deux joueurs (menu « Comparer avec »)
- [ ] **Grille « Tous les joueurs »** : équipes en lignes, joueurs en colonnes, cases colorées selon l'écart avec le réel
- [ ] **Vue consensus** : rang moyen prédit par équipe, % de joueurs derrière chaque pick (« 4 joueurs sur 6 ont pris SGA en MVP »)

## Soirée « reveal »
Aujourd'hui : la case à cocher `CONFIG!B2` révèle tout d'un coup.
- [ ] Révélation **progressive, catégorie par catégorie** (Est, Ouest, MVP...), pilotée depuis le Sheet
      (une case à cocher par étape dans CONFIG). Le serveur n'envoie que ce qui est révélé :
      un bouton public ne serait pas sûr, les données seraient lisibles avec F12.
- [ ] **Mode projection** de la page Pronostics : gros affichage, apparition animée, actualisation automatique
- [ ] Variante : révélation joueur par joueur

## Inscription
- [x] Fermée automatiquement le 20/10 à minuit, ou manuellement via CONFIG!B3 — volontairement indépendante de CONFIG!B2 (la révélation), pour pouvoir cocher B2 (aperçu, soirée reveal) sans fermer les inscriptions
- [x] Pseudo unique (casse et espaces ignorés), refus des pseudos qui seraient lus comme des formules
- [x] Classements et picks contrôlés côté serveur, renvoi du formulaire sans doublon
- [ ] Vérifier que le fuseau horaire du projet Apps Script est bien Europe/Paris (sinon la fermeture du 20/10 ne tombe pas à minuit à Paris)

## Comptes joueurs (plus tard)
Déjà en place pour préparer le terrain : identifiant unique par joueur (colonne BN), `js/api.js`.
- [ ] Connexion Google (jeton vérifié par Apps Script)
- [ ] Une seule inscription par personne (aujourd'hui rien n'empêche deux fois le même pseudo)
- [ ] Modifier ses pronos jusqu'à une date limite
- [ ] Voir ses propres pronos avant la révélation

## Mobile
- [x] Leaderboard en cartes (points et total visibles), Hall of Fame en cartes, tableaux NBA compacts
- [x] Navigation : cibles tactiles de 44 px, boutons sur toute la largeur
- [x] Formulaire : glisser-déposer par la poignée ☰ sur écran tactile, champs à 16 px (pas de zoom iOS)
- [ ] À valider sur un vrai téléphone (iPhone Safari surtout) avant de considérer le chantier terminé
- [ ] Duel : le tableau des picks défile horizontalement sur téléphone (affichage en cartes à étudier)

## Nettoyage technique
- [ ] Leaderboard : colonnes **triables** (clic sur « Pts Est », « Pts Ouest »...) pour voir le meilleur pronostiqueur de chaque catégorie, là où sont déjà ces colonnes
- [ ] Duel sur téléphone : le tableau des picks défile à l'intérieur de son cadre ; envisager un affichage en cartes par catégorie
- [ ] Brancher Leaderboard et Hall of Fame sur `js/api.js` (les appels serveur passeraient tous au même endroit)
- [x] Classements W/L (ESPN) : appel **direct depuis le navigateur** (pas de relais Apps Script). Tenté en relais côté serveur comme pour le reste, mais **ESPN renvoie HTTP 403 aux requêtes venant des serveurs Google** (Apps Script tourne sur l'infra Google Cloud, souvent bloquée comme trafic "datacenter" par les protections anti-scraping) — alors qu'un vrai navigateur n'a jamais été bloqué. Le relais a donc été retiré pour ce tableau précis (`Code.gs` : plus de route `espn-standings`/`espn-leaders`, plus de `getEspnData`/`UrlFetchApp`/`CacheService` liés à ESPN). **Si un souci "Failed to fetch" réapparaît côté navigateur** (CORS, bloqueur de pub), il n'y a plus de filet : il faudra alors une vraie solution de contournement IP (proxy tiers non-Google) plutôt que de refaire passer ça par Apps Script.
- [x] Bloc "Leaders Statistiques NBA" (ESPN) retiré : adresse supprimée par ESPN (404 direct, pas du CORS), sans remplaçant public documenté
- [x] Remplacé par un bloc "Statistiques & Awards" (5 stats + 6 trophées, 1er/2e/3e) sourcé depuis l'onglet **NBA DATA** du Google Sheet (`?page=nba-data`, jamais caché par la révélation) — à toi de le tenir à jour à la main dans le Sheet
- [x] Inscription via `js/api.js`, confirmée par une vérification (plus de faux « Inscription réussie »)
- [ ] Graphique de l'évolution de **tous** les joueurs sur la page Leaderboard
- [ ] Supprimer les inscrits de test du Sheet avant le lancement (fezf, Roger Rabbit, King James...)

## Tester sans dépenser de crédits Netlify
- Chrome : F12 puis Cmd+Shift+M (mode appareil mobile)
- Sur ton vrai téléphone, même Wi-Fi : extension VS Code « Live Server » (bouton Go Live), puis ouvrir `http://<IP-de-ton-Mac>:5500`
- Aperçu Netlify (gratuit) : pousser sur une branche `mobile` et ouvrir une Pull Request. Ne fusionner dans `main` que quand tout est bon
  (chaque déploiement de production coûte 15 crédits sur 300 par mois en plan gratuit)

## À savoir
- Le Sheet fait foi pour les **totaux** de points (LEADERBOARD). Le site ne recalcule que le détail ligne par ligne.
- Les identifiants de joueurs se créent avec `attribuerIdentifiants()` (Apps Script) ; les nouvelles inscriptions en reçoivent un automatiquement.
- Ce fichier est servi publiquement par Netlify comme le reste du site : n'y mets rien de confidentiel.
