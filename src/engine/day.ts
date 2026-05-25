import type { GameState, GameEvent, ResourceId, WonderId } from './types'
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

  // 5. Price recovery + daily snapshot for all resource charts
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
      woodPrice: s.market.resources['wood'].currentPrice,
    },
  }

  return { ...s, log: [...s.log, endEvent] }
}

// ─── Player contributes to a specific wonder ──────────────────────────────────

export function contributeToWonder(state: GameState, qty: number, wonderId: WonderId): GameState {
  const wonderIdx = state.wonders.findIndex(w => w.id === wonderId)
  if (wonderIdx === -1) return state
  const wonder = state.wonders[wonderIdx]
  if (wonder.complete) return state

  // Derive which resource this wonder consumes
  const resourceId = Object.keys(wonder.requiredResources)[0] as ResourceId
  const required = wonder.requiredResources[resourceId] ?? 0
  const currentContrib = wonder.playerContributed[resourceId] ?? 0
  const playerHas = state.player.inventory[resourceId] ?? 0

  const actual = Math.min(qty, playerHas, required - currentContrib)
  if (actual <= 0) return state

  const newContrib = currentContrib + actual
  const complete = newContrib >= required

  const event: GameEvent = {
    day: state.day,
    actor: 'player',
    type: complete ? 'WONDER_COMPLETE' : 'WONDER_PROGRESS',
    payload: { wonderId, resourceId, contributed: actual, total: newContrib, required },
  }

  const updatedWonder = {
    ...wonder,
    playerContributed: { ...wonder.playerContributed, [resourceId]: newContrib },
    complete,
    completedBy: complete ? 'player' as const : undefined,
    completedOnDay: complete ? state.day : undefined,
  }

  return {
    ...state,
    player: {
      ...state.player,
      inventory: { ...state.player.inventory, [resourceId]: playerHas - actual },
    },
    wonders: state.wonders.map((w, i) => i === wonderIdx ? updatedWonder : w),
    log: [...state.log, event],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recordDailyPriceSnapshot(state: GameState): GameState {
  const resources = { ...state.market.resources }
  for (const id of Object.keys(resources) as ResourceId[]) {
    const r = resources[id]
    const lastEntry = r.priceHistory.at(-1)
    if (!lastEntry || lastEntry.day !== state.day) {
      resources[id] = {
        ...r,
        priceHistory: [...r.priceHistory, { day: state.day, price: parseFloat(r.currentPrice.toFixed(4)) }],
      }
    }
  }
  return { ...state, market: { resources } }
}

function updateNetWorth(state: GameState): GameState {
  const applePrice = state.market.resources['apple'].currentPrice
  const woodPrice  = state.market.resources['wood'].currentPrice

  const playerWorth = state.player.gold
    + (state.player.inventory['apple'] ?? 0) * applePrice
    + (state.player.inventory['wood']  ?? 0) * woodPrice

  const texWorth = state.tex.gold
    + (state.tex.inventory['apple'] ?? 0) * applePrice
    + (state.tex.inventory['wood']  ?? 0) * woodPrice

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
  for (const wonder of state.wonders) {
    const resourceId = Object.keys(wonder.requiredResources)[0] as ResourceId
    const required = wonder.requiredResources[resourceId] ?? 0
    const playerDone = (wonder.playerContributed[resourceId] ?? 0) >= required
    const texDone    = (wonder.texContributed[resourceId]    ?? 0) >= required

    if (playerDone && !wonder.complete) {
      const updated = state.wonders.map(w =>
        w.id === wonder.id ? { ...w, complete: true, completedBy: 'player' as const, completedOnDay: state.day } : w
      )
      return { ...state, phase: 'won', wonders: updated }
    }
    if (texDone && !wonder.complete) {
      const updated = state.wonders.map(w =>
        w.id === wonder.id ? { ...w, complete: true, completedBy: 'tex' as const, completedOnDay: state.day } : w
      )
      return { ...state, phase: 'lost', wonders: updated }
    }
    // Wonder was already marked complete (e.g. set by contributeToWonder during player action)
    if (wonder.complete) {
      return { ...state, phase: wonder.completedBy === 'player' ? 'won' : 'lost' }
    }
  }

  // Day limit fallback
  if (state.day >= 60) {
    const playerWorth = state.player.netWorthHistory.at(-1)?.value ?? 0
    const texWorth    = state.tex.netWorthHistory.at(-1)?.value ?? 0
    return { ...state, phase: playerWorth >= texWorth ? 'won' : 'lost' }
  }

  return state
}
