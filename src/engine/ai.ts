import type { GameState, BuildingId, ResourceId, WonderId } from './types'
import { texBuyFromMarket, texSellToMarket } from './market'
import { texBuyBuilding } from './buildings'
import { texBuyBackShare } from './shares'

// ─── Tex decision tree (evaluated once per end-of-day) ───────────────────────

export function runTexAI(state: GameState): GameState {
  let s = state

  // Route to the right filière based on Tex's strategy
  if (s.texStrategy.preferredResource === 'apple') {
    s = runTexAppleStrategy(s)
  } else {
    s = runTexWoodStrategy(s)
  }

  // Buyback shares player stole — always active, defensive
  const stolenBuilding = s.player.buildings.find(pb =>
    s.tex.buildings.some(tb => tb.instanceId === pb.instanceId)
  )
  if (stolenBuilding && s.tex.gold >= 120) {
    s = texBuyBackShare(s, stolenBuilding.instanceId)
  }

  return s
}

// ─── Apple filière: Orchard → Fruit Market → Tour de Magie ───────────────────

function runTexAppleStrategy(state: GameState): GameState {
  let s = state

  // 1. Buy orchard on day 1
  const hasOrchard = s.tex.buildings.some(b => b.defId === 'orchard')
  if (!hasOrchard && s.tex.gold >= 10) {
    s = texBuyBuilding(s, 'orchard')
  }

  // 2. Race to fruit_market — buy apples from spot if not enough yet
  const hasFruitMarket = s.tex.buildings.some(b => b.defId === 'fruit_market')
  const texApples = s.tex.inventory['apple'] ?? 0
  if (hasOrchard && !hasFruitMarket && texApples < 120 && s.tex.gold > 80) {
    const need = 120 - texApples
    const qty = Math.min(need, 15, s.market.resources['apple'].volumeAvailable, Math.floor(s.tex.gold * 0.08))
    if (qty > 0) s = texBuyFromMarket(s, 'apple', qty)
  }

  // 3. Build fruit_market once apples are ready
  const texApplesForBuild = s.tex.inventory['apple'] ?? 0
  if (hasOrchard && !hasFruitMarket && texApplesForBuild >= 120) {
    s = texBuyBuilding(s, 'fruit_market')
  }

  // 4. Sell apples at high price (profit-taking)
  const appleMarket = s.market.resources['apple']
  const texApplesNow = s.tex.inventory['apple'] ?? 0
  if (appleMarket.currentPrice > appleMarket.equilibriumPrice * 1.10 && texApplesNow > 25) {
    const qtyToSell = Math.floor(texApplesNow * 0.4)
    if (qtyToSell > 0) s = texSellToMarket(s, 'apple', qtyToSell)
  }

  // 4b. Buy opportunistically when price is low
  const hasFruitMarketNow = s.tex.buildings.some(b => b.defId === 'fruit_market')
  const appleMarketNow = s.market.resources['apple']
  const texApplesAfterSell = s.tex.inventory['apple'] ?? 0
  if (hasFruitMarketNow && appleMarketNow.currentPrice < appleMarketNow.equilibriumPrice * 0.90
      && texApplesAfterSell < 80 && s.tex.gold > 60) {
    const qty = Math.min(20, appleMarketNow.volumeAvailable, Math.floor(s.tex.gold * 0.15))
    if (qty > 0) s = texBuyFromMarket(s, 'apple', qty)
  }

  // 5. Contribute to Tour de Magie — starts day 10, keep 20 apples as buffer
  const tower = s.wonders.find(w => w.id === 'tower_of_magic')
  if (tower && !tower.complete) {
    const needed = (tower.requiredResources['apple'] ?? 0) - (tower.texContributed['apple'] ?? 0)
    const texApplesWonder = s.tex.inventory['apple'] ?? 0
    if (needed > 0 && texApplesWonder >= 40 && s.day >= 10) {
      const contribute = Math.max(0, Math.min(texApplesWonder - 20, needed))
      if (contribute > 0) s = contributeToWonderTex(s, 'tower_of_magic', contribute)
    }
  }

  return s
}

