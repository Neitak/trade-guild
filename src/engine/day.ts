import type { GameState, GameEvent, ResourceId, WonderId, OwnedBuilding, ActiveRumor } from './types'
import { produceResources } from './buildings'
import { recoverPrices } from './market'
import { runRivalAI } from './ai'
import { generateRumors, revealDueRumors } from './rumors'
import buildingDefs from '../data/buildings.json'

// ─── End of day resolution ────────────────────────────────────────────────────

export function resolveEndOfDay(state: GameState): GameState {
  if (state.phase !== 'playing') return state

  let s = { ...state, day: state.day + 1 }

  // 1. Reveal any pending rumors due today
  s = revealDueRumors(s)

  // 2. Activate Raph when player buys sawmill (Phase 1 trigger)
  s = maybeActivateRaph(s)

  // 3. Produce resources from all buildings
  s = produceResources(s)

  // 3b. Degrade Tier 1 extractors
  s = degradeBuildings(s)

  // 4. Run all rivals AI
  for (const rival of s.rivals) {
    s = runRivalAI(s, rival.id)
  }

  // 5. Queue new rumors from rival actions
  s = generateRumors(s)

  // 6. Unlock new map nodes narratively
  s = unlockNodes(s)

  // 7. Price recovery + daily snapshot
  s = { ...s, market: recoverPrices(s) }
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
      briceGold: s.rivals.find(r => r.id === 'brice')?.gold ?? 0,
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
  const prices = Object.fromEntries(
    Object.entries(state.market.resources).map(([id, r]) => [id, r.currentPrice])
  ) as Partial<Record<ResourceId, number>>

  function worth(g: { gold: number; inventory: Partial<Record<ResourceId, number>> }): number {
    return g.gold + Object.entries(g.inventory).reduce((sum, [id, qty]) =>
      sum + (qty ?? 0) * (prices[id as ResourceId] ?? 0), 0
    )
  }

  const updatedRivals = state.rivals.map(r => ({
    ...r,
    netWorthHistory: [...r.netWorthHistory, { day: state.day, value: Math.round(worth(r)) }],
  }))

  return {
    ...state,
    player: {
      ...state.player,
      netWorthHistory: [...state.player.netWorthHistory, { day: state.day, value: Math.round(worth(state.player)) }],
    },
    rivals: updatedRivals,
  }
}

function checkGameOver(state: GameState): GameState {
  const playerWorth = state.player.netWorthHistory.at(-1)?.value ?? 0
  const bestRival   = Math.max(...state.rivals.map(r => r.netWorthHistory.at(-1)?.value ?? 0))

  // Early win: auberge T5 + clear lead (Immobilier domination)
  const aubergeT5 = state.player.buildings.some(b => b.defId === 'auberge' && (b.level ?? 1) >= 5)
  if (aubergeT5 && playerWorth > bestRival * 1.3) {
    return { ...state, phase: 'won' }
  }

  // Day 60 limit — richesse nette
  if (state.day >= 60) {
    return { ...state, phase: playerWorth >= bestRival ? 'won' : 'lost' }
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
      if (!def?.productionPerDay) return b
      const current = b.degradation ?? 0
      if (current >= MAX_DEGRADATION) return b
      return { ...b, degradation: parseFloat(Math.min(MAX_DEGRADATION, current + DEGRADE_PER_DAY).toFixed(4)) }
    })
  }

  return {
    ...state,
    player:  { ...state.player, buildings: applyDegradation(state.player.buildings) },
    rivals:  state.rivals.map(r => ({ ...r, buildings: applyDegradation(r.buildings) })),
  }
}

// ─── Raph activation (Phase 1 trigger) ───────────────────────────────────────

function maybeActivateRaph(state: GameState): GameState {
  if (state.rivalStrategies['raph']) return state   // already active
  if (!state.player.buildings.some(b => b.defId === 'sawmill')) return state

  return {
    ...state,
    rivalStrategies: {
      ...state.rivalStrategies,
      raph: { preferredResource: 'pierre' },
    },
    activeRumors: [
      ...state.activeRumors,
      { day: state.day, text: `📍 Raph arrive en ville avec 60 pièces d'or et un œil sur la Carrière du Vallon.` },
    ],
    log: [
      ...state.log,
      { day: state.day, actor: 'system' as const, type: 'RIVAL_JOINED' as const, payload: { guildId: 'raph' } },
    ],
  }
}


// ─── Apparition narrative des nouveaux emplacements ──────────────────────────

function unlockNodes(state: GameState): GameState {
  const allBuildings = [...state.player.buildings, ...state.rivals.flatMap(r => r.buildings)]
  const raphActive = !!state.rivalStrategies['raph']

  const UNLOCK_CONDITIONS: Record<string, { condition: () => boolean; message: string }> = {
    // Apple filière
    orchard_slot_1: {
      condition: () => state.day >= 5,
      message: `Des cultivateurs arrivent en ville — le Verger du Vallon est disponible.`,
    },
    orchard_slot_2: {
      condition: () => allBuildings.some(b => b.defId === 'orchard'),
      message: `L'économie s'anime — le Verger des Collines est désormais accessible.`,
    },
    market_slot_1: {
      condition: () => allBuildings.some(b => b.defId === 'orchard'),
      message: `Un premier verger en activité — la Place du Marché s'anime.`,
    },
    market_slot_2: {
      condition: () => allBuildings.some(b => b.defId === 'fruit_market'),
      message: `Le commerce des fruits prospère — le Carrefour Nord ouvre ses portes.`,
    },
    // Wood filière — scierie_slot_2 unlocked immediately in ai.ts when sawmill bought
    menuiserie_slot_2: {
      condition: () => allBuildings.some(b => b.defId === 'menuiserie'),
      message: `L'artisanat du bois attire de nouveaux maîtres — la Grande Menuiserie ouvre ses portes.`,
    },
    // Pierre filière (Raph)
    carriere_slot_1: {
      condition: () => raphActive,
      message: `Raph lance les travaux — la Carrière du Vallon est ouverte à la concurrence.`,
    },
    carriere_slot_2: {
      condition: () => allBuildings.some(b => b.defId === 'carriere'),
      message: `L'extraction de pierre s'intensifie — la Carrière du Nord est disponible.`,
    },
    // Artisanale — Charpenterie unlocks once player has menuiserie
    charpenterie_slot_1: {
      condition: () => state.player.buildings.some(b => b.defId === 'menuiserie'),
      message: `Votre Menuiserie est construite — l'Atelier Charron cherche un acquéreur dans la zone artisanale.`,
    },
    // Capitale — Auberge du Carrefour (Phase 3)
    auberge_slot_1: {
      condition: () => state.player.buildings.some(b => b.defId === 'menuiserie'),
      message: `La Capitale s'anime — l'Auberge du Carrefour cherche un propriétaire (40 or + 20 bois + 10 pierre).`,
    },
    // 2ème Auberge — dès que quelqu'un en possède une
    auberge_slot_2: {
      condition: () => allBuildings.some(b => b.defId === 'auberge'),
      message: `L'immobilier est en plein essor — la Grande Auberge est désormais disponible.`,
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
