import type { GameState, BuildingId } from './types'
import { texBuyFromMarket, texSellToMarket } from './market'
import { texBuyBuilding } from './buildings'

// ─── Tex decision tree (evaluated once per end-of-day) ───────────────────────

export function runTexAI(state: GameState): GameState {
  let s = state

  // 1. Try to expand: buy orchard if no buildings and can afford it
  const hasOrchard = s.tex.buildings.some(b => b.defId === 'orchard')
  if (!hasOrchard && s.tex.gold >= 50) {
    s = texBuyBuilding(s, 'orchard')
  }

  // 2. Try to upgrade: buy fruit_market if orchard exists and has enough apples
  const hasFruitMarket = s.tex.buildings.some(b => b.defId === 'fruit_market')
  const texApples = s.tex.inventory['apple'] ?? 0
  if (hasOrchard && !hasFruitMarket && texApples >= 200) {
    s = texBuyBuilding(s, 'fruit_market')
  }

  // 3. Sell apples when price is above equilibrium (profit-taking)
  const appleMarket = s.market.resources['apple']
  const currentApples = s.tex.inventory['apple'] ?? 0
  if (appleMarket.currentPrice > appleMarket.equilibriumPrice * 1.1 && currentApples > 40) {
    const qtyToSell = Math.floor(currentApples * 0.4)
    s = texSellToMarket(s, 'apple', qtyToSell)
  }

  // 4. Buy apples when price is below equilibrium (accumulate)
  const updatedAppleMarket = s.market.resources['apple']
  if (
    updatedAppleMarket.currentPrice < updatedAppleMarket.equilibriumPrice * 0.85 &&
    s.tex.gold >= 30 &&
    updatedAppleMarket.volumeAvailable > 0
  ) {
    const budget = Math.min(s.tex.gold * 0.3, 60)
    const qty = Math.floor(budget / updatedAppleMarket.currentPrice)
    if (qty > 0) s = texBuyFromMarket(s, 'apple', qty)
  }

  // 5. Sell a small portion of apples for gold (not a hoarder, but wonder-focused)
  const texApplesStock = s.tex.inventory['apple'] ?? 0
  const applePrice = s.market.resources['apple'].currentPrice
  if (texApplesStock > 80 && applePrice >= s.market.resources['apple'].equilibriumPrice * 1.05) {
    const toSell = Math.floor(texApplesStock * 0.2)
    if (toSell > 0) s = texSellToMarket(s, 'apple', toSell)
  }

  // 6. Contribute to wonder — Tex builds his own tower from day 10
  const wonderAppleNeeded =
    (s.wonder.requiredResources['apple'] ?? 0) - (s.wonder.texContributed['apple'] ?? 0)
  const texApplesNow = s.tex.inventory['apple'] ?? 0
  if (wonderAppleNeeded > 0 && texApplesNow >= 50 && s.day >= 10) {
    // Keep 30 apples as buffer, contribute the rest
    const contribute = Math.max(0, Math.min(texApplesNow - 30, wonderAppleNeeded))
    if (contribute > 0) s = contributeToWonderTex(s, contribute)
  }

  return s
}

function contributeToWonderTex(state: GameState, apples: number): GameState {
  const currentContrib = state.wonder.texContributed['apple'] ?? 0
  const required = state.wonder.requiredResources['apple'] ?? 0
  const actual = Math.min(apples, required - currentContrib)
  if (actual <= 0) return state

  const newContrib = currentContrib + actual
  const complete = newContrib >= required

  return {
    ...state,
    tex: {
      ...state.tex,
      inventory: {
        ...state.tex.inventory,
        apple: (state.tex.inventory['apple'] ?? 0) - actual,
      },
    },
    wonder: {
      ...state.wonder,
      texContributed: { apple: newContrib },
      complete,
      completedBy: complete ? 'tex' : undefined,
      completedOnDay: complete ? state.day : undefined,
    },
    log: [
      ...state.log,
      {
        day: state.day,
        actor: 'tex',
        type: complete ? 'WONDER_COMPLETE' : 'WONDER_PROGRESS',
        payload: { contributed: actual, total: newContrib, required },
      },
    ],
  }
}
