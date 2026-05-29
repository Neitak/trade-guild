# claude.md
Claude MUST update this doc.
Le gameplay doit être simple mais profond. Met-toi toujours à la place du joueur et vérifie où il prend du plaisir.
Vérifie toujours l'équilibrage du gameplay et des nombres.

## Idea
**Name:** Trade Guild (nom provisoire)
**What:** Jeu de gestion économique fantasy médiéval. Références : Capitalism Lab, Offworld Trading Company, Stardew Valley (rythme), Splendor (objectifs), Monopoly (tension propriétés).
**Why:** For my personal entertainment and challenge
**State:** Design v6 — Phase 0 COMPLÉTÉE & TESTÉE (session 2026-05-28/29). Tick 1s. Machine d'état event-driven. Prêt pour Phase 1.

## Design decisions (v6 — 2026-05-27, refinés session 10)

- **Temps réel** : tick toutes les 1s (produit : 24h/jour). Journée = 30 ticks = 30s en dev. Les prix bougent à chaque tick.
- **Ressources = monnaie** : ZÉRO crafting complexe. Les ressources s'accumulent, se vendent sur le spot market contre de l'or, ou servent à acheter des bâtiments.
- **Phase 0 — Tutoriel bois** : démarrage 1 bois / 0g. Objectif : 10 bois via cycles sell→fall→buy→rise. Machine d'état event-driven (pas de timer).
  - **stable** (démarrage) : prix ~5g, oscillation douce → joueur cherche VENDRE
  - **falling** (après 1er sell) : caravane rumeur, prix chute vers 1g (15%/tick) → joueur achète
  - **rising** (après 1er achat) : caravane repartie rumeur, prix remonte vers 4.5g (10%/tick) → joueur revend
  - **cycle** : repetir falling/rising jusqu'à 10 bois
  - **done** (≥10 bois) : Phase 0 terminée, marché normal
- **Spot market = champ de bataille** : l'IA y achète aussi. 3 gestes fondamentaux : (1) vendre contre or, (2) acheter pour devancer l'IA, (3) vider pour priver l'IA (Dump).
- **Dump** : inonder le marché d'une ressource = punir un adversaire qui en dépend. Coût réel pour le dumpeur aussi.
- **Rumeurs imparfaites** : signal décalé sur les intentions IA et les événements monde. Jamais en temps réel. Injectées par les transitions d'état Phase 0.
- **Rachat hostile** : acheter par paliers de 5–10% un bâtiment adverse. 20% = 20% de sa production. 51% = prise de contrôle.
- **Win condition (WIP)** : actuellement course aux merveilles dans le code. Vision long terme : Immeubles (Tier 3) + générosité envers le continent.
- **Archetypes émergents** (PAS des rôles RPG) : Investisseur / Négociant / Manipulateur. Phases naturelles, switchables librement.
- **Chronique de fin** : récit auto des actions marquantes + conseil personnalisé pour la prochaine partie.
- **Nœuds de ressource** : dégradation douce (production ralentit progressivement). Jamais vide brutal.
- **Chaque guilde a une couleur** visible sur la carte.

## Sensations cibles (testées ✓ en Phase 0)
1. ✓ **"J'aurais dû attendre"** — attendre le prix haut avant de vendre → regret immédiat si on vend trop tôt
2. ✓ **"J'aurais dû vendre"** — prix remonte après achat → opportunité de revente observée
3. ✓ **"Pourquoi Brice achète là ?"** — il achète du bois quand le prix chute → stratégie visible

## Features actuelles (Phase 0 — COMPLÉTÉE & TESTÉE)
- 1 ressource (bois), 0g au départ, 1 bois initial
- Spot market sidebar permanent (300px), affiche rumeurs Phase 0 uniquement (pas doublon Carte)
- Courbe de prix live (tick par tick, 1s) + historique des trades
- Prix 5g stable → ~1g chute (15%/tick) → ~4.5g remontée (10%/tick)
- Machine d'état Phase 0 : stable → falling → rising → done (≥10 bois)
- Rumeurs déclenchées à chaque transition (caravane arrivée → repartie, périmées après)
- Brice rival actif — achète du bois au prix bas, suit la stratégie bois
- HUD : or (décimales), stock bois, jour/tick, classement guildes
- Barre progression Phase 0 : 10 bois reached = tuto fin (prêt Phase 1)
- Chronique de fin de partie (connectée à game state)
- `npm run dev` → port 5173 (localhost). Tick 1s = 30s/jour en dev

## Tech
- Frontend: React + Vite + TypeScript
- Backend: aucun (prototype local)
- Data: JSON statique
- Repo: https://github.com/Neitak/trade-guild.git (privé)
- `.gitignore` : CLAUDE.md, RUNBOOK.md, references/, images/, .env

## Architecture actuelle (v6)
```
src/
  data/         ← buildings.json, resources.json, wonders.json, scenarios.json
  components/   ← SpotMarket (sidebar), WorldMap, HUD, Chronicle
  engine/       ← types.ts, tick.ts, day.ts, market.ts, ai.ts,
                   buildings.ts, shares.ts, rumors.ts, chronicle.ts, init.ts
  sim/          ← simulate.ts (headless — erreurs TS connues, non critiques)
  App.tsx       ← setInterval tick 3s, layout sidebar 300px + main flex
```

**Useful commands:**
- `npm run dev` — lance le prototype sur localhost:5173

## Important Files
- [CONTEXT.md](CONTEXT.md) — glossaire du domaine v6 (source de vérité terminologique)
- [RUNBOOK.md](RUNBOOK.md) — état courant, pièges, commandes (gitignored)

## Visuals
- Fond ardoise `#1a1a2e`, accents or `#c9a84c`
- Fontes : Cinzel Decorative (titres), Marcellus (UI), EB Garamond (corps), Fira Code (mono)
- Courbe de prix : ligne verte sur fond sombre — élément signature, doit être beau
- Carte : nœuds et connexions SVG, couleurs par guilde

## Traps & Known Risks
- ⚠️ JAMAIS de crafting chains / bottlenecks → cassent la lisibilité et le fun
- ⚠️ Pas de +3% opaques → effets toujours lisibles, chiffrés, immédiats
- ⚠️ Upkeep passif contraignant → écarté (pas fun)
- ⚠️ Chemin optimal unique → design doit supporter 3 stratégies viables
- ⚠️ Information redondante → chaque donnée a un seul foyer (sauf UX contextuelle justifiée)
- ⚠️ Interface moche → le joueur (moi) abandonne le prototype. Minimum visuel non négociable.
- ⚠️ Roles RPG → on design des phases de gameplay émergentes, pas de classes
- ⚠️ `isAnimationActive={false}` sur tous les Recharts Line/Area sinon jerky au tick
- ⚠️ `priceHistory` ne reçoit des points QU'AUX TRADES — courbe live = local state dans le composant
- ⚠️ Les documents de référence (references/) sont des idées, pas des designs gravés dans le marbre — toujours interpréter au service du gameplay

## Later Ideas (garés)
- Bois → Patate ou autre ressource nourriture en Phase 0 (à réévaluer après tests)
- Bonus roguelite hebdomadaires (toutes les 7 journées, 3 propositions au choix)
- Marché noir (évolution naturelle du Manipulateur)
- Génération procédurale de la carte (sur structure fixe)
- Trading IRL mechanics (scalping, moyen terme)
- Objectifs asymétriques par guilde (chaque guilde vise une merveille différente)
- Multijoueur : Brice + Raph en joueurs humains, serveur 24/7, 1 semaine temps réel
- Win condition générosité : abondance partagée plutôt qu'or accumulé
