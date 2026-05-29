import type { GameState, GameEvent, ResourceId, MarketState, ResourceMarket, BuildingId, GuildId } from './types'
import { getRival, updateRival } from './types'

const PRODUCERS: Partial<Record<ResourceId, BuildingId[]>> = {
  wood:   ['sawmill'],
  olive:  ['olivery'],
  meuble: [],
  huile:  [],
}

function producerDefsFor(id: ResourceId): BuildingId[] {
  return PRODUCERS[id] ?? []
}

// ─── Phase 0 tutorial state machine ──────────────────────────────────────────
// Cycles sell→fall→buy→rise until the player holds 10 wood, then exits to normal.
// State is derived purely from the event log — no extra fields needed.

export type Phase0State = 'stable' | 'falling' | 'rising' | 'done'

export function getPhase0WoodState(state: GameState): Phase0State {
  if ((state.player.inventory['wood'] ?? 0) >= 10) return 'done'
  const sells = state.log.filter(
    e => e.actor === 'player' && e.type === 'SELL' && (e.payload as any)?.resourceId === 'wood'
  ).length
  const buys = state.log.filter(
    e => e.actor === 'player' && e.type === 'BUY' && (e.payload as any)?.resourceId === 'wood'
  ).length
  if (sells === 0)    return 'stable'
  if (sells > buys)   return 'falling'
  return 'rising'
}

// ─── Price mechanics ──────────────────────────────────────────────────────────

/**
 * Impact on price when selling qty units into a market with volumeAvailable.
 * Price drops proportionally to how much of the market you're flooding.
 */
function calcPriceAfterSell(market: ResourceMarket, qty: number): number {
  const impact = market.elasticityK * (qty / Math.max(market.volumeAvailable, 1))
  return Math.max(0.05, market.currentPrice * (1 - impact))
}

/**
 * Impact on price when buying qty units out of a market.
 * Price rises proportionally to scarcity created.
 */
function calcPriceAfterBuy(market: ResourceMarket, qty: number): number {
  const impact = market.elasticityK * (qty / Math.max(market.volumeAvailable, 1))
  return market.currentPrice * (1 + impact)
}

/**
 * Daily price recovery toward equilibrium + random walk noise.
 * Also adjusts equilibriumPrice based on extractor degradation (supply signal).
 */
// Phase 0 wood: caravan event pulls price down toward 1g for first 3 days
const PHASE0_WOOD_TARGET = 1.0
const PHASE0_RECOVERY_RATE = 0.45  // fast pull (vs 0.15 normal)

export function recoverPrices(state: GameState): MarketState {
  const allBuildings = [...state.player.buildings, ...state.rivals.flatMap(r => r.buildings)]
  const resources = { ...state.market.resources }

  for (const id of Object.keys(resources) as ResourceId[]) {
    const r = resources[id]

    // Degradation → supply signal
    const producerIds = producerDefsFor(id)
    const extractors  = allBuildings.filter(b => producerIds.includes(b.defId))
    const avgDegradation = extractors.length > 0
      ? extractors.reduce((sum, b) => sum + (b.degradation ?? 0), 0) / extractors.length
      : 0
    const newEquilibrium = r.baseEquilibriumPrice * (1 + avgDegradation)

    let recovered: number
    let biasFactor: number

    const phase0 = id === 'wood' ? getPhase0WoodState(state) : 'done'
    if (phase0 !== 'done') {
      if (phase0 === 'stable') {
        recovered  = r.currentPrice + (5.0 - r.currentPrice) * 0.15
        biasFactor = 0.50
      } else if (phase0 === 'falling') {
        recovered  = r.currentPrice + (PHASE0_WOOD_TARGET - r.currentPrice) * PHASE0_RECOVERY_RATE
        biasFactor = 0.72
      } else {  // rising
        recovered  = r.currentPrice + (4.5 - r.currentPrice) * 0.40
        biasFactor = 0.44
      }
    } else {
      // Normal: recover toward equilibrium (15%/day), slight upward drift
      recovered = r.currentPrice + (newEquilibrium - r.currentPrice) * 0.15
      biasFactor = 0.48
    }

    const noise     = (Math.random() - biasFactor) * r.volatility
    const withNoise = recovered * (1 + noise)

    // Clamp: 20% to 250% of baseEquilibriumPrice
    const clamped = Math.max(
      r.baseEquilibriumPrice * 0.20,
      Math.min(r.baseEquilibriumPrice * 2.50, withNoise)
    )

    resources[id] = {
      ...r,
      currentPrice:     Math.max(0.05, clamped),
      equilibriumPrice: newEquilibrium,
      volumeAvailable:  Math.min(r.volumeAvailable + 30, 300),
    }
  }
  return { resources }
}

