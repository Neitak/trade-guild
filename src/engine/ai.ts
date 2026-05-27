import type { GameState, BuildingId, ResourceId, WonderId, GuildId } from './types'
import { getRival, updateRival } from './types'
import { rivalBuyFromMarket, rivalSellToMarket } from './market'
import { rivalBuyBuilding } from './buildings'

// ─── Generic rival decision tree ─────────────────────────────────────────────

export function runRivalAI(state: GameState, guildId: GuildId): GameState {
  let s = state
  const strategy = s.rivalStrategies[guildId]
  if (!strategy) return s

  if (strategy.preferredResource === 'apple') {
    s = runAppleStrategy(s, guildId)
  } else {
    s = runWoodStrategy(s, guildId)
  }

  // Buyback shares player stole — defensive
  const rival = getRival(s, guildId)
  const stolenBuilding = s.player.buildings.find(pb =>
    rival.buildings.some(rb => rb.instanceId === pb.instanceId)
  )
  if (stolenBuilding && rival.gold >= 120) {
    s = rivalBuyBackShare(s, guildId, stolenBuilding.instanceId)
  }

  return s
}

/** Backward compat for direct callers */
export const runTexAI = (state: GameState) => runRivalAI(state, 'tex')

// ─── Apple filière: Orchard → Fruit Market → Tour de Magie ───────────────────

function runAppleStrategy(state: GameState, guildId: GuildId): GameState {
  let s = state
  const rival = () => getRival(s, guildId)

  const hasOrchard = rival().buildings.some(b => b.defId === 'orchard')
  if (!hasOrchard && rival().gold >= 10) {
    s = rivalBuyBuilding(s, guildId, 'orchard')
  }

  const hasFruitMarket = rival().buildings.some(b => b.defId === 'fruit_market')
  const apples = rival().inventory['apple'] ?? 0
  if (hasOrchard && !hasFruitMarket && apples < 120 && rival().gold > 80) {
    const need = 120 - apples
    const qty = Math.min(need, 15, s.market.resources['apple'].volumeAvailable, Math.floor(rival().gold * 0.08))
    if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'apple', qty)
  }

  const applesForBuild = rival().inventory['apple'] ?? 0
  if (hasOrchard && !rival().buildings.some(b => b.defId === 'fruit_market') && applesForBuild >= 120) {
    s = rivalBuyBuilding(s, guildId, 'fruit_market')
  }

  // Profit-taking
  const appleMarket = s.market.resources['apple']
  const applesNow = rival().inventory['apple'] ?? 0
  if (appleMarket.currentPrice > appleMarket.equilibriumPrice * 1.10 && applesNow > 25) {
    const qty = Math.floor(applesNow * 0.4)
    if (qty > 0) s = rivalSellToMarket(s, guildId, 'apple', qty)
  }

  // Opportunistic buy
  if (rival().buildings.some(b => b.defId === 'fruit_market') &&
      appleMarket.currentPrice < appleMarket.equilibriumPrice * 0.90 &&
      (rival().inventory['apple'] ?? 0) < 80 && rival().gold > 60) {
    const qty = Math.min(20, appleMarket.volumeAvailable, Math.floor(rival().gold * 0.15))
    if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'apple', qty)
  }

  // Wonder contribution
  const tower = s.wonders.find(w => w.id === 'tower_of_magic')
  if (tower && !tower.complete) {
    const contributed = tower.rivalContributed[guildId]?.['apple'] ?? 0
    const needed = (tower.requiredResources['apple'] ?? 0) - contributed
    const stock = rival().inventory['apple'] ?? 0
    if (needed > 0 && stock >= 40 && s.day >= 10) {
      const qty = Math.max(0, Math.min(stock - 20, needed))
      if (qty > 0) s = contributeToWonderRival(s, guildId, 'tower_of_magic', qty)
    }
  }

  return s
}

// ─── Wood filière: Scierie → Menuiserie → Grande Cathédrale ──────────────────

