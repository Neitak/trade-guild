#!/usr/bin/env npx tsx
/**
 * Headless simulation — Trade Guild v7
 * Usage:
 *   npm run sim                   → 1 partie, rapport détaillé
 *   npm run sim:batch             → 100 parties, stats d'équilibre
 *   npm run sim -- --games=50     → 50 parties
 *   npm run sim -- --bot=wood     → bot joueur focalisé bois
 *   npm run sim -- --bot=olive    → bot joueur focalisé olive
 *   npm run sim -- --bot=passive  → bot joueur passif (vend tout)
 */

import { initGame } from '../engine/init'
import { resolveEndOfDay } from '../engine/day'
import { buyBuilding } from '../engine/buildings'
import { sellToMarket, buyFromMarket } from '../engine/market'
import type { GameState } from '../engine/types'
import * as fs from 'fs'
import * as path from 'path'

// ─── Bot types ────────────────────────────────────────────────────────────────

type BotStrategy = 'wood' | 'olive' | 'passive' | 'random'

// ─── Player bots ─────────────────────────────────────────────────────────────

function runBotPassive(state: GameState): GameState {
  let s = state
  // Sell everything immediately for gold
  const wood = s.player.inventory['wood'] ?? 0
  if (wood > 1) s = sellToMarket(s, 'wood', wood - 1)
  const olive = s.player.inventory['olive'] ?? 0
  if (olive > 0) s = sellToMarket(s, 'olive', olive)
  const meuble = s.player.inventory['meuble'] ?? 0
  if (meuble > 0) s = sellToMarket(s, 'meuble', meuble)
  const huile = s.player.inventory['huile'] ?? 0
  if (huile > 0) s = sellToMarket(s, 'huile', huile)
  return s
}

function runBotWood(state: GameState): GameState {
  let s = state
  const wood = s.player.inventory['wood'] ?? 0
  const hasSawmill = s.player.buildings.some(b => b.defId === 'sawmill')
  const hasMenuiserie = s.player.buildings.some(b => b.defId === 'menuiserie')

  // Phase 0: accumulate 10 wood
  if (!hasSawmill) {
    const woodMkt = s.market.resources['wood']
    // Sell when price > equilibrium * 1.05, buy when < equilibrium * 0.9
    if (wood >= 1 && woodMkt.currentPrice > woodMkt.equilibriumPrice * 1.05) {
      s = sellToMarket(s, 'wood', Math.floor(wood * 0.7))
    }
    if (s.player.gold > 5 && woodMkt.currentPrice < woodMkt.equilibriumPrice * 0.92) {
      const qty = Math.min(5, woodMkt.volumeAvailable, Math.floor(s.player.gold / woodMkt.currentPrice))
      if (qty > 0) s = buyFromMarket(s, 'wood', qty)
    }
    if ((s.player.inventory['wood'] ?? 0) >= 10) {
      s = buyBuilding(s, 'sawmill')
    }
    return s
  }

  // Phase 1: accumulate 80 wood for menuiserie
  if (!hasMenuiserie) {
    const woodMkt = s.market.resources['wood']
    if (wood >= 80) {
      s = buyBuilding(s, 'menuiserie')
    } else if (wood > 20 && woodMkt.currentPrice > woodMkt.equilibriumPrice * 1.15) {
      s = sellToMarket(s, 'wood', Math.floor(wood * 0.4))
    }
    return s
  }

  // Phase 2: sell meubles, accumulate gold for auberge
  const meuble = s.player.inventory['meuble'] ?? 0
  const meubleMkt = s.market.resources['meuble']
  if (meuble > 2 && meubleMkt.currentPrice > meubleMkt.equilibriumPrice * 0.95) {
    s = sellToMarket(s, 'meuble', Math.floor(meuble * 0.6))
  }

  // Try to build auberge
  const hasAuberge = s.player.buildings.some(b => b.defId === 'auberge')
  if (!hasAuberge && s.player.gold >= 40 && (s.player.inventory['wood'] ?? 0) >= 20 && (s.player.inventory['huile'] ?? 0) >= 10) {
    s = buyBuilding(s, 'auberge')
  }

  return s
}