// ─── Player actions ───────────────────────────────────────────────────────────

export function sellToMarket(
  state: GameState,
  resourceId: ResourceId,
  qty: number
): GameState {
  const resource = state.market.resources[resourceId]
  const available = state.player.inventory[resourceId] ?? 0
  const actualQty = Math.min(qty, available)
  if (actualQty <= 0) return state

  const newPrice = calcPriceAfterSell(resource, actualQty)
  const goldEarned = actualQty * resource.currentPrice

  const event: GameEvent = {
    day: state.day,
    actor: 'player',
    type: 'SELL',
    payload: { resourceId, qty: actualQty, price: resource.currentPrice, gold: goldEarned },
  }

  // Each Phase 0 sell (stable or rising → falling) triggers the caravan rumor
  const phase0 = resourceId === 'wood' ? getPhase0WoodState(state) : 'done'
  const isPhase0SellTrigger = phase0 === 'stable' || phase0 === 'rising'
  const newRumors = isPhase0SellTrigger
    ? [
        ...state.activeRumors.filter(r => !r.text.includes('caravane') && !r.text.includes('redresse')),
        { day: state.day, text: "⚠ Une grande caravane vient d'arriver en ville, chargée de bois. Le marché s'effondre." },
      ]
    : state.activeRumors

  return {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold + goldEarned,
      inventory: {
        ...state.player.inventory,
        [resourceId]: available - actualQty,
      },
    },
    market: {
      resources: {
        ...state.market.resources,
        [resourceId]: {
          ...resource,
          currentPrice: newPrice,
          volumeAvailable: resource.volumeAvailable + actualQty,
          priceHistory: [
            ...resource.priceHistory,
            { day: state.day, price: newPrice, marker: 'player' as const },
          ],
        },
      },
    },
    log: [...state.log, event],
    activeRumors: newRumors,
  }
}

export function buyFromMarket(
  state: GameState,
  resourceId: ResourceId,
  qty: number
): GameState {
  const resource = state.market.resources[resourceId]
  const actualQty = Math.min(qty, resource.volumeAvailable)
  const cost = actualQty * resource.currentPrice
  if (actualQty <= 0 || state.player.gold < cost) return state

  const newPrice = calcPriceAfterBuy(resource, actualQty)

  const event: GameEvent = {
    day: state.day,
    actor: 'player',
    type: 'BUY',
    payload: { resourceId, qty: actualQty, price: resource.currentPrice, cost },
  }

  const newWoodQty = (state.player.inventory[resourceId] ?? 0) + actualQty
  // First buy of each down-cycle transitions falling → rising
  const woodSells = state.log.filter(e => e.actor === 'player' && e.type === 'SELL' && (e.payload as any)?.resourceId === 'wood').length
  const woodBuys  = state.log.filter(e => e.actor === 'player' && e.type === 'BUY'  && (e.payload as any)?.resourceId === 'wood').length
  const isPhase0BuyTrigger = resourceId === 'wood'
    && woodSells === woodBuys + 1  // exactly one sell ahead → this buy balances → rising
    && newWoodQty < 10

  const newRumors = isPhase0BuyTrigger
    ? [
        ...state.activeRumors.filter(r => !r.text.includes('caravane') && !r.text.includes('redresse')),
        { day: state.day, text: "La caravane est repartie. Le marché du bois se redresse. C'est le moment de revendre." },
      ]
    : state.activeRumors

  return {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold - cost,
      inventory: {
        ...state.player.inventory,
        [resourceId]: newWoodQty,
      },
    },
    market: {
      resources: {
        ...state.market.resources,
        [resourceId]: {
          ...resource,
          currentPrice: newPrice,
          volumeAvailable: Math.max(0, resource.volumeAvailable - actualQty),
          priceHistory: [
            ...resource.priceHistory,
            { day: state.day, price: newPrice, marker: 'player' as const },
          ],
        },
      },
    },
    log: [...state.log, event],
    activeRumors: newRumors,
  }
}