// ─── Wood filière: Scierie → Menuiserie → Grande Cathédrale ──────────────────

function runTexWoodStrategy(state: GameState): GameState {
  let s = state

  // 1. Buy sawmill on day 1
  const hasSawmill = s.tex.buildings.some(b => b.defId === 'sawmill')
  if (!hasSawmill && s.tex.gold >= 15) {
    s = texBuyBuilding(s, 'sawmill')
  }

  // 2. Race to menuiserie — buy wood from spot if not enough yet
  const hasMenuiserie = s.tex.buildings.some(b => b.defId === 'menuiserie')
  const texWood = s.tex.inventory['wood'] ?? 0
  if (hasSawmill && !hasMenuiserie && texWood < 80 && s.tex.gold > 60) {
    const need = 80 - texWood
    const qty = Math.min(need, 8, s.market.resources['wood'].volumeAvailable, Math.floor(s.tex.gold * 0.05))
    if (qty > 0) s = texBuyFromMarket(s, 'wood', qty)
  }

  // 3. Build menuiserie once wood is ready
  const texWoodForBuild = s.tex.inventory['wood'] ?? 0
  if (hasSawmill && !hasMenuiserie && texWoodForBuild >= 80) {
    s = texBuyBuilding(s, 'menuiserie')
  }

  // 4. Sell wood at high price
  const woodMarket = s.market.resources['wood']
  const texWoodNow = s.tex.inventory['wood'] ?? 0
  if (woodMarket.currentPrice > woodMarket.equilibriumPrice * 1.10 && texWoodNow > 15) {
    const qtyToSell = Math.floor(texWoodNow * 0.4)
    if (qtyToSell > 0) s = texSellToMarket(s, 'wood', qtyToSell)
  }

  // 5. Contribute to Grande Cathédrale — starts day 8, keep 10 wood buffer
  const cathedrale = s.wonders.find(w => w.id === 'grande_cathedrale')
  if (cathedrale && !cathedrale.complete) {
    const needed = (cathedrale.requiredResources['wood'] ?? 0) - (cathedrale.texContributed['wood'] ?? 0)
    const texWoodWonder = s.tex.inventory['wood'] ?? 0
    if (needed > 0 && texWoodWonder >= 20 && s.day >= 8) {
      const contribute = Math.max(0, Math.min(texWoodWonder - 10, needed))
      if (contribute > 0) s = contributeToWonderTex(s, 'grande_cathedrale', contribute)
    }
  }

  return s
}

// ─── Tex wonder contribution (internal) ──────────────────────────────────────

function contributeToWonderTex(state: GameState, wonderId: WonderId, qty: number): GameState {
  const wonderIdx = state.wonders.findIndex(w => w.id === wonderId)
  if (wonderIdx === -1) return state
  const wonder = state.wonders[wonderIdx]
  if (wonder.complete) return state

  const resourceId = Object.keys(wonder.requiredResources)[0] as ResourceId
  const required = wonder.requiredResources[resourceId] ?? 0
  const currentContrib = wonder.texContributed[resourceId] ?? 0
  const actual = Math.min(qty, required - currentContrib)
  if (actual <= 0) return state

  const newContrib = currentContrib + actual
  const complete = newContrib >= required

  const updatedWonder = {
    ...wonder,
    texContributed: { ...wonder.texContributed, [resourceId]: newContrib },
    complete,
    completedBy: complete ? 'tex' as const : undefined,
    completedOnDay: complete ? state.day : undefined,
  }

  return {
    ...state,
    tex: {
      ...state.tex,
      inventory: {
        ...state.tex.inventory,
        [resourceId]: (state.tex.inventory[resourceId] ?? 0) - actual,
      },
    },
    wonders: state.wonders.map((w, i) => i === wonderIdx ? updatedWonder : w),
    log: [
      ...state.log,
      {
        day: state.day,
        actor: 'tex',
        type: complete ? 'WONDER_COMPLETE' : 'WONDER_PROGRESS',
        payload: { wonderId, resourceId, contributed: actual, total: newContrib, required },
      } as import('./types').GameEvent,
    ],
  }
}
