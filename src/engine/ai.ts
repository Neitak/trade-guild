import type { GameState, BuildingId, ResourceId, WonderId, GuildId, RivalStrategy } from './types'
import { getRival, updateRival } from './types'
import { rivalBuyFromMarket, rivalSellToMarket } from './market'
import { rivalBuyBuilding, upgradeBuildingRival } from './buildings'

// ─── Generic rival decision tree ─────────────────────────────────────────────

export function runRivalAI(state: GameState, guildId: GuildId): GameState {
  let s = state
  const strategy = s.rivalStrategies[guildId]
  if (!strategy) return s   // inactive rival — no strategy assigned yet

  if (strategy.preferredResource === 'apple') {
    s = runAppleStrategy(s, guildId)
  } else if (strategy.preferredResource === 'pierre') {
    s = runPierreStrategy(s, guildId)
  } else if (strategy.preferredResource === 'meuble') {
    s = runImmoStrategy(s, guildId)
  } else {
    s = runWoodStrategy(s, guildId)
  }

  // Defensive: buyback shares player stole
  const rival = getRival(s, guildId)
  const stolenBuilding = s.player.buildings.find(pb =>
    rival.buildings.some(rb => rb.instanceId === pb.instanceId)
  )
  if (stolenBuilding && rival.gold >= 120) {
    s = rivalBuyBackShare(s, guildId, stolenBuilding.instanceId)
  }

  return s
}

export const runBriceAI = (state: GameState) => runRivalAI(state, 'brice')
/** @deprecated */
export const runTexAI = runBriceAI

// ─── Helper to update a strategy without clobbering other fields ─────────────

function setStrategy(state: GameState, guildId: GuildId, patch: Partial<RivalStrategy>): GameState {
  const prev = state.rivalStrategies[guildId] ?? { preferredResource: 'wood' }
  return {
    ...state,
    rivalStrategies: {
      ...state.rivalStrategies,
      [guildId]: { ...prev, ...patch },
    },
  }
}

// ─── Apple filière ────────────────────────────────────────────────────────────

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

// ─── Wood filière + Pump & Dump (Brice) ──────────────────────────────────────
// Phase 1: buy sawmill → accumulate for menuiserie
// Phase 2: pump & dump once established → 4ème sensation "je me suis fait avoir"

function runWoodStrategy(state: GameState, guildId: GuildId): GameState {
  let s = state
  const rival = () => getRival(s, guildId)
  const strategy = () => s.rivalStrategies[guildId]!

  // ── Buy sawmill ──────────────────────────────────────────────────────────
  const hasSawmill = rival().buildings.some(b => b.defId === 'sawmill')
  if (!hasSawmill && rival().gold >= 15) {
    s = rivalBuyBuilding(s, guildId, 'sawmill')
    // Unlock scierie_slot_2 immediately when first sawmill is built
    s = unlockNodeImmediate(s, 'scierie_slot_2',
      `Les bûcherons affluent — la Scierie des Hauteurs est désormais disponible.`)
  }

  // ── Upgrade sawmill (Brice competes for higher production) ───────────────
  if (hasSawmill && s.day >= 5) {
    const sawmill = rival().buildings.find(b => b.defId === 'sawmill')
    if (sawmill) {
      const level = sawmill.level ?? 1
      const upgradeCosts: Record<number, number> = { 1: 25, 2: 50, 3: 100, 4: 200 }
      if (level < 5 && rival().gold >= (upgradeCosts[level] ?? 999)) {
        // Brice upgrades every 4 days to create a believable progression
        if (s.day % 4 === 0) {
          s = upgradeBuildingRival(s, guildId, sawmill.instanceId)
        }
      }
    }
  }

  // ── Accumulate wood for menuiserie ───────────────────────────────────────
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

  // ── Pump & Dump — after Phase 1 established (menuiserie owned, day > 10) ──
  if (hasMenuiserie && s.day > 10) {
    s = runPumpDump(s, guildId)
    return s  // skip normal profit-taking when pump/dump active
  }

  // ── Normal profit-taking (pre-Phase 2) ───────────────────────────────────
  const woodMarket = s.market.resources['wood']
  const woodNow = rival().inventory['wood'] ?? 0
  if (woodMarket.currentPrice > woodMarket.equilibriumPrice * 1.10 && woodNow > 15) {
    const qty = Math.floor(woodNow * 0.4)
    if (qty > 0) s = rivalSellToMarket(s, guildId, 'wood', qty)
  }

  // ── Wonder contribution ───────────────────────────────────────────────────
  s = tryContributeWonder(s, guildId, 'grande_cathedrale', 'wood', 20, 10)

  return s
}