function runBotOlive(state: GameState): GameState {
  let s = state
  const wood = s.player.inventory['wood'] ?? 0
  const olive = s.player.inventory['olive'] ?? 0
  const hasOlivery = s.player.buildings.some(b => b.defId === 'olivery')
  const hasPress = s.player.buildings.some(b => b.defId === 'press')

  // Sell initial wood for gold
  if (wood > 1 && !s.player.buildings.some(b => b.defId === 'sawmill')) {
    s = sellToMarket(s, 'wood', wood - 1)
  }

  // Phase 1: buy olivery
  if (!hasOlivery && s.player.gold >= 10) {
    s = buyBuilding(s, 'olivery')
    return s
  }

  // Phase 2: accumulate 80 olives for press
  if (hasOlivery && !hasPress) {
    const oliveMkt = s.market.resources['olive']
    if (olive >= 80) {
      s = buyBuilding(s, 'press')
    } else if (olive > 20 && oliveMkt.currentPrice > oliveMkt.equilibriumPrice * 1.15) {
      s = sellToMarket(s, 'olive', Math.floor(olive * 0.4))
    } else if (olive < 40 && s.player.gold > 15 && oliveMkt.currentPrice < oliveMkt.equilibriumPrice * 0.95) {
      const qty = Math.min(20, oliveMkt.volumeAvailable, Math.floor(s.player.gold * 0.3))
      if (qty > 0) s = buyFromMarket(s, 'olive', qty)
    }
    return s
  }

  // Phase 3: sell huile, build auberge
  const huile = s.player.inventory['huile'] ?? 0
  const huileMkt = s.market.resources['huile']
  if (huile > 2 && huileMkt.currentPrice > huileMkt.equilibriumPrice * 0.95) {
    s = sellToMarket(s, 'huile', Math.floor(huile * 0.6))
  }

  const hasAuberge = s.player.buildings.some(b => b.defId === 'auberge')
  if (!hasAuberge && s.player.gold >= 40 && (s.player.inventory['wood'] ?? 0) >= 20 && huile >= 10) {
    s = buyBuilding(s, 'auberge')
  }

  return s
}

function runBot(state: GameState, strategy: BotStrategy): GameState {
  if (strategy === 'passive') return runBotPassive(state)
  if (strategy === 'olive')   return runBotOlive(state)
  if (strategy === 'random') {
    const pick = Math.random() < 0.5 ? 'wood' : 'olive'
    return pick === 'wood' ? runBotWood(state) : runBotOlive(state)
  }
  return runBotWood(state)
}

// ─── Single game ──────────────────────────────────────────────────────────────

interface GameResult {
  winner: string
  days: number
  playerGold: number
  playerNetWorth: number
  briceNetWorth: number
  raphNetWorth: number
  playerBuildings: string[]
  briceBuildings: string[]
  raphBuildings: string[]
  woodPriceAvg: number
  olivePriceAvg: number
  strategy: BotStrategy
}

export function runGame(strategy: BotStrategy = 'wood'): GameResult {
  const maxDays = 62
  let state = initGame()
  // Skip Phase 0 tutorial (tick-based, not simulable headless) — start with 10 wood
  state = { ...state, player: { ...state.player, inventory: { ...state.player.inventory, wood: 10 } } }

  while (state.phase === 'playing' && state.day < maxDays) {
    state = runBot(state, strategy)
    state = resolveEndOfDay(state)
  }

  const woodPrices  = state.market.resources['wood'].priceHistory.map(p => p.price)
  const olivePrices = state.market.resources['olive'].priceHistory.map(p => p.price)

  const playerNW = state.player.netWorthHistory.at(-1)?.value ?? state.player.gold
  const brice    = state.rivals.find(r => r.id === 'brice')!
  const raph     = state.rivals.find(r => r.id === 'raph')!
  const briceNW  = brice.netWorthHistory.at(-1)?.value ?? brice.gold
  const raphNW   = raph.netWorthHistory.at(-1)?.value ?? raph.gold

  const allWealths = [
    { id: 'Nun',   nw: playerNW },
    { id: 'Brice', nw: briceNW },
    { id: 'Raph',  nw: raphNW },
  ]
  const winner = state.phase === 'won' ? 'Nun'
    : state.phase === 'lost' ? allWealths.sort((a, b) => b.nw - a.nw)[0].id
    : allWealths.sort((a, b) => b.nw - a.nw)[0].id

  return {
    winner,
    days: state.day,
    playerGold: state.player.gold,
    playerNetWorth: playerNW,
    briceNetWorth: briceNW,
    raphNetWorth: raphNW,
    playerBuildings: state.player.buildings.map(b => b.defId),
    briceBuildings:  brice.buildings.map(b => b.defId),
    raphBuildings:   raph.buildings.map(b => b.defId),
    woodPriceAvg:  woodPrices.reduce((a, b) => a + b, 0) / Math.max(woodPrices.length, 1),
    olivePriceAvg: olivePrices.reduce((a, b) => a + b, 0) / Math.max(olivePrices.length, 1),
    strategy,
  }
}

// ─── Batch ────────────────────────────────────────────────────────────────────

interface BatchReport {
  games:         number
  strategy:      BotStrategy
  nunWins:       number
  briceWins:     number
  raphWins:      number
  avgDays:       number
  avgPlayerNW:   number
  avgBriceNW:    number
  avgRaphNW:     number
  avgWoodPrice:  number
  avgOlivePrice: number
  playerBldFreq: Record<string, number>
  briceBldFreq:  Record<string, number>
  raphBldFreq:   Record<string, number>
  warnings:      string[]
}

