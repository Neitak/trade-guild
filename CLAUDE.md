# claude.md
Claude MUST update this doc.
Le gameplay doit être simple mais profond. Met-toi toujours à la place du joueur et vérifie où il prend du plaisir.
Vérifie toujours l'équilibrage du gameplay et des nombres.

## Idea
**Name:** Trade Guild (nom provisoire)
**What:** Jeu de gestion économique fantasy médiéval. Références : Capitalism Lab, Offworld Trading Company, Stardew Valley (rythme), Splendor (objectifs), Monopoly (tension propriétés).
**Why:** For my personal entertainment and challenge
**State:** Design v6 — Phase 0 jouable (session 2026-05-27/28). Moteur temps réel. Tests en cours.

## Design decisions (v6 — 2026-05-27)

- **Temps réel** : tick toutes les 3s. Les prix bougent en continu. Pas de bouton "Fin de journée". Le jour avance seul (30 ticks = 90s en dev).
- **Ressources = monnaie** : ZÉRO crafting complexe. Les ressources s'accumulent, se vendent sur le spot market contre de l'or, ou servent à acheter des bâtiments.
- **Phase 0 — Bois** : démarrage 1 bois / 0 or. Objectif : accumuler 10 bois pour débloquer le premier bâtiment (Bûcheron/Scierie). Un seul marché visible, un seul rival (Brice).
- **Spot market = champ de bataille** : l'IA y achète aussi. 3 gestes fondamentaux : (1) vendre contre or, (2) acheter pour devancer l'IA sur un bâtiment, (3) vider pour priver l'IA (Dump).
- **Dump** : inonder le marché d'une ressource = punir un adversaire qui en dépend. Coût réel pour le dumpeur aussi.
- **Pénurie probabiliste** : événement sur le bois, 40–90% de chance, magnitude inconnue, rumeur 10–20 ticks avant. Tension : croire ou pas le signal ?
- **Rumeurs imparfaites** : signal décalé sur les intentions IA et les événements monde. Jamais en temps réel.
- **Rachat hostile** : acheter par paliers de 5–10% un bâtiment adverse. 20% = 20% de sa production. 51% = prise de contrôle.
- **Win condition (WIP)** : actuellement course aux merveilles dans le code. Vision long terme : Immeubles (Tier 3) + générosité envers le continent. En transition.
- **Archetypes émergents** (PAS des rôles RPG) : Investisseur / Négociant / Manipulateur. Phases naturelles, switchables librement.
- **Chronique de fin** : récit auto des actions marquantes + conseil personnalisé pour la prochaine partie.
- **Scénario de début** : *"Tu arrives en ville avec une planche de bois et zéro pièce d'or. Brice, lui, a déjà les yeux sur la scierie."*
- **Nœuds de ressource** : dégradation douce (production ralentit progressivement). Jamais vide brutal.
- **Chaque guilde a une couleur** visible sur la carte.

## Sensations cibles (à valider dans cet ordre)
1. **"J'aurais dû attendre"** — regret de timing sur le prix
2. **"Pourquoi Brice achète là ?"** — lecture sociale du marché
3. **"La rumeur s'est réalisée et j'étais positionné"** — anticipation confirmée

## Features actuelles (Phase 0 — jouable)
- 1 ressource (bois), 0 or au départ, 1 bois initial
- Spot market sidebar permanente gauche (300px), toujours visible
- Courbe de prix live (tick par tick) + historique des trades
- Brice comme seul rival actif — achète du bois, réagit aux rumeurs
- Pénurie probabiliste avec rumeurs graduées
- HUD : or (avec décimales), stock bois, jour/tick, progression merveilles, classement guildes
- Barre de progression Phase 0 : 10 bois → bouton Bûcheron (cosmétique pour l'instant)
- Chronique de fin de partie

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