// ─── Pump & Dump sub-routine ──────────────────────────────────────────────────

function runPumpDump(state: GameState, guildId: GuildId): GameState {
  let s = state
  const rival = () => getRival(s, guildId)
  const strategy = () => s.rivalStrategies[guildId]!
  const woodMarket = s.market.resources['wood']
  const woodNow = rival().inventory['wood'] ?? 0
  const phase = strategy().pumpPhase ?? 'idle'
  const cooldownDay = strategy().pumpCooldownDay ?? 0

  if (s.day < cooldownDay) return s  // on cooldown

  if (phase === 'idle') {
    // Start pumping when price is near equilibrium and Brice has gold
    if (woodMarket.currentPrice < woodMarket.equilibriumPrice * 1.08 && rival().gold >= 50) {
      const qty = Math.min(30, woodMarket.volumeAvailable, Math.floor(rival().gold * 0.55))
      if (qty >= 8) {
        s = rivalBuyFromMarket(s, guildId, 'wood', qty)
        s = setStrategy(s, guildId, { pumpPhase: 'pumping', pumpStartDay: s.day })
      }
    }
  } else if (phase === 'pumping') {
    // Keep buying to push price up
    if (woodMarket.currentPrice < woodMarket.equilibriumPrice * 1.30 && rival().gold >= 25) {
      const qty = Math.min(20, woodMarket.volumeAvailable, Math.floor(rival().gold * 0.40))
      if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'wood', qty)
    }
    // Trigger dump: price is high enough OR player bought into the pump
    const pumpDays = s.day - (strategy().pumpStartDay ?? s.day)
    const playerWood = s.player.inventory['wood'] ?? 0
    if (
      woodMarket.currentPrice > woodMarket.equilibriumPrice * 1.35 ||
      (pumpDays >= 3 && playerWood >= 15) ||
      pumpDays >= 5
    ) {
      s = setStrategy(s, guildId, { pumpPhase: 'dumping' })
    }
  } else if (phase === 'dumping') {
    // Dump everything — crash the price
    const toDump = Math.floor(woodNow * 0.85)
    if (toDump > 0) {
      s = rivalSellToMarket(s, guildId, 'wood', toDump)
    }
    // Back to idle with cooldown (5-8 days before next pump)
    s = setStrategy(s, guildId, {
      pumpPhase: 'idle',
      pumpCooldownDay: s.day + 5 + Math.floor(Math.random() * 4),
    })
    // Wonder contribution after dump — Brice converts profits to wonder
    s = tryContributeWonder(s, guildId, 'grande_cathedrale', 'wood', 20, 10)
  }

  return s
}

// ─── Pierre filière (Raph) ────────────────────────────────────────────────────

function runPierreStrategy(state: GameState, guildId: GuildId): GameState {
  let s = state
  const rival = () => getRival(s, guildId)

  // Buy carriere when node is available
  const hasCarriere = rival().buildings.some(b => b.defId === 'carriere')
  const carriereAvailable = s.map.nodes.some(n => n.buildingDefId === 'carriere' && !n.locked && !n.ownedBy)
  if (!hasCarriere && carriereAvailable && rival().gold >= 20) {
    s = rivalBuyBuilding(s, guildId, 'carriere')
  }

  const pierre = rival().inventory['pierre'] ?? 0
  const pierreMarket = s.market.resources['pierre']

  // Profit-taking: sell when price > 115% equilibrium
  if (pierre > 20 && pierreMarket.currentPrice > pierreMarket.equilibriumPrice * 1.15) {
    const qty = Math.floor(pierre * 0.45)
    if (qty > 0) s = rivalSellToMarket(s, guildId, 'pierre', qty)
  }

  // Opportunistic accumulation
  if (pierre < 30 && pierreMarket.currentPrice < pierreMarket.equilibriumPrice * 0.90 && rival().gold >= 30) {
    const qty = Math.min(15, pierreMarket.volumeAvailable, Math.floor(rival().gold * 0.2))
    if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'pierre', qty)
  }

  return s
}

