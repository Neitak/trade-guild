import type { GameState, GameEvent, ResourceId, MarketState, ResourceMarket, BuildingId, GuildId } from './types'
import { getRival, updateRival, nextAvgCost } from './types'

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

// ─── Modèle de marché (V8 — Lot 4, réversible) ────────────────────────────────
// 'slippage' : prix MOYEN de remplissage, pas de mur d'achat dur — un gros ordre
//   marche le prix contre soi (aller-retour perdant). Mêmes règles joueur/rivaux.
// 'hardcap'  : ancien modèle — prix unique puis saut, achat plafonné à volumeAvailable.
export type MarketMode = 'slippage' | 'hardcap'
export const MARKET_MODE: MarketMode = 'slippage'

/** Clamp prix dans la bande 20 %–250 % du prix d'équilibre de base (jamais < 0.05). */
function clampToBand(r: ResourceMarket, p: number): number {
  return Math.max(0.05, Math.max(r.baseEquilibriumPrice * 0.20, Math.min(r.baseEquilibriumPrice * 2.50, p)))
}

interface Fill { actualQty: number; avgPrice: number; newPrice: number; total: number }

/** Remplissage d'un ACHAT. En slippage : prix moyen linéaire P0·(1+0,5·k·q/V), prix final P0·(1+k·q/V). */
function fillBuy(r: ResourceMarket, qty: number): Fill {
  if (MARKET_MODE === 'hardcap') {
    const actualQty = Math.min(qty, r.volumeAvailable)
    return { actualQty, avgPrice: r.currentPrice, newPrice: calcPriceAfterBuy(r, actualQty), total: actualQty * r.currentPrice }
  }
  const actualQty = Math.max(0, qty) // pas de mur dur : on peut dépasser volumeAvailable, le slippage punit
  const impact = r.elasticityK * (actualQty / Math.max(r.volumeAvailable, 1))
  const avgPrice = r.currentPrice * (1 + 0.5 * impact)
  const newPrice = clampToBand(r, r.currentPrice * (1 + impact))
  return { actualQty, avgPrice, newPrice, total: actualQty * avgPrice }
}

/** Remplissage d'une VENTE. En slippage : prix moyen P0·(1−0,5·k·q/V), prix final P0·(1−k·q/V). */
function fillSell(r: ResourceMarket, qty: number): Fill {
  const actualQty = Math.max(0, qty)
  if (MARKET_MODE === 'hardcap') {
    return { actualQty, avgPrice: r.currentPrice, newPrice: calcPriceAfterSell(r, actualQty), total: actualQty * r.currentPrice }
  }
  const impact = r.elasticityK * (actualQty / Math.max(r.volumeAvailable, 1))
  const avgPrice = Math.max(0.01, r.currentPrice * (1 - 0.5 * impact))
  const newPrice = clampToBand(r, r.currentPrice * (1 - impact))
  return { actualQty, avgPrice, newPrice, total: actualQty * avgPrice }
}

/**
 * Plus grande quantité achetable avec `gold` sous slippage (coût total quadratique en q).
 * Résout (0,5·k·P0/V)·q² + P0·q − gold ≤ 0. En hardcap : simple gold / prix courant.
 */
function maxAffordableBuy(r: ResourceMarket, gold: number): number {
  const P0 = Math.max(r.currentPrice, 0.01)
  if (MARKET_MODE === 'hardcap') return Math.floor(gold / P0)
  const a = 0.5 * r.elasticityK * P0 / Math.max(r.volumeAvailable, 1)
  if (a <= 0) return Math.floor(gold / P0)
  const q = (-P0 + Math.sqrt(P0 * P0 + 4 * a * gold)) / (2 * a)
  return Math.max(0, Math.floor(q))
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
  const reqQty = Math.min(qty, available)
  if (reqQty <= 0) return state

  const fill = fillSell(resource, reqQty)
  const actualQty = fill.actualQty
  const newPrice = fill.newPrice
  const goldEarned = fill.total

  const event: GameEvent = {
    day: state.day,
    actor: 'player',
    type: 'SELL',
    payload: { resourceId, qty: actualQty, price: fill.avgPrice, gold: goldEarned },
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
  const reqQty = Math.min(qty, maxAffordableBuy(resource, state.player.gold))
  if (reqQty <= 0) return state

  const fill = fillBuy(resource, reqQty)
  const actualQty = fill.actualQty
  const cost = fill.total
  if (actualQty <= 0 || state.player.gold < cost) return state

  const newPrice = fill.newPrice

  const event: GameEvent = {
    day: state.day,
    actor: 'player',
    type: 'BUY',
    payload: { resourceId, qty: actualQty, price: fill.avgPrice, cost },
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

  const prevQty = state.player.inventory[resourceId] ?? 0
  const prevAvg = state.player.inventoryAvgCost?.[resourceId] ?? 0

  return {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold - cost,
      inventory: {
        ...state.player.inventory,
        [resourceId]: newWoodQty,
      },
      inventoryAvgCost: {
        ...(state.player.inventoryAvgCost ?? {}),
        // acquisition payante : prix réellement déboursé pour ces unités
        [resourceId]: nextAvgCost(prevAvg, prevQty, actualQty, cost),
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
  const reqQty = Math.min(qty, available)
  if (reqQty <= 0) return state

  const fill = fillSell(resource, reqQty)
  const actualQty  = fill.actualQty
  const newPrice   = fill.newPrice
  const goldEarned = fill.total

  const event: GameEvent = {
    day: state.day,
    actor: guildId,
    type: 'SELL',
    payload: { resourceId, qty: actualQty, price: fill.avgPrice, gold: goldEarned },
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
  const reqQty = Math.min(qty, maxAffordableBuy(resource, rival.gold))
  if (reqQty <= 0) return state

  const fill = fillBuy(resource, reqQty)
  const actualQty = fill.actualQty
  const cost = fill.total
  if (actualQty <= 0 || rival.gold < cost) return state

  const newPrice = fill.newPrice

  const event: GameEvent = {
    day: state.day,
    actor: guildId,
    type: 'BUY',
    payload: { resourceId, qty: actualQty, price: fill.avgPrice, cost },
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
  const fill = fillSell(resource, Math.min(qty, available))
  return { actualQty: fill.actualQty, currentPrice: resource.currentPrice, newPrice: fill.newPrice, goldEarned: fill.total }
}

export function previewBuy(state: GameState, resourceId: ResourceId, qty: number) {
  const resource = state.market.resources[resourceId]
  const reqQty = Math.min(qty, maxAffordableBuy(resource, state.player.gold))
  const fill = fillBuy(resource, reqQty)
  return { actualQty: fill.actualQty, currentPrice: resource.currentPrice, newPrice: fill.newPrice, cost: fill.total }
}
