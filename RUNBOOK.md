# RUNBOOK — Trade Guild v5 (ne pas commiter)

## État actuel (2026-05-25, session 3)

Prototype v5 **jouable**. Engine pur TS + sim headless + UI React complète.
Bugs critiques corrigés. Fixes UI appliqués (fonts, boutons carte).
Premier commit à faire.

## Commandes utiles

```bash
npm run dev          # lance le proto sur localhost:5173
npm run sim          # simulation 1 partie headless (console)
npm run sim:batch    # 100 parties automatiques (stats équilibrage)
```

## Architecture livrée

```
src/
  engine/   — types, market, day, ai, buildings, shares, rumors, chronicle, init
  sim/      — simulate.ts (headless bot joueur passif)
  data/     — buildings.json, resources.json, wonders.json, scenarios.json
  components/ — HUD, SpotMarket, WorldMap, EndOfDay, Chronicle
  App.tsx   — dispatch pattern, état immutable
```

## Paramètres actuels (à ajuster après jeu réel)

- Verger : 10 or
- Marché aux fruits : 200 pommes
- Tour de Magie : 800 pommes
- Sim avg : 42j, Tex gagne 100% (bot passif) — normal, à rééquilibrer

## Décisions prises cette session

- Font size 17px (15px trop petit sur écran réel)
- Boutons carte : affichent le coût ("10 or — Acheter", "200 🍎 — Acheter", "Part 10% (Xor)")
- foreignObject largeur 130px pour tous les boutons SVG (texte complet)
- Wonder séparée : playerContributed / texContributed (pas de pool partagé)
- addBuildingToMap : flag assigned pour n'assigner qu'un seul slot

## Prochaines étapes

1. Jouer plusieurs vraies parties
2. Identifier les déséquilibres (Tex trop fort ? merveille trop lente ?)
3. Ajuster buildings.json / wonders.json
4. Polish visuel : animations rumeurs, transitions EndOfDay

## Pièges connus

- `Array.map()` sans flag assigne TOUS les slots qui matchent → toujours utiliser `let assigned = false`
- `??` + ternaire : précédence surprenante → toujours parenthèser `?? (cond ? a : b)`
- Recharts YAxis domain : tableau de 2 fonctions séparées, pas une fonction unique
- foreignObject dans SVG : la largeur ne s'adapte pas automatiquement → toujours vérifier le texte le plus long

## Références

- `CONTEXT.md` — glossaire v5 (source de vérité terminologique)
- `CLAUDE.md` — design decisions v5 verrouillées
- `~/.claude/memory/feedback-engine-bugs.md` — 4 bugs critiques documentés