// ─── Immobilier filière (Rita) — Phase 3 ────────────────────────────────────

function runImmoStrategy(state: GameState, guildId: GuildId): GameState {
  let s = state
  const rival = () => getRival(s, guildId)

  const hasAuberge = rival().buildings.some(b => b.defId === 'auberge')
  const aubergeAvailable = s.map.nodes.some(
    n => n.buildingDefId === 'auberge' && !n.locked && !n.ownedBy
  )

  if (!hasAuberge && aubergeAvailable) {
    // Accumulate bois + pierre to build auberge (40or + 20bois + 10pierre)
    const pierre = rival().inventory['pierre'] ?? 0
    const wood   = rival().inventory['wood'] ?? 0
    if (pierre < 10 && rival().gold > 35) {
      const qty = Math.min(10 - pierre, s.market.resources['pierre'].volumeAvailable, Math.floor(rival().gold * 0.2))
      if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'pierre', qty)
    }
    if (wood < 20 && rival().gold > 35) {
      const qty = Math.min(20 - wood, s.market.resources['wood'].volumeAvailable, Math.floor(rival().gold * 0.15))
      if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'wood', qty)
    }
    if (rival().gold >= 40 && (rival().inventory['wood'] ?? 0) >= 20 && (rival().inventory['pierre'] ?? 0) >= 10) {
      s = rivalBuyBuilding(s, guildId, 'auberge')
    }
    return s
  }

  if (hasAuberge) {
    // Upgrade auberge with meubles (CONFORT)
    const auberge = rival().buildings.find(b => b.defId === 'auberge')!
    const level = auberge.level ?? 1
    if (level < 5) {
      const MEUBLE_COSTS: Record<number, number> = { 1: 10, 2: 20, 3: 35, 4: 50 }
      const meubleNeed = MEUBLE_COSTS[level] ?? 999
      const meubles = rival().inventory['meuble'] ?? 0
      if (meubles < meubleNeed && rival().gold > 20) {
        const qty = Math.min(meubleNeed - meubles, s.market.resources['meuble'].volumeAvailable, Math.floor(rival().gold * 0.35))
        if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'meuble', qty)
      }
      if ((rival().inventory['meuble'] ?? 0) >= meubleNeed) {
        s = upgradeBuildingRival(s, guildId, auberge.instanceId)
      }
    }
    // Sell excess inventory to accumulate gold
    const woodNow = rival().inventory['wood'] ?? 0
    if (woodNow > 10) s = rivalSellToMarket(s, guildId, 'wood', Math.floor(woodNow * 0.6))
    const pierreNow = rival().inventory['pierre'] ?? 0
    if (pierreNow > 5) s = rivalSellToMarket(s, guildId, 'pierre', Math.floor(pierreNow * 0.5))
  }

  return s
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function tryContributeWonder(
  state: GameState,
  guildId: GuildId,
  wonderId: WonderId,
  resourceId: ResourceId,
  minStock: number,
  minDay: number
): GameState {
  if (state.day < minDay) return state
  const wonder = state.wonders.find(w => w.id === wonderId)
  if (!wonder || wonder.complete) return state

  const contributed = wonder.rivalContributed[guildId]?.[resourceId] ?? 0
  const needed = (wonder.requiredResources[resourceId] ?? 0) - contributed
  const stock = getRival(state, guildId).inventory[resourceId] ?? 0

  if (needed > 0 && stock >= minStock) {
    const qty = Math.max(0, Math.min(stock - Math.floor(minStock * 0.5), needed))
    if (qty > 0) return contributeToWonderRival(state, guildId, wonderId, qty)
  }
  return state
}

function unlockNodeImmediate(state: GameState, nodeId: string, message: string): GameState {
  const node = state.map.nodes.find(n => n.id === nodeId)
  if (!node || !node.locked) return state

  return {
    ...state,
    map: {
      nodes: state.map.nodes.map(n => n.id === nodeId ? { ...n, locked: false } : n),
    },
    activeRumors: [
      ...state.activeRumors,
      { day: state.day, text: `📍 ${message}` },
    ],
  }
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

  const STEP = 10
  const cost = Math.max(5, STEP * 3)
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
