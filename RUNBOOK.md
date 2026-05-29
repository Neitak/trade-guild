# RUNBOOK — Trade Guild v6

> Mis à jour : 2026-05-29 après session 10.
> Gitignored — jamais commité.

## État actuel

**Phase 0 tutoriel : COMPLÉTÉE & TESTÉE.**

Joueur démarre avec 1 bois, 0g. Machine d'état event-driven : stable (prix ~5g) → falling (après sell, prix chute vers 1g) → rising (après achat, prix remonte vers 4.5g) → cycle jusqu'à 10 bois.

Brice (IA rival) achète du bois au prix bas, propose une cible de trading lisible.

Rumeurs injectées à chaque transition Phase 0, périmées automatiquement (pas de doublon UI/Carte).

**Gameplay vérifié et fonctionnel. Prêt pour Phase 1.**

## Commandes utiles

```bash
npm run dev          # Démarre Vite sur localhost:5173 (tick 1s, 30s/jour en dev)
npx tsc --noEmit   # Vérifie les types (ignore simulate.ts — erreurs pré-existantes)
git status          # Vérifier l'état du repo
git add .           # Stage tout
git commit -m "..."  # Commit
git push            # Push vers GitHub privé
```

## Architecture

```
src/
  engine/
    init.ts           — TICKS_PER_DAY=30, state initiale
    tick.ts           — resolveTick, applyIntraDayNoise (Phase 0 machine d'état)
    market.ts         — getPhase0WoodState(), sellToMarket, buyFromMarket, recoverPrices
    types.ts, day.ts, ai.ts, buildings.ts, shares.ts, rumors.ts, chronicle.ts
  components/
    SpotMarket.tsx    — sidebar, courbes, rumeurs Phase 0
    WorldMap.tsx      — carte (pas de rumeurs, doublon supprimé)
    HUD.tsx, Chronicle.tsx
  App.tsx             — setInterval 1s, layout sidebar 300px + main flex
  data/               — buildings.json, resources.json, wonders.json
```

## Phase 0 Machine d'état

État dérivé depuis `getPhase0WoodState(state)` — aucun état séparé à maintenir.

| État | Condition | Prix | Rumeur |
|---|---|---|---|
| `stable` | Pas de sell | ~5g oscillation douce | — |
| `falling` | sell > buy | chute vers 1g (15%/tick) | ⚠ Caravane arrivée |
| `rising` | sell == buy (et <10 bois) | remonte vers 4.5g (10%/tick) | Caravane repartie |
| `done` | inventaire ≥ 10 bois | marché normal | — |

Chaque transition supprime les rumeurs périmées (filtre `.includes('caravane')` ou `.includes('redresse')`).

## Ce qui fonctionne

- ✓ Démarrage : 1 bois, 0g
- ✓ Prix réagit aux ventes/achats du joueur (élasticité)
- ✓ Phase 0 cycles : sell → fall → buy → rise → repeat
- ✓ Rumeurs injectées aux transitions, périmées après
- ✓ Courbe live (tick par tick) + historique trades
- ✓ Gold format : <10 → 2dec, <100 → 1dec, ≥100 → entier
- ✓ Brice IA : achète au prix bas, stratégie bois
- ✓ HUD : or, bois, jour/tick, classement guildes
- ✓ Progression Phase 0 : atteindre 10 bois
- ✓ Chronique de fin de partie

## Paramètres dev

- **TICKS_PER_DAY = 30** → 30s/jour en dev (1 tick = 1s)
- **Prod target : 1 jour = 24h réel** (TICKS_PER_DAY = 86400 ou équivalent)
- Volatilité Phase 0 : 0.04 (stable), 0.025 (hors Phase 0)
- Pull Phase 0 falling : 15%/tick vers 1g
- Pull Phase 0 rising : 10%/tick vers 4.5g
- Brice gold start : 80g (achète Scierie immédiatement)

## Sensations validées ✓

1. ✓ **"J'aurais dû attendre"** — vendre à 5g au lieu de 4g → regret immédiat
2. ✓ **"J'aurais dû vendre"** — achète, voit le prix remonter → opportunité observe
3. ✓ **"Pourquoi Brice achète là ?"** — il achète du bois quand le prix chute → cible visible

## Prochaine étape

**Phase 1 : Premier bâtiment de production.**

À débloquer : bouton Scierie (10 bois acheté) → génère production automatique de bois → ouvre achat des Scieries à d'autres spots.

## Décisions prises (session 10)

1. **Événement déclenché par le joueur, pas le temps.** Phase 0 = event-driven (log des sells/buys) vs timer-driven. Plus robuste en multijoueur.
2. **Rumeurs périmées.** Quand "repartie" injectée, "arrivée" filtrée. Un seul message Phase 0 actif.
3. **Affichage simplifié.** Rumeurs uniquement SpotMarket, pas doublon Carte.
4. **Tick accéléré.** 1s au lieu de 3s, Phase 0 testable en ~5 min.

## Pièges connus

- ⚠️ **`simulate.ts` erreurs TS pré-existantes** (fs/path/process/tex). Ignorer, ne pas toucher.
- ⚠️ **Merveilles encore dans le code.** Remplacer par Immeubles (Tier 3) plus tard.
- ⚠️ **Phase 0 sort à 10 bois.** Phase 1 pas encore implémentée.
- ⚠️ **Brice achète trop agressivement.** À surveiller si coûts bâtiments baissent.
- ⚠️ **`isAnimationActive={false}` obligatoire** sur tous les Recharts Line/Area sinon jerky.

## Références

- `CLAUDE.md` — design decisions v6 complet
- `CONTEXT.md` — glossaire domaine v6
- `references/MARKET_SIMULATION_ARCHITECTURE_V2.md` — règles économie
- `references/Mon concept de refonte.md` — brainstorm design original