export function runBatch(n: number, strategy: BotStrategy = 'wood'): BatchReport {
  const results: GameResult[] = []
  for (let i = 0; i < n; i++) results.push(runGame(strategy))

  const nunWins   = results.filter(r => r.winner === 'Nun').length
  const briceWins = results.filter(r => r.winner === 'Brice').length
  const raphWins  = results.filter(r => r.winner === 'Raph').length
  const avgDays   = results.reduce((a, r) => a + r.days, 0) / n

  function bldFreq(getter: (r: GameResult) => string[]) {
    const freq: Record<string, number> = {}
    for (const r of results) {
      for (const b of getter(r)) freq[b] = (freq[b] ?? 0) + 1
    }
    return Object.fromEntries(Object.entries(freq).sort((a, b) => b[1] - a[1]))
  }

  const warnings: string[] = []
  if (nunWins / n < 0.15) warnings.push(`⚠  Nun wins only ${(nunWins/n*100).toFixed(0)}% — may be too hard`)
  if (nunWins / n > 0.70) warnings.push(`⚠  Nun wins ${(nunWins/n*100).toFixed(0)}% — may be too easy`)
  if (raphWins / n > 0.60) warnings.push(`⚠  Raph dominates (${(raphWins/n*100).toFixed(0)}%) — huile filière OP`)
  if (briceWins / n > 0.60) warnings.push(`⚠  Brice dominates (${(briceWins/n*100).toFixed(0)}%) — wood filière OP`)
  if (avgDays < 20) warnings.push(`⚠  Avg ${avgDays.toFixed(1)} days — games end too fast`)
  if (avgDays > 58) warnings.push(`⚠  Avg ${avgDays.toFixed(1)} days — games drag too long`)

  return {
    games: n, strategy,
    nunWins, briceWins, raphWins,
    avgDays,
    avgPlayerNW:   results.reduce((a, r) => a + r.playerNetWorth, 0) / n,
    avgBriceNW:    results.reduce((a, r) => a + r.briceNetWorth,  0) / n,
    avgRaphNW:     results.reduce((a, r) => a + r.raphNetWorth,   0) / n,
    avgWoodPrice:  results.reduce((a, r) => a + r.woodPriceAvg,   0) / n,
    avgOlivePrice: results.reduce((a, r) => a + r.olivePriceAvg,  0) / n,
    playerBldFreq: bldFreq(r => r.playerBuildings),
    briceBldFreq:  bldFreq(r => r.briceBuildings),
    raphBldFreq:   bldFreq(r => r.raphBuildings),
    warnings,
  }
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('simulate.ts') || process.argv[1]?.endsWith('simulate.js')) {
  const args = process.argv.slice(2)
  const n = parseInt(args.find(a => a.startsWith('--games='))?.split('=')[1] ?? '1')
  const strategy = (args.find(a => a.startsWith('--bot='))?.split('=')[1] ?? 'wood') as BotStrategy

  if (n === 1) {
    console.log(`\n🎮  Single game — bot:${strategy}\n`)
    const r = runGame(strategy)
    console.log(`Winner : ${r.winner} (${r.days} jours)`)
    console.log(`Nun    : ${r.playerNetWorth.toFixed(0)}or net  (gold: ${r.playerGold.toFixed(0)})  [${r.playerBuildings.join(', ') || 'aucun'}]`)
    console.log(`Brice  : ${r.briceNetWorth.toFixed(0)}or net  [${r.briceBuildings.join(', ') || 'aucun'}]`)
    console.log(`Raph   : ${r.raphNetWorth.toFixed(0)}or net  [${r.raphBuildings.join(', ') || 'aucun'}]`)
    console.log(`Prix moyen bois: ${r.woodPriceAvg.toFixed(2)}or  olives: ${r.olivePriceAvg.toFixed(2)}or`)
  } else {
    console.log(`\n📊  Batch ${n} parties — bot:${strategy}\n`)
    const s = runBatch(n, strategy)
    const pct = (v: number) => `${(v/n*100).toFixed(0)}%`

    console.log(`Victoires  Nun:${s.nunWins}(${pct(s.nunWins)})  Brice:${s.briceWins}(${pct(s.briceWins)})  Raph:${s.raphWins}(${pct(s.raphWins)})`)
    console.log(`Durée moy  ${s.avgDays.toFixed(1)} jours`)
    console.log(`Richesse   Nun:${s.avgPlayerNW.toFixed(0)}  Brice:${s.avgBriceNW.toFixed(0)}  Raph:${s.avgRaphNW.toFixed(0)}`)
    console.log(`Prix moy   bois:${s.avgWoodPrice.toFixed(2)}  olives:${s.avgOlivePrice.toFixed(2)}`)
    console.log(`\nBâtiments Nun  :`, s.playerBldFreq)
    console.log(`Bâtiments Brice:`, s.briceBldFreq)
    console.log(`Bâtiments Raph :`, s.raphBldFreq)

    if (s.warnings.length) {
      console.log('\n' + s.warnings.join('\n'))
    } else {
      console.log('\n✓  Balance OK')
    }

    const outDir = 'sim-results'
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)
    const filename = path.join(outDir, `batch-${strategy}-${Date.now()}.json`)
    fs.writeFileSync(filename, JSON.stringify(s, null, 2))
    console.log(`\nRésultats → ${filename}`)
  }
}
