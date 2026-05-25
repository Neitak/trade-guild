import type { GameState, GameEvent } from './types'
import { produceResources } from './buildings'
import { recoverPrices } from './market'
import { runTexAI } from './ai'
import { generateRumors, revealDueRumors } from './rumors'

// ─── End of day resolution ────────────────────────────────────────────────────

export function resolveEndOfDay(state: GameState): GameState {
  if (state.phase !== 'playing') return state

  let s = { ...state, day: state.day + 1 }

  // 1. Reveal any pending rumors due today
  s = revealDueRumors(s)

  // 2. Produce resources from all buildings
  s = produceResources(s)

  // 3. Run Tex AI (buys, sells, builds, contributes to wonder)
  s = runTexAI(s)

  // 4. Queue new rumors based on what Tex did today
  s = generateRumors(s)

  // 5. Price recovery + daily snapshot for the price chart
  s = { ...s, market: recoverPrices(s.market, s.day) }
  s = recordDailyPriceSnapshot(s)

  // 6. Update net worth histories
  s = updateNetWorth(s)

  // 7. Check win/loss conditions
  s = checkGameOver(s)

  // 8. End-of-day event marker
  const endEvent: GameEvent = {
    day: s.day,
    actor: 'system',
    type: 'END_DAY',
    payload: {
      playerGold: s.player.gold,
      texGold: s.tex.gold,
      applePrice: s.market.resources['apple'].currentPrice,
    },
  }

  return { ...s, log: [...s.log, endEvent] }
}

// ─── Player contributes to the wonder ────────────────────────────────────────

export function contributeToWonder(state: GameState, apples: number): GameState {
  const currentContrib = state.wonder.playerContributed['apple'] ?? 0
  const required = state.wonder.requiredResources['apple'] ?? 0
  const playerApples = state.player.inventory['apple'] ?? 0

  const actual = Math.min(apples, playerApples, required - currentContrib)
  if (actual <= 0) return state

  const newContrib = currentContrib + actual
  const complete = newContrib >= required

  const event: GameEvent = {
    day: state.day,
    actor: 'player',
    type: complete ? 'WONDER_COMPLETE' : 'WONDER_PROGRESS',
    payload: { contributed: actual, total: newContrib, required },
  }

  return {
    ...state,
    player: {
      ...state.player,
      inventory: {
        ...state.player.inventory,
        apple: playerApples - actual,
      },
    },
    wonder: {
      ...state.wonder,
      playerContributed: { apple: newContrib },
      complete,
      completedBy: complete ? 'player' : undefined,
      completedOnDay: complete ? state.day : undefined,
    },
    log: [...state.log, event],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recordDailyPriceSnapshot(state: GameState): GameState {
  const appleMarket = state.market.resources['apple']
  const lastEntry = appleMarket.priceHistory.at(-1)
  if (lastEntry?.day === state.day) return state // already recorded this day
  return {
    ...state,
    market: {
      resources: {
        ...state.market.resources,
        apple: {
          ...appleMarket,
          priceHistory: [
            ...appleMarket.priceHistory,
            { day: state.day, price: parseFloat(appleMarket.currentPrice.toFixed(4)) },
          ],
        },
      },
    },
  }
}

function updateNetWorth(state: GameState): GameState {
  const playerWorth = state.player.gold + (state.player.inventory['apple'] ?? 0) * state.market.resources['apple'].currentPrice
  const texWorth = state.tex.gold + (state.tex.inventory['apple'] ?? 0) * state.market.resources['apple'].currentPrice

  return {
    ...state,
    player: {
      ...state.player,
      netWorthHistory: [...state.player.netWorthHistory, { day: state.day, value: Math.round(playerWorth) }],
    },
    tex: {
      ...state.tex,
      netWorthHistory: [...state.tex.netWorthHistory, { day: state.day, value: Math.round(texWorth) }],
    },
  }
}

function checkGameOver(state: GameState): GameState {
  // Check if either guild just completed the wonder this turn
  const required = state.wonder.requiredResources['apple'] ?? 0
  const playerDone = (state.wonder.playerContributed['apple'] ?? 0) >= required
  const texDone = (state.wonder.texContributed['apple'] ?? 0) >= required

  if (playerDone && !state.wonder.complete) {
    return { ...state, phase: 'won', wonder: { ...state.wonder, complete: true, completedBy: 'player', completedOnDay: state.day } }
  }
  if (texDone && !state.wonder.complete) {
    return { ...state, phase: 'lost', wonder: { ...state.wonder, complete: true, completedBy: 'tex', completedOnDay: state.day } }
  }
  if (state.wonder.complete) {
    const phase = state.wonder.completedBy === 'player' ? 'won' : 'lost'
    return { ...state, phase }
  }
  if (state.day >= 60) {
    const playerWorth = state.player.netWorthHistory.at(-1)?.value ?? 0
    const texWorth = state.tex.netWorthHistory.at(-1)?.value ?? 0
    return { ...state, phase: playerWorth >= texWorth ? 'won' : 'lost' }
  }
  return state
}