function runWoodStrategy(state: GameState, guildId: GuildId): GameState {
  let s = state
  const rival = () => getRival(s, guildId)

  const hasSawmill = rival().buildings.some(b => b.defId === 'sawmill')
  if (!hasSawmill && rival().gold >= 15) {
    s = rivalBuyBuilding(s, guildId, 'sawmill')
  }

  const hasMenuiserie = rival().buildings.some(b => b.defId === 'menuiserie')
  const wood = rival().inventory['wood'] ?? 0
  if (hasSawmill && !hasMenuiserie && wood < 80 && rival().gold > 60) {
    const need = 80 - wood
    const qty = Math.min(need, 8, s.market.resources['wood'].volumeAvailable, Math.floor(rival().gold * 0.05))
    if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'wood', qty)
  }

  const woodForBuild = rival().inventory['wood'] ?? 0
  if (hasSawmill && !rival().buildings.some(b => b.defId === 'menuiserie') && woodForBuild >= 80) {
    s = rivalBuyBuilding(s, guildId, 'menuiserie')
  }

  const woodMarket = s.market.resources['wood']
  const woodNow = rival().inventory['wood'] ?? 0
  if (woodMarket.currentPrice > woodMarket.equilibriumPrice * 1.10 && woodNow > 15) {
    const qty = Math.floor(woodNow * 0.4)
    if (qty > 0) s = rivalSellToMarket(s, guildId, 'wood', qty)
  }

  const cathedrale = s.wonders.find(w => w.id === 'grande_cathedrale')
  if (cathedrale && !cathedrale.complete) {
    const contributed = cathedrale.rivalContributed[guildId]?.['wood'] ?? 0
    const needed = (cathedrale.requiredResources['wood'] ?? 0) - contributed
    const stock = rival().inventory['wood'] ?? 0
    if (needed > 0 && stock >= 20 && s.day >= 8) {
      const qty = Math.max(0, Math.min(stock - 10, needed))
      if (qty > 0) s = contributeToWonderRival(s, guildId, 'grande_cathedrale', qty)
    }
  }

  return s
}

// ─── Wonder contribution (rival) ─────────────────────────────────────────────

function contributeToWonderRival(state: GameState, guildId: GuildId, wonderId: WonderId, qty: number): GameState {
  const wonderIdx = state.wonders.findIndex(w => w.id === wonderId)
  if (wonderIdx === -1) return state
  const wonder = state.wonders[wonderIdx]
  if (wonder.complete) return state

  const resourceId = Object.keys(wonder.requiredResources)[0] as ResourceId
  const required = wonder.requiredResources[resourceId] ?? 0
  const currentContrib = wonder.rivalContributed[guildId]?.[resourceId] ?? 0
  const actual = Math.min(qty, required - currentContrib)
  if (actual <= 0) return state

  const newContrib = currentContrib + actual
  const complete   = newContrib >= required

  const rival = getRival(state, guildId)
  const updatedRival = { ...rival, inventory: { ...rival.inventory, [resourceId]: (rival.inventory[resourceId] ?? 0) - actual } }

  const updatedWonder = {
    ...wonder,
    rivalContributed: {
      ...wonder.rivalContributed,
      [guildId]: { ...(wonder.rivalContributed[guildId] ?? {}), [resourceId]: newContrib },
    },
    complete,
    completedBy: complete ? guildId : undefined,
    completedOnDay: complete ? state.day : undefined,
  }

  return {
    ...updateRival(state, updatedRival),
    wonders: state.wonders.map((w, i) => i === wonderIdx ? updatedWonder : w),
    log: [...state.log, {
      day: state.day,
      actor: guildId,
      type: complete ? 'WONDER_COMPLETE' : 'WONDER_PROGRESS',
      payload: { wonderId, resourceId, contributed: actual, total: newContrib, required },
    } as import('./types').GameEvent],
  }
}

// ─── Share buyback (rival) ────────────────────────────────────────────────────

function rivalBuyBackShare(state: GameState, guildId: GuildId, instanceId: string): GameState {
  const rival = getRival(state, guildId)
  const playerBuilding = state.player.buildings.find(b => b.instanceId === instanceId)
  if (!playerBuilding || playerBuilding.shares <= 0) return state

  const def = (import.meta as any).glob ? null : null  // eslint-disable-line
  const STEP = 10
  const cost = Math.max(5, STEP * 3)  // simplified cost for buyback
  if (rival.gold < cost) return state

  const transferred = Math.min(STEP, playerBuilding.shares)
  const updatedPlayer = {
    ...state.player,
    gold: state.player.gold + cost,
    buildings: state.player.buildings
      .map(b => b.instanceId === instanceId ? { ...b, shares: b.shares - transferred } : b)
      .filter(b => b.shares > 0),
  }
  const updatedRival = {
    ...rival,
    gold: rival.gold - cost,
    buildings: rival.buildings.map(b => b.instanceId === instanceId ? { ...b, shares: b.shares + transferred } : b),
  }

  return {
    ...updateRival({ ...state, player: updatedPlayer }, updatedRival),
    log: [...state.log, {
      day: state.day,
      actor: guildId,
      type: 'SELL_SHARE',
      payload: { instanceId, transferredShares: transferred, cost },
    } as import('./types').GameEvent],
  }
}
