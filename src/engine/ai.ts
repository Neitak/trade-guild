import type { GameState, BuildingId } from './types'
import { texBuyFromMarket, texSellToMarket } from './market'
import { texBuyBuilding } from './buildings'
import { texBuyBackShare } from './shares'

// ─── Tex decision tree (evaluated once per end-of-day) ───────────────────────

export function runTexAI(state: GameState): GameState {
  let s = state

  // 1. Buy orchard on first day
  const hasOrchard = s.tex.buildings.some(b => b.defId === 'orchard')
  if (!hasOrchard && s.tex.gold >= 50) {
    s = texBuyBuilding(s, 'orchard')
  }

  // 2. Race to buy fruit_market: buy pommes from spot if not enough yet
  const hasFruitMarket = s.tex.buildings.some(b => b.defId === 'fruit_market')
  const texApplesCurrent = s.tex.inventory['apple'] ?? 0
  if (hasOrchard && !hasFruitMarket && texApplesCurrent < 120 && s.tex.gold > 80) {
    const still_need = 120 - texApplesCurrent
    const qty = Math.min(still_need, 15, s.market.resources['apple'].volumeAvailable,
      Math.floor(s.tex.gold * 0.08))
    if (qty > 0) s = texBuyFromMarket(s, 'apple', qty)
  }

  // 3. Buy fruit_market once threshold reached
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

  // 4b. Buy opportunistically when price is low (below 90% equilibrium), even without a building goal
  const appleMarketNow = s.market.resources['apple']
  const texApplesAfterSell = s.tex.inventory['apple'] ?? 0
  const hasFruitMarketNow = s.tex.buildings.some(b => b.defId === 'fruit_market')
  if (
    hasFruitMarketNow &&
    appleMarketNow.currentPrice < appleMarketNow.equilibriumPrice * 0.90 &&
    texApplesAfterSell < 80 &&
    s.tex.gold > 60
  ) {
    const qty = Math.min(20, appleMarketNow.volumeAvailable, Math.floor(s.tex.gold * 0.15))
    if (qty > 0) s = texBuyFromMarket(s, 'apple', qty)
  }

  // 5. Contribute to wonder — starts from day 10, keep 20 as buffer
  const wonderAppleNeeded =
    (s.wonder.requiredResources['apple'] ?? 0) - (s.wonder.texContributed['apple'] ?? 0)
  const texApplesWonder = s.tex.inventory['apple'] ?? 0
  if (wonderAppleNeeded > 0 && texApplesWonder >= 40 && s.day >= 10) {
    const contribute = Math.max(0, Math.min(texApplesWonder - 20, wonderAppleNeeded))
    if (contribute > 0) s = contributeToWonderTex(s, contribute)
  }

  // 6. Buy back shares player took — only when gold buffer is solid (defensive, not instant)
  const stolenBuilding = s.player.buildings.find(pb =>
    s.tex.buildings.some(tb => tb.instanceId === pb.instanceId)
  )
  if (stolenBuilding && s.tex.gold >= 120) {
    s = texBuyBackShare(s, stolenBuilding.instanceId)
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
