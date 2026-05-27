import type { GameState, GameEvent, ResourceId, MarketState, ResourceMarket, BuildingId, GuildId } from './types'
import { getRival, updateRival } from './types'

const APPLE_PRODUCERS: BuildingId[] = ['orchard']
const WOOD_PRODUCERS:  BuildingId[] = ['sawmill']

function producerDefsFor(id: ResourceId): BuildingId[] {
  return id === 'apple' ? APPLE_PRODUCERS : WOOD_PRODUCERS
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
export function recoverPrices(state: GameState): MarketState {
  const allBuildings = [...state.player.buildings, ...state.rivals.flatMap(r => r.buildings)]
  const resources = { ...state.market.resources }

  for (const id of Object.keys(resources) as ResourceId[]) {
    const r = resources[id]

    // Degradation → supply signal: equilibriumPrice rises as extractors degrade
    const producerIds = producerDefsFor(id)
    const extractors  = allBuildings.filter(b => producerIds.includes(b.defId))
    const avgDegradation = extractors.length > 0
      ? extractors.reduce((sum, b) => sum + (b.degradation ?? 0), 0) / extractors.length
      : 0
    const newEquilibrium = r.baseEquilibriumPrice * (1 + avgDegradation)

    // Recover toward new equilibrium (15%/day)
    const recovered = r.currentPrice + (newEquilibrium - r.currentPrice) * 0.15

    // Random walk noise — slight upward bias (+2% net drift)
    const noise    = (Math.random() - 0.48) * r.volatility
    const withNoise = recovered * (1 + noise)

    // Clamp: 30% to 250% of baseEquilibriumPrice
    const clamped = Math.max(
      r.baseEquilibriumPrice * 0.30,
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
            { day: state.day, price: newPrice },
          ],
        },
      },
    },
    log: [...state.log, event],
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

  return {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold - cost,
      inventory: {
        ...state.player.inventory,
        [resourceId]: (state.player.inventory[resourceId] ?? 0) + actualQty,
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
            { day: state.day, price: newPrice },
          ],
        },
      },
    },
    log: [...state.log, event],
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
          priceHistory: [...resource.priceHistory, { day: state.day, price: newPrice, texMarker: guildId === 'tex' }],
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
          priceHistory: [...resource.priceHistory, { day: state.day, price: newPrice, texMarker: guildId === 'tex' }],
        },
      },
    },
    log: [...state.log, event],
  }
}

// Backward compat aliases (used by shares.ts)
/** @deprecated Use rivalSellToMarket */
export const texSellToMarket = (s: GameState, r: ResourceId, q: number) => rivalSellToMarket(s, 'tex', r, q)
/** @deprecated Use rivalBuyFromMarket */
export const texBuyFromMarket = (s: GameState, r: ResourceId, q: number) => rivalBuyFromMarket(s, 'tex', r, q)

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
