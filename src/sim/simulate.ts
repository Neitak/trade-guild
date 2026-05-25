#!/usr/bin/env npx tsx
import { initGame } from '../engine/init'
import { resolveEndOfDay, contributeToWonder } from '../engine/day'
import { buyBuilding } from '../engine/buildings'
import { sellToMarket } from '../engine/market'
import { buyShare } from '../engine/shares'
import { generateChronicle } from '../engine/chronicle'
import type { GameState, SimConfig, SimResult, BatchStats } from '../engine/types'
import * as fs from 'fs'
import * as path from 'path'

// ─── Player bot — baseline: contribute surplus to wonder ─────────────────────

function runPlayerBot(state: GameState): GameState {
  let s = state
  const hasOrchard = s.player.buildings.some(b => b.defId === 'orchard')

  // Phase 1: buy orchard
  if (!hasOrchard) {
    const apples = s.player.inventory['apple'] ?? 0
    if (apples > 0) s = sellToMarket(s, 'apple', apples)
    s = buyBuilding(s, 'orchard')
    return s
  }

  // Phase 2: contribute surplus to wonder (keep 20 as buffer)
  const playerApples = s.player.inventory['apple'] ?? 0
  const wonderNeeded = (s.wonder.requiredResources['apple'] ?? 0) - (s.wonder.playerContributed['apple'] ?? 0)
  if (wonderNeeded > 0 && playerApples > 20) {
    const contribute = Math.min(playerApples - 20, wonderNeeded)
    if (contribute > 0) s = contributeToWonder(s, contribute)
  }

  return s
}

// ─── Single game simulation ───────────────────────────────────────────────────

export function runGame(config: SimConfig = {}): SimResult {
  const maxDays = config.maxDays ?? 60
  let state = initGame()


  while (state.phase === 'playing' && state.day < maxDays) {
    // Player bot acts before end-of-day resolution
    state = runPlayerBot(state)
    state = resolveEndOfDay(state)
  }

  const chronicle = generateChronicle(state)
  const priceHistory = state.market.resources['apple'].priceHistory
  const prices = priceHistory.map(p => p.price)

  const playerWorth = state.player.netWorthHistory.at(-1)?.value ?? 0
  const texWorth = state.tex.netWorthHistory.at(-1)?.value ?? 0
  return {
    winner: state.wonder.completedBy ?? (playerWorth >= texWorth ? 'player' : 'tex'),
    days: state.day,
    playerFinalGold: state.player.gold,
    texFinalGold: state.tex.gold,
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    priceAvg: prices.reduce((a, b) => a + b, 0) / prices.length,
    archetype: chronicle.archetype,
    log: state.log,
  }
}

// ─── Batch simulation ─────────────────────────────────────────────────────────

export function runBatch(n: number, config: SimConfig = {}): BatchStats {
  const results: SimResult[] = []
  for (let i = 0; i < n; i++) {
    results.push(runGame(config))
  }

  const playerWins = results.filter(r => r.winner === 'player').length
  const texWins = results.filter(r => r.winner === 'tex').length
  const draws = results.filter(r => r.winner === 'draw').length
  const avgDays = results.reduce((a, r) => a + r.days, 0) / n
  const avgPriceMin = results.reduce((a, r) => a + r.priceMin, 0) / n
  const avgPriceMax = results.reduce((a, r) => a + r.priceMax, 0) / n
  const archetypes: Record<string, number> = {}
  for (const r of results) {
    archetypes[r.archetype] = (archetypes[r.archetype] ?? 0) + 1
  }
  const outOfSpec = results.filter(r => r.days < 20 || r.days > 60).length

  return { games: n, playerWins, texWins, draws, avgDays, avgPriceMin, avgPriceMax, archetypes, outOfSpec }
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('simulate.ts')) {
  const args = process.argv.slice(2)
  const gamesArg = args.find(a => a.startsWith('--games='))
  const n = gamesArg ? parseInt(gamesArg.split('=')[1]) : 1

  if (n === 1) {
    console.log('\n🎮 Running single game simulation...\n')
    const result = runGame()
    console.log(`Winner: ${result.winner}`)
    console.log(`Days: ${result.days}`)
    console.log(`Player gold: ${result.playerFinalGold.toFixed(0)}`)
    console.log(`Tex gold: ${result.texFinalGold.toFixed(0)}`)
    console.log(`Apple price range: ${result.priceMin.toFixed(2)} – ${result.priceMax.toFixed(2)} (avg ${result.priceAvg.toFixed(2)})`)
    console.log(`Archetype: ${result.archetype}`)
    console.log(`Log events: ${result.log.length}`)

    // Save full log
    const outDir = 'sim-results'
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)
    const filename = path.join(outDir, `game-${Date.now()}.json`)
    fs.writeFileSync(filename, JSON.stringify(result, null, 2))
    console.log(`\nFull log saved to ${filename}`)
  } else {
    console.log(`\n📊 Running batch of ${n} games...\n`)
    const stats = runBatch(n)
    console.log(`Games: ${stats.games}`)
    console.log(`Player wins: ${stats.playerWins} (${((stats.playerWins / n) * 100).toFixed(0)}%)`)
    console.log(`Tex wins: ${stats.texWins} (${((stats.texWins / n) * 100).toFixed(0)}%)`)
    console.log(`Avg days: ${stats.avgDays.toFixed(1)}`)
    console.log(`Price range avg: ${stats.avgPriceMin.toFixed(2)} – ${stats.avgPriceMax.toFixed(2)}`)
    console.log(`Archetypes:`, stats.archetypes)
    console.log(`Out of spec (<20 or >60 days): ${stats.outOfSpec}`)

    if (stats.outOfSpec > n * 0.2) {
      console.warn('\n⚠️  MORE THAN 20% OF GAMES OUT OF SPEC — balance needs tuning')
    }
    if (stats.avgDays < 20 || stats.avgDays > 60) {
      console.warn(`\n⚠️  AVG GAME LENGTH ${stats.avgDays.toFixed(1)} days — target is 30-45`)
    }

    const outDir = 'sim-results'
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)
    const filename = path.join(outDir, `batch-${Date.now()}.json`)
    fs.writeFileSync(filename, JSON.stringify(stats, null, 2))
    console.log(`\nBatch stats saved to ${filename}`)
  }
}
