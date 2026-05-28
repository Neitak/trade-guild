# CONTEXT.md — Trade Guild v6

> Mis à jour : 2026-05-28 — session 9. Ressource Phase 0 = Bois (pas Patate). Merveilles → Immeubles WIP.

## Termes du domaine

**Guilde** — entité jouable. Chaque joueur (humain ou IA) contrôle une guilde. Couleur distincte visible sur la carte. Brice et Raph sont les noms des guildes rivales (frères IRL du joueur — IA en attendant le multijoueur).

**Tick** — unité de temps atomique. 1 tick = 3 secondes. Les prix bougent à chaque tick. Les bâtiments produisent à chaque tick. Le jeu est continu, pas tour par tour.

**Bois** — ressource de départ (Phase 0). Appartient à la catégorie LOGEMENT. Première ressource accessible au joueur, marché toujours ouvert dès le début. Le joueur démarre avec 1 bois et 0 or.

**Patate** — ressource NOURRITURE prévue pour une phase ultérieure. N'est PAS la ressource de départ (idée antérieure abandonnée).

**Ressource** — bien produit par un bâtiment de production et échangeable sur le marché spot. Catégories : NOURRITURE (patates, pommes, pain, légumes), BIENS DE CONSO (meubles, tapis, objets raffinés), LOGEMENT (bois, pierre, verre). Chaque ressource a un marché dédié. Un marché s'ouvre quand un joueur construit le bâtiment de production correspondant.

**Bâtiment de production (Tier 1)** — acheté avec de l'or. Produit automatiquement une ressource à chaque tick. Ouvre l'accès à son marché spot. Exemple : Champ de patates → produit des patates + ouvre le marché patate. 5 tiers de performance (débloqués en payant de l'or) : chaque tier double la production.

**Atelier (Tier 2)** — acheté avec de l'or. Effectue UNE seule transformation (pas de chaîne complexe). Exemple : patates → conserves, bois → meubles. Ouvre un marché de produit transformé.

**Immeuble (Tier 3)** — acheté avec ressources + or. Génère un loyer passif automatique. Prend de la valeur chaque jour. Exemples : Tour de Mage, Taverne, Port, Marché de potions.

**Marché spot** — lieu d'échange en temps réel où les ressources se vendent et s'achètent. PAS une interface passive : c'est un champ de bataille. Tous les joueurs y agissent. 3 gestes fondamentaux : (1) vendre ses ressources pour de l'or, (2) acheter pour devancer les autres sur un bâtiment, (3) vider pour priver un rival d'une ressource.

**Nœud de carte** — emplacement de construction sur la World Map. Groupés par zone thématique (zone forêt, zone prairie, etc.). Nombre de nœuds = nombre de joueurs. Chaque joueur peut avoir chaque type de bâtiment en 1 exemplaire. Affiche une icône chantier + prix direct.

**Événement monde** — choc exogène sur l'offre ou la demande. Causé par le monde (caravanes, météo, fêtes, guerres), jamais par un joueur nommé (incompatible multijoueur). Types : festivals (annoncés plusieurs jours à l'avance), intempéries (annoncées 1 jour avant), fêtes annuelles de ressource (ex : Fête de la patate). Chaque événement crée une crise ET une opportunité pour quelqu'un.

**Événement d'ouverture (Phase 0)** — courbe haussière scriptée sur le bois (biais fort les 3 premiers jours). Prix part bas et monte, enseignant le premier geste : attendre le bon moment pour vendre. Version future prévue : caravane narrative arrivant en ville, justification indépendante de tout joueur → compatible multijoueur.

**Dump** — vendre massivement une ressource pour en faire chuter le prix. Arme offensive contre un rival qui en dépend. Coût réel pour le dumpeur aussi s'il possède cette ressource — décision stratégique, pas un exploit.

**Corner** — contrôler une part suffisante de la production d'une ressource pour en influencer le prix durablement. Effet émergent issu de la possession de la majorité des bâtiments de production d'un type.

**Rachat hostile** — achat de parts d'un bâtiment rival, par paliers de 5-10%. 20% = 20% de sa production reçue. 51% = prise de contrôle. Le rival peut racheter ses parts pour se défendre.

**Rumeur** — signal imparfait et décalé sur l'activité d'un rival. Jamais en temps réel, toujours un coup de retard. Exemples : *"Brice semble accumuler du bois"*, *"Raph a dumpé le marché des patates"*. Le joueur décide sur information incomplète. Visible en bulle d'info sur la carte.

**Capital** — or du joueur (g / gold / po / pièce d'or). HUD permanent, toujours visible. Permet d'acheter des bâtiments, racheter des parts, trader sur le spot.

**Les 3 besoins du monde** — forces économiques qui pilotent les marchés automatiquement : Nourriture (pénurie → prix explosent, villes stagnent), Biens de consommation (abondance → luxe, marchés premium), Logement (demande dérivée de la croissance des villes). En cascade : nourriture abondante → villes grandissent → demande logement → demande meubles → économie de luxe → tensions nourriture.

**Archétype de gameplay** — phase émergente, pas un rôle choisi ni une classe RPG. Investisseur (carte, revenus passifs), Négociant (spot market, timing), Manipulateur (dump, corner, rachat hostile). Switchables librement en cours de partie.

**Chronique** — récit automatique généré en fin de partie résumant les actions marquantes. *"La guilde du Joueur a asséché le marché du bois au jour 14, provoquant l'effondrement de la taverne de Brice."* Même un échec devient une histoire mémorable. Accompagnée d'un conseil pour la prochaine partie.

**Phase** — étape de progression du joueur définie par son niveau de bâtiments :
- Phase 0 : 0 bâtiment — trading pur sur 1 marché (bois), objectif 10 bois → Bûcheron
- Phase 1 : 1er bâtiment de production — production automatique
- Phase 2 : 1er atelier — transformation + multi-marchés
- Phase 3 : 1er immeuble — revenus passifs + valeur croissante

## Termes supprimés ou en transition (v5 → v6)

- **Journée / Fin de journée** → remplacé par **Tick** (temps continu) et **Phase** (progression)
- **Boucle Stardew Valley** → supprimée. Le jeu est continu, pas en tranches journalières.
- **Merveilles (win condition)** → *WIP* : encore présentes dans le code (tour_of_magic, grande_cathedrale). Vision long terme : remplacées par **Immeubles** (Tier 3) + objectif de générosité envers le continent.
- **Pomme comme ressource de démarrage** → remplacé par **Bois** (Phase 0 actuelle)
- **Patate comme ressource de démarrage** → idée abandonnée. Patate reste une ressource NOURRITURE future.
- **ZÉRO crafting** → nuancé : UNE transformation par atelier (pas de chaînes)
- **Tex** → remplacé par **Brice** et **Raph** (noms réels des rivaux)
