# CONTEXT.md — Trade Guild v5

> Mis à jour : 2026-05-25 — session grill-me design v5. Remplace intégralement le CONTEXT.md v4.

## Termes du domaine

**Journée** — unité de temps principale. La journée tourne en temps réel (bâtiments produisent, prix bougent, IA agit). Le joueur peut la terminer à tout moment avec le bouton "Fin de journée" ou la skiper si rien d'intéressant ne se passe. Modèle Stardew Valley : la nuit révèle ce qu'on a gagné, le matin est une nouvelle promesse.

**Ressource** — bien produit par un bâtiment d'extraction et échangeable sur le marché spot. Les ressources ne se transforment pas en d'autres ressources (pas de crafting). Elles servent de **monnaie** pour acheter des bâtiments commerciaux (Tier 2) ou se vendent contre de l'or sur le spot. Exemples : pommes, fer, bois, cristaux magiques.

**Nœud de ressource** — emplacement géographique sur la carte produisant une ressource spécifique. Chaque nœud se dégrade lentement (production passe de 100% → 80% → 60%...). Jamais complètement vide, mais le signal de dégradation force le joueur à anticiper un pivot. Les nœuds n'apparaissent pas via exploration — ils sont visibles dès le départ. De nouveaux nœuds/bâtiments apparaissent progressivement parce que l'économie florissante attire de nouveaux travailleurs.

**Bâtiment d'extraction (Tier 1)** — acheté avec de l'or, produit des ressources chaque journée. Exemples : verger (→ pommes), mine (→ fer), bûcheron (→ bois). La production se dépose automatiquement dans l'inventaire du joueur.

**Bâtiment commercial (Tier 2)** — acheté avec des ressources (pas de l'or). Génère un revenu passif en or par journée. La course pour acheter un bâtiment commercial avant l'IA crée la tension principale du jeu. Exemple : marché aux fruits (coûte 200 pommes, rapporte 5g/jour).

**Merveille (Tier 3)** — bâtiment spécial visible sur la carte dès le début de la partie. Coûte une quantité massive de ressources variées. Les merveilles sont les objectifs de victoire : première guilde à en construire le nombre requis gagne. Une merveille peut aussi conférer des effets stratégiques passifs.

**Marché spot** — lieu d'échange en temps réel où les ressources se vendent et s'achètent. Ce n'est pas une interface passive : c'est un champ de bataille. L'IA y achète aussi. Trois gestes fondamentaux : (1) vendre ses ressources pour de l'or, (2) acheter des ressources pour devancer l'IA sur un bâtiment, (3) vider le marché pour priver l'IA d'une ressource dont elle a besoin.

**Rumeur** — signal imparfait et décalé sur l'activité d'une guilde adverse. Jamais en temps réel, toujours un coup de retard. Exemples : *"Tex semble accumuler du bois"*, *"Sam a dumpé le marché de la pomme"*. Le joueur doit décider sur une information incomplète — c'est le plaisir de l'anticipation. Les rumeurs apparaissent aussi comme bulles d'info sur la carte (intentions probables d'achat sur un bâtiment).

**Dump** — inonder volontairement le marché spot d'une ressource pour en faire chuter le prix. Arme offensive : si Tex a un bâtiment commercial qui génère des pommes, dumper les pommes réduit ses revenus. Coût réel pour le joueur si il possède aussi cette ressource — décision stratégique, pas un exploit.

**Corner** — contrôle d'une part suffisante de la production d'une ressource pour en influencer le prix. Effet émergent, pas une action explicite. Se crée en possédant la majorité des bâtiments d'extraction d'une ressource.

**Rachat hostile** — achat de parts d'un bâtiment adverse, par paliers de 5-10%. Posséder 20% de la mine de Tex = recevoir 20% de sa production de fer, Tex en reçoit 80%. À 51%, le bâtiment passe sous contrôle. Tex peut racheter ses parts pour se défendre. Arme progressive du Manipulateur.

**Capital** — ressource principale du joueur, exprimée en or (g). Permet d'acheter des bâtiments Tier 1, de racheter des parts adverses, et de participer au spot market. Visible en permanence dans le HUD — c'est le battement de cœur du jeu.

**Chronique** — récit automatique généré en fin de partie résumant les actions marquantes du joueur. *"La guilde du Joueur a asséché le marché du bois au jour 14, provoquant l'effondrement de l'auberge de Tex."* Transforme même un échec en histoire mémorable. Accompagnée d'un conseil personnalisé pour la prochaine partie.

**Compounding loop** — plaisir fondamental du jeu : voir sa base de pouvoir grossir de façon exponentielle grâce à ses décisions passées. Pas un jeu idle. L'accumulation est active : chaque ressource stockée est un pari sur l'avenir.

**Archétype de gameplay** — phase émergente de jeu, pas un rôle choisi ni une classe RPG. Tout joueur peut être Investisseur (carte du monde, revenus passifs), Négociant (spot market, timing des prix) ou Manipulateur (dump, corner, rachat hostile) selon ce que le marché lui suggère ce jour-là. On peut switcher en cours de partie.

**Événement** — choc sur l'offre ou la demande (sécheresse, attaque de géant, fête royale). Certains annoncés via rumeurs, d'autres surprises. Modifie les prix ou la production pendant N journées.

**Scénario** — contexte loufoque et léger généré en début de partie. Justifie quelles ressources sont en forte demande et pose le décor narratif. Exemple : *"Tex vient d'arriver en ville avec 500 pièces d'or. Toi, tu as une pomme et 10 pièces d'or. Objectif : ériger la Tour de Magie avant lui."*

## Termes supprimés (v4 → v5)

- **Tour** → remplacé par **Journée**
- **Sandbox** → remplacé par **course aux merveilles** (~30-45 min, fin explicite)
- **Marchands IA invisibles** → remplacé par **Rumeurs** (signal imparfait) + icônes sur carte
- **Position** (stock pour revente inter-marchés) → concept fusionné dans Ressource + Marché spot
- **Chaîne de production / Crafting** → supprimé. Les ressources ne se transforment pas.
