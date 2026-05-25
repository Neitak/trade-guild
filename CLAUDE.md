# claude.md
Claude MUST update this doc.
Le gameplay doit être simple mais profond. Met-toi toujours à la place du joueur et vérifie où il prend du plaisir.
Vérifie toujours l'équilibrage du gameplay et des nombres.

## Idea
**Name:** Trade Guild (nom provisoire)
**What:** Jeu de gestion économique fantasy médiéval. Références : Capitalism Lab, Offworld Trading Company, Stardew Valley (rythme), Splendor (objectifs), Monopoly (tension propriétés).
**Why:** For my personal entertainment and challenge
**State:** Design v5 verrouillé (session 2026-05-25) — prototype strict minimum à coder

## Design decisions (v5 — 2026-05-25)
- **Boucle Stardew Valley** : journée temps réel → bouton "Fin de journée" → révélation des gains → matin = nouvelle promesse. Journée molle = skip sans culpabilité.
- **Ressources = monnaie** : ZÉRO crafting. Les ressources s'accumulent et servent à acheter des bâtiments Tier 2 (commerciaux) OU se vendent sur le spot market contre de l'or.
- **Spot market = champ de bataille** : l'IA y achète aussi. 3 gestes fondamentaux : (1) vendre contre or, (2) acheter pour devancer l'IA sur un bâtiment, (3) vider pour priver l'IA.
- **Dump** : inonder le marché d'une ressource = punir un adversaire qui en dépend. Coût réel pour le joueur aussi.
- **Rachat hostile** : acheter par paliers de 5-10% un bâtiment adverse. 20% = 20% de sa production reçue. 51% = transfert. L'adversaire peut racheter ses parts.
- **Rumeurs imparfaites** : signal décalé sur les intentions IA. *"Tex semble accumuler du bois."* Jamais en temps réel. Visible en bulle sur carte.
- **Win condition : course aux merveilles** (~30-45min, fin explicite). Merveilles visibles dès le début, coûtent massivement des ressources, score composite (merveilles + bâtiments).
- **Archetypes émergents** (PAS des rôles RPG) : Investisseur / Négociant / Manipulateur. Phases naturelles, switchables librement.
- **Chronique de fin** : récit auto des actions marquantes + conseil personnalisé pour la prochaine partie.
- **Scénario de début** : 1-2 phrases loufoques qui posent l'enjeu. Ex : *"Tex vient d'arriver en ville avec 500 pièces d'or. Toi, tu as une pomme et 10 pièces d'or. Objectif : ériger la Tour de Magie avant lui."*
- **Nœuds de ressource** : dégradation douce (production ralentit progressivement). Jamais vide brutal. Nouveaux bâtiments apparaissent narrativement (économie florissante = nouveaux travailleurs).
- **Chaque joueur a une couleur** visible sur la carte.

## Features (prototype strict minimum v5)
- 1 ressource (pommes), 1 bâtiment extraction (verger, acheté avec or), 1 bâtiment commercial (marché aux fruits, acheté avec 200 pommes)
- Spot market avec courbe de prix Recharts
- Tex qui achète aussi sur le spot + rumeurs basiques
- Fin de journée consciente (bouton "Terminer cette journée")
- 1 merveille visible (Tour de Magie), condition de victoire
- HUD permanent : or (gros, toujours visible), ressources, jour en cours

## Tech
- Frontend: React + Vite + TypeScript
- Backend: aucun (prototype local)
- Data: JSON statique
- Deployment: local
- Repo (private): à créer
- `.gitignore` CLAUDE.md, references/, images/, .env → safe to push private repo

## Architecture cible v5
```
src/
  data/          ← buildings.json, resources.json, wonders.json, scenarios.json
  components/    ← SpotMarket, WorldMap, HUD, EndOfDay, Chronicle
  engine/        ← day.ts, ai.ts, rumors.ts, shares.ts
  App.tsx
```

**Useful commands:**
- `npm run dev` — lance le prototype

## Important Files
- [CONTEXT.md](CONTEXT.md) — glossaire du domaine v5 (source de vérité terminologique)

## Visuals
- Fond ardoise `#1a1a2e`, accents or `#c9a84c`
- Fonte médiévale pour les titres (ex: MedievalSharp, gratuite)
- Courbe de prix : ligne or sur fond sombre — c'est l'élément signature, doit être beau dès le départ
- Carte : nœuds et connexions, icônes dessinées, texte avec typo médiévale

## Traps & Known Risks
- ⚠️ JAMAIS de crafting chains / bottlenecks → cassent la lisibilité et le fun
- ⚠️ Pas de +3% opaques → effets toujours lisibles, chiffrés, immédiats
- ⚠️ Upkeep passif contraignant → écarté (pas fun)
- ⚠️ Chemin optimal unique → design doit supporter 3 stratégies viables
- ⚠️ Information redondante → chaque donnée a un seul foyer (sauf UX contextuelle justifiée)
- ⚠️ Interface moche → le joueur (moi) abandonne le prototype. Minimum visuel non négociable.
- ⚠️ Objectif formulé comme question ou lapalissade → toujours une vocation/obligation claire
- ⚠️ Roles RPG → on design des phases de gameplay émergentes, pas de classes

## Later Ideas (garés)
- Bonus roguelite hebdomadaires (toutes les 7 journées, 3 propositions au choix)
- Marché noir (évolution naturelle du Manipulateur)
- Génération procédurale de la carte (sur structure fixe)
- Trading IRL mechanics pour approfondir le spot market (scalping, moyen terme)
- Objectifs asymétriques par guilde (chaque guilde vise une merveille différente)
