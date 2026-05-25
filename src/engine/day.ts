import type { GameState, GameEvent, ResourceId, WonderId, OwnedBuilding, ActiveRumor } from './types'
import { produceResources } from './buildings'
import { recoverPrices } from './market'
import { runTexAI } from './ai'
import { generateRumors, revealDueRumors } from './rumors'
import buildingDefs from '../data/buildings.json'

// ─── End of day resolution ────────────────────────────────────────────────────

export function resolveEndOfDay(state: GameState): GameState {
  if (state.phase !== 'playing') return state

  let s = { ...state, day: state.day + 1 }

  // 1. Reveal any pending rumors due today
  s = revealDueRumors(s)

  // 2. Produce resources from all buildings
  s = produceResources(s)

  // 2b. Degrade Tier 1 extractors (progressive slowdown)
  s = degradeBuildings(s)

  // 3. Run Tex AI (buys, sells, builds, contributes to wonder)
  s = runTexAI(s)

  // 4. Queue new rumors based on what Tex did today
  s = generateRumors(s)

  // 5. Unlock nodes narratively (new slots when economy develops)
  s = unlockNodes(s)

  // 6. Price recovery + daily snapshot for all resource charts
  s = { ...s, market: recoverPrices(s.market, s.day) }
  s = recordDailyPriceSnapshot(s)

  // 7. Update net worth histories
  s = updateNetWorth(s)

  // 8. Check win/loss conditions
  s = checkGameOver(s)

  // 9. End-of-day event marker
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

// ─── Dégradation douce des extracteurs Tier 1 ────────────────────────────────
// Production perd ~0.5%/jour. Plafond 40%. Un verger à jour 30 tourne à ~85%.

function degradeBuildings(state: GameState): GameState {
  const DEGRADE_PER_DAY = 0.005
  const MAX_DEGRADATION = 0.40
  const defsMap: Record<string, any> = Object.fromEntries(
    (buildingDefs as any[]).map(d => [d.id, d])
  )

  function applyDegradation(buildings: OwnedBuilding[]): OwnedBuilding[] {
    return buildings.map(b => {
      const def = defsMap[b.defId]
      if (!def?.productionPerDay) return b  // skip Tier 2 (no resource production)
      const current = b.degradation ?? 0
      if (current >= MAX_DEGRADATION) return b
      return { ...b, degradation: parseFloat(Math.min(MAX_DEGRADATION, current + DEGRADE_PER_DAY).toFixed(4)) }
    })
  }

  return {
    ...state,
    player: { ...state.player, buildings: applyDegradation(state.player.buildings) },
    tex:    { ...state.tex,    buildings: applyDegradation(state.tex.buildings) },
  }
}

// ─── Apparition narrative des nouveaux emplacements ──────────────────────────
// Les slot_2 se débloquent quand l'économie le justifie.

function unlockNodes(state: GameState): GameState {
  const allBuildings = [...state.player.buildings, ...state.tex.buildings]

  const UNLOCK_CONDITIONS: Record<string, { condition: () => boolean; message: string }> = {
    orchard_slot_2: {
      condition: () => state.day >= 8 && allBuildings.some(b => b.defId === 'orchard'),
      message: `L'économie s'anime — de nouveaux cultivateurs arrivent au Verger des Collines.`,
    },
    scierie_slot_2: {
      condition: () => state.day >= 8 && allBuildings.some(b => b.defId === 'sawmill'),
      message: `Les bûcherons affluent en ville — la Scierie des Hauteurs est désormais disponible.`,
    },
    market_slot_2: {
      condition: () => allBuildings.some(b => b.defId === 'fruit_market'),
      message: `Le commerce des fruits prospère — un nouveau carrefour marchand s'ouvre au Carrefour Nord.`,
    },
    menuiserie_slot_2: {
      condition: () => allBuildings.some(b => b.defId === 'menuiserie'),
      message: `L'artisanat du bois attire de nouveaux maîtres — la Grande Menuiserie ouvre ses portes.`,
    },
  }

  const newRumors: ActiveRumor[] = []
  const updatedNodes = state.map.nodes.map(node => {
    if (!node.locked) return node
    const cond = UNLOCK_CONDITIONS[node.id]
    if (!cond || !cond.condition()) return node
    newRumors.push({ day: state.day, text: `📍 ${cond.message}` })
    return { ...node, locked: false }
  })

  if (newRumors.length === 0) return state

  return {
    ...state,
    map: { nodes: updatedNodes },
    activeRumors: [...state.activeRumors, ...newRumors],
    log: [
      ...state.log,
      ...newRumors.map(r => ({
        day: state.day,
        actor: 'system' as const,
        type: 'NODE_UNLOCKED' as const,
        payload: { message: r.text },
      })),
    ],
  }
}
