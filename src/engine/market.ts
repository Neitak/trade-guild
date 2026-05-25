import type { GameState, GameEvent, ResourceId, MarketState, ResourceMarket } from './types'

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
 * Daily price recovery toward equilibrium (15% per day).
 */
export function recoverPrices(market: MarketState, day: number): MarketState {
  const resources = { ...market.resources }
  for (const id of Object.keys(resources) as ResourceId[]) {
    const r = resources[id]
    const recovered = r.currentPrice + (r.equilibriumPrice - r.currentPrice) * 0.15
    resources[id] = {
      ...r,
      currentPrice: Math.max(0.05, recovered),
      // Replenish some volume each day
      volumeAvailable: Math.min(r.volumeAvailable + 30, 300),
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

// ─── Tex market actions (internal — used by ai.ts) ────────────────────────────

export function texSellToMarket(
  state: GameState,
  resourceId: ResourceId,
  qty: number
): GameState {
  const resource = state.market.resources[resourceId]
  const available = state.tex.inventory[resourceId] ?? 0
  const actualQty = Math.min(qty, available)
  if (actualQty <= 0) return state

  const newPrice = calcPriceAfterSell(resource, actualQty)
  const goldEarned = actualQty * resource.currentPrice

  const event: GameEvent = {
    day: state.day,
    actor: 'tex',
    type: 'SELL',
    payload: { resourceId, qty: actualQty, price: resource.currentPrice, gold: goldEarned },
  }

  return {
    ...state,
    tex: {
      ...state.tex,
      gold: state.tex.gold + goldEarned,
      inventory: {
        ...state.tex.inventory,
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
            { day: state.day, price: newPrice, texMarker: true },
          ],
        },
      },
    },
    log: [...state.log, event],
  }
}

export function texBuyFromMarket(
  state: GameState,
  resourceId: ResourceId,
  qty: number
): GameState {
  const resource = state.market.resources[resourceId]
  const actualQty = Math.min(qty, resource.volumeAvailable)
  const cost = actualQty * resource.currentPrice
  if (actualQty <= 0 || state.tex.gold < cost) return state

  const newPrice = calcPriceAfterBuy(resource, actualQty)

  const event: GameEvent = {
    day: state.day,
    actor: 'tex',
    type: 'BUY',
    payload: { resourceId, qty: actualQty, price: resource.currentPrice, cost },
  }

  return {
    ...state,
    tex: {
      ...state.tex,
      gold: state.tex.gold - cost,
      inventory: {
        ...state.tex.inventory,
        [resourceId]: (state.tex.inventory[resourceId] ?? 0) + actualQty,
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
            { day: state.day, price: newPrice, texMarker: true },
          ],
        },
      },
    },
    log: [...state.log, event],
  }
}

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
