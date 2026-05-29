# Trade Guild — CLAUDE.md
Claude MUST update this doc when design decisions change.

## Session start protocol
**Lis `references/` au début de chaque session** si le travail touche l'économie, les ressources ou les bâtiments. Ces fichiers sont la mémoire de travail du joueur — il les a écrits pour ne pas avoir à répéter. Ne jamais les ignorer.

---

## Règles de design inviolables
Ces règles ne changent pas. Ne pas les oublier, ne pas les contourner.

1. **Démarrage simultané** — Brice, Raph et Nun (le joueur) démarrent tous au Jour 0. Les entrées décalées (ex: Raph arrive au J5) sont uniquement du scaffolding DEV, jamais du design final.
2. **Slots génériques** — Les emplacements sur la carte ne sont pas liés à un bâtiment précis. Le joueur choisit son bâtiment dans une liste filtrée par type de slot (`farm`, `extraction`, `workshop`, `commercial`). Ne jamais créer de slots `sawmill_slot` ou `orchard_slot`.
3. **Une seule transformation** par atelier. Pas de chaînes complexes. Bois → Meubles. Olive → Huile. C'est tout.
4. **Filières symétriques** — Tier 1 (Bûcheron, Oliveraie) → Tier 2 (Menuiserie, Presse). Chaque filière a une extraction et une transformation.
5. **Pas de crafting chains** — ZÉRO bottleneck. Les ressources s'accumulent, se vendent, ou entrent dans UN atelier.
6. **Effets lisibles** — Jamais de +3% opaque. Tout effet est chiffré et visible immédiatement.
7. **3 stratégies viables** — Investisseur / Négociant / Manipulateur. Pas de chemin optimal unique.
8. **Archetypes émergents** — Pas de classes RPG. Les phases de gameplay sont naturelles et switchables.

---

## Idea
**Name:** Trade Guild (provisoire)
**What:** Jeu de gestion économique fantasy médiéval. Références : Capitalism Lab, Offworld Trading Company, Stardew Valley (rythme), Splendor (objectifs), Monopoly (tension propriétés).
**Why:** For my personal entertainment and challenge
**State:** v7 en cours — Phase 0 testée, refactor ressources (olive/huile remplace apple/pierre).

---

## Ressources (v7 — décidé session 2026-05-29)

| Code ID | UI FR | Catégorie | Prix base | Notes |
|---|---|---|---|---|
| `wood` | Bois | Construction | 3.5or | Produit par Bûcheron (sawmill) |
| `olive` | Olives | Alimentaire | 2.0or | Produit par Oliveraie |
| `meuble` | Meubles | Confort | 9.0or | Produit par Menuiserie (wood→meuble) |
| `huile` | Huile d'olive | Luxe | 9.0or | Produit par Presse (olive→huile) |
| `pierre` | Pierre | *(de côté)* | — | Dans le code mais hors carte pour l'instant |

---

## Bâtiments (v7)

### Tier 1 — Extraction / Agriculture (slots génériques)
| Code ID | UI FR | Slot type | Produit | Production/jour |
|---|---|---|---|---|
| `sawmill` | Bûcheron | `extraction` | wood | 8 |
| `olivery` | Oliveraie | `farm` | olive | 6 |

### Tier 2 — Transformation (slots workshop)
| Code ID | UI FR | Input/jour | Output/jour | Coût construction |
|---|---|---|---|---|
| `menuiserie` | Menuiserie | 4 bois | 1 meuble | 80 bois |
| `press` | Presse | 3 olives | 1 huile | *(à définir)* |

### Tier 3 — Commercial (slots commercial)
| Code ID | UI FR | Revenue | Coût construction |
|---|---|---|---|
| `auberge` | Auberge | 20→110or/jour (T1→T5) | 40or + 20bois + 10huile |

---

## Rivaux (v7)
- **Brice** — démarre Jour 0, pump&dump sur le bois
- **Raph** — démarre Jour 0, filière olive complète (Oliveraie → Presse → Huile)
- Pseudonyme joueur : **Nun**

---

## Phase 0 — Tutoriel bois (inchangé)
Démarrage : 1 bois, 0or. Objectif : 10 bois via cycles sell→fall→buy→rise.
- `stable` → prix ~5or, joueur vend
- `falling` → caravane, prix chute vers 1or
- `rising` → caravane repartie, prix remonte vers 4.5or
- `done` (≥10 bois) → déblocage Bûcheron (coût : 10 bois, 0or)

Note : Brice est actif dès le début (pump&dump). Raph aussi. Phase 0 = focus tutorial bois, mais les rivaux sont là.

---

## Mécaniques de marché
- Tick 1s, journée = 30 ticks (30s en dev)
- Spot market = champ de bataille — l'IA y achète aussi
- Dump : inonder le marché punit l'adversaire qui en dépend
- Rumeurs imparfaites : signal décalé, jamais temps réel
- Rachat hostile : par paliers 5–10%. 51% = prise de contrôle
- Dégradation douce des extracteurs (~0.5%/jour, max 40%)

---

## Win condition (v7)
Richesse nette à J60. Win anticipé : Auberge T5 + 30% d'avance sur le meilleur rival.

---

## Tech
- Frontend: React + Vite + TypeScript
- Backend: aucun (prototype local)
- Data: JSON statique (`src/data/`)
- Repo: https://github.com/Neitak/trade-guild.git (privé)
- `.gitignore` : CLAUDE.md, RUNBOOK.md, references/, images/, .env
- `npm run dev` → localhost:5173. Tick 1s.

## Architecture
```
src/
  data/         ← buildings.json, resources.json, wonders.json
  components/   ← SpotMarket, WorldMap, HUD, Chronicle
  engine/       ← types.ts, tick.ts, day.ts, market.ts, ai.ts,
                   buildings.ts, shares.ts, rumors.ts, chronicle.ts, init.ts
  App.tsx       ← tick engine (1s), layout, dev panel
```

---

## Visuals
- Fond ardoise `#1a1a2e`, accents or `#c9a84c`
- Fontes : Cinzel Decorative (titres), Marcellus (UI), EB Garamond (corps), Fira Code (mono)
- Courbe de prix : ligne verte sur fond sombre — élément signature
- Carte : nœuds SVG, couleurs par guilde

---

## Pièges techniques connus
- `isAnimationActive={false}` sur tous les Recharts Line/Area sinon jerky au tick
- `priceHistory` ne reçoit des points QU'AUX TRADES — courbe live = local state dans le composant
- `canAffordBuilding` doit gérer multi-coût (or + ressources)

---

## Later Ideas (garés)
- Bonus roguelite hebdomadaires
- Marché noir (évolution Manipulateur)
- Génération procédurale de carte
- Trading IRL mechanics (scalping)
- Objectifs asymétriques par guilde
- Multijoueur : Brice + Raph joueurs humains
- Win condition générosité : abondance partagée
- Plus de filières Tier 1 : tomate, vigne, abricot, chou, fer, or…