// ─── Rival market actions (internal — used by ai.ts) ─────────────────────────

export function rivalSellToMarket(
  state: GameState,
  guildId: GuildId,
  resourceId: ResourceId,
  qty: number
): GameState {
  const rival    = getRival(state, guildId)
  const resource = state.market.resources[resourceId]
  const available = rival.inventory[resourceId] ?? 0
  const actualQty = Math.min(qty, available)
  if (actualQty <= 0) return state

  const newPrice   = calcPriceAfterSell(resource, actualQty)
  const goldEarned = actualQty * resource.currentPrice

  const event: GameEvent = {
    day: state.day,
    actor: guildId,
    type: 'SELL',
    payload: { resourceId, qty: actualQty, price: resource.currentPrice, gold: goldEarned },
  }

  const updatedRival = { ...rival, gold: rival.gold + goldEarned, inventory: { ...rival.inventory, [resourceId]: available - actualQty } }

  return {
    ...updateRival(state, updatedRival),
    market: {
      resources: {
        ...state.market.resources,
        [resourceId]: {
          ...resource,
          currentPrice: newPrice,
          volumeAvailable: resource.volumeAvailable + actualQty,
          priceHistory: [...resource.priceHistory, { day: state.day, price: newPrice, marker: guildId }],
        },
      },
    },
    log: [...state.log, event],
  }
}

export function rivalBuyFromMarket(
  state: GameState,
  guildId: GuildId,
  resourceId: ResourceId,
  qty: number
): GameState {
  const rival    = getRival(state, guildId)
  const resource = state.market.resources[resourceId]
  const actualQty = Math.min(qty, resource.volumeAvailable)
  const cost = actualQty * resource.currentPrice
  if (actualQty <= 0 || rival.gold < cost) return state

  const newPrice = calcPriceAfterBuy(resource, actualQty)

  const event: GameEvent = {
    day: state.day,
    actor: guildId,
    type: 'BUY',
    payload: { resourceId, qty: actualQty, price: resource.currentPrice, cost },
  }

  const updatedRival = { ...rival, gold: rival.gold - cost, inventory: { ...rival.inventory, [resourceId]: (rival.inventory[resourceId] ?? 0) + actualQty } }

  return {
    ...updateRival(state, updatedRival),
    market: {
      resources: {
        ...state.market.resources,
        [resourceId]: {
          ...resource,
          currentPrice: newPrice,
          volumeAvailable: Math.max(0, resource.volumeAvailable - actualQty),
          priceHistory: [...resource.priceHistory, { day: state.day, price: newPrice, marker: guildId }],
        },
      },
    },
    log: [...state.log, event],
  }
}

// Backward compat aliases
/** @deprecated Use rivalSellToMarket */
export const briceSellToMarket = (s: GameState, r: ResourceId, q: number) => rivalSellToMarket(s, 'brice', r, q)
/** @deprecated Use rivalBuyFromMarket */
export const briceBuyFromMarket = (s: GameState, r: ResourceId, q: number) => rivalBuyFromMarket(s, 'brice', r, q)
/** @deprecated */
export const texSellToMarket = briceSellToMarket
/** @deprecated */
export const texBuyFromMarket = briceBuyFromMarket

// ─── Preview helpers (for UI tooltips) ───────────────────────────────────────

export function previewSell(state: GameState, resourceId: ResourceId, qty: number) {
  const resource = state.market.resources[resourceId]
  const available = state.player.inventory[resourceId] ?? 0
  const actualQty = Math.min(qty, available)
  const newPrice = calcPriceAfterSell(resource, actualQty)
  const goldEarned = actualQty * resource.currentPrice
  return { actualQty, currentPrice: resource.currentPrice, newPrice, goldEarned }
}

export function previewBuy(state: GameState, resourceId: ResourceId, qty: number) {
  const resource = state.market.resources[resourceId]
  const actualQty = Math.min(qty, resource.volumeAvailable)
  const newPrice = calcPriceAfterBuy(resource, actualQty)
  const cost = actualQty * resource.currentPrice
  return { actualQty, currentPrice: resource.currentPrice, newPrice, cost }
}
