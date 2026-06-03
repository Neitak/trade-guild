import type { GameState, BuildingId, ResourceId, WonderId, GuildId, RivalStrategy } from './types'
import { getRival, updateRival } from './types'
import { rivalBuyFromMarket, rivalSellToMarket } from './market'
import { rivalBuyBuilding, upgradeBuildingRival } from './buildings'
import { rivalShareDecisions } from './shares'

// ─── Generic rival decision tree ─────────────────────────────────────────────

export function runRivalAI(state: GameState, guildId: GuildId): GameState {
  let s = state
  const strategy = s.rivalStrategies[guildId]
  if (!strategy) return s

  if (strategy.preferredResource === 'huile') {
    s = runHuileStrategy(s, guildId)
  } else {
    s = runWoodStrategy(s, guildId)
  }

  // V9 — décisions de rachat de parts (symétrique : pille joueur ET autres rivaux, avec grâce)
  s = rivalShareDecisions(s, guildId)

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

// ─── Wood filière + Pump & Dump (Brice) ──────────────────────────────────────

function runWoodStrategy(state: GameState, guildId: GuildId): GameState {
  let s = state
  const rival = () => getRival(s, guildId)

  // ── Buy sawmill (costs 10 wood) ──────────────────────────────────────────
  const hasSawmill = rival().buildings.some(b => b.defId === 'sawmill')
  const wood = rival().inventory['wood'] ?? 0
  if (!hasSawmill) {
    // Accumulate 10 wood first
    if (wood < 10 && rival().gold >= 10) {
      const need = 10 - wood
      const qty = Math.min(need, s.market.resources['wood'].volumeAvailable, Math.floor(rival().gold * 0.15))
      if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'wood', qty)
    }
    if ((rival().inventory['wood'] ?? 0) >= 10) {
      s = rivalBuyBuilding(s, guildId, 'sawmill')
      s = unlockNodeImmediate(s, 'extraction_slot_2',
        `Les bûcherons affluent — la Forêt des Hauteurs est désormais disponible.`)
    }
  }

  // ── Upgrade sawmill ──────────────────────────────────────────────────────
  if (hasSawmill && s.day >= 5) {
    const sawmill = rival().buildings.find(b => b.defId === 'sawmill')
    if (sawmill) {
      const level = sawmill.level ?? 1
      const upgradeCosts: Record<number, number> = { 1: 25, 2: 50, 3: 100, 4: 200 }
      if (level < 5 && rival().gold >= (upgradeCosts[level] ?? 999) && s.day % 4 === 0) {
        s = upgradeBuildingRival(s, guildId, sawmill.instanceId)
      }
    }
  }

  // ── Accumulate wood for menuiserie ───────────────────────────────────────
  const hasMenuiserie = rival().buildings.some(b => b.defId === 'menuiserie')
  const woodNow = rival().inventory['wood'] ?? 0
  if (hasSawmill && !hasMenuiserie && woodNow < 80 && rival().gold > 60) {
    const need = 80 - woodNow
    const qty = Math.min(need, 8, s.market.resources['wood'].volumeAvailable, Math.floor(rival().gold * 0.05))
    if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'wood', qty)
  }
  if (hasSawmill && !hasMenuiserie && (rival().inventory['wood'] ?? 0) >= 80) {
    s = rivalBuyBuilding(s, guildId, 'menuiserie')
  }

  // ── Pump & Dump — after menuiserie established ───────────────────────────
  if (hasMenuiserie && s.day > 10) {
    s = runPumpDump(s, guildId)
    return s
  }

  // ── Normal profit-taking ─────────────────────────────────────────────────
  const woodMarket = s.market.resources['wood']
  if (woodMarket.currentPrice > woodMarket.equilibriumPrice * 1.10 && woodNow > 15) {
    const qty = Math.floor(woodNow * 0.4)
    if (qty > 0) s = rivalSellToMarket(s, guildId, 'wood', qty)
  }

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

  if (s.day < cooldownDay) return s

  if (phase === 'idle') {
    if (woodMarket.currentPrice < woodMarket.equilibriumPrice * 1.08 && rival().gold >= 50) {
      const qty = Math.min(30, woodMarket.volumeAvailable, Math.floor(rival().gold * 0.55))
      if (qty >= 8) {
        s = rivalBuyFromMarket(s, guildId, 'wood', qty)
        s = setStrategy(s, guildId, { pumpPhase: 'pumping', pumpStartDay: s.day })
      }
    }
  } else if (phase === 'pumping') {
    if (woodMarket.currentPrice < woodMarket.equilibriumPrice * 1.30 && rival().gold >= 25) {
      const qty = Math.min(20, woodMarket.volumeAvailable, Math.floor(rival().gold * 0.40))
      if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'wood', qty)
    }
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
    const toDump = Math.floor(woodNow * 0.85)
    if (toDump > 0) s = rivalSellToMarket(s, guildId, 'wood', toDump)
    s = setStrategy(s, guildId, {
      pumpPhase: 'idle',
      pumpCooldownDay: s.day + 5 + Math.floor(Math.random() * 4),
    })
    s = tryContributeWonder(s, guildId, 'grande_cathedrale', 'wood', 20, 10)
  }

  return s
}

// ─── Huile filière (Raph) ─────────────────────────────────────────────────────
// Phase 1 — achète une Oliveraie (farm_slot)
// Phase 2 — accumule olives, vend au bon moment
// Phase 3 — accumule 80 olives pour acheter la Presse
// Phase 4 — vend huile au bon moment, cible l'Auberge

function runHuileStrategy(state: GameState, guildId: GuildId): GameState {
  let s = state
  const rival = () => getRival(s, guildId)

  const hasOlivery  = rival().buildings.some(b => b.defId === 'olivery')
  const hasPress    = rival().buildings.some(b => b.defId === 'press')
  const olives      = rival().inventory['olive'] ?? 0
  const huile       = rival().inventory['huile'] ?? 0
  const oliveMarket = s.market.resources['olive']
  const huileMarket = s.market.resources['huile']

  // ── Phase 1 : achète une Oliveraie ───────────────────────────────────────
  if (!hasOlivery && rival().gold >= 10) {
    s = rivalBuyBuilding(s, guildId, 'olivery')
  }

  // ── Phase 2 : accumule olives pour la Presse (coût 80 olives) ────────────
  if (hasOlivery && !hasPress && olives < 80 && rival().gold > 30) {
    const need = 80 - olives
    const qty = Math.min(need, 10, oliveMarket.volumeAvailable, Math.floor(rival().gold * 0.10))
    if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'olive', qty)
  }

  // ── Phase 3 : achète la Presse quand 80 olives ───────────────────────────
  if (hasOlivery && !hasPress && olives >= 80) {
    s = rivalBuyBuilding(s, guildId, 'press')
  }

  // ── Profit-taking : vend olives en surplus ────────────────────────────────
  if (hasOlivery && olives > 20 && oliveMarket.currentPrice > oliveMarket.equilibriumPrice * 1.15) {
    const qty = Math.floor(olives * 0.40)
    if (qty > 0) s = rivalSellToMarket(s, guildId, 'olive', qty)
  }

  // ── Profit-taking : vend huile ────────────────────────────────────────────
  if (hasPress && huile > 3 && huileMarket.currentPrice > huileMarket.equilibriumPrice * 1.10) {
    const qty = Math.floor(huile * 0.50)
    if (qty > 0) s = rivalSellToMarket(s, guildId, 'huile', qty)
  }

  // ── Phase 4 : accumule bois + huile pour l'Auberge ───────────────────────
  const hasAuberge = rival().buildings.some(b => b.defId === 'auberge')
  if (hasPress && !hasAuberge) {
    const huileStock = rival().inventory['huile'] ?? 0
    const woodStock  = rival().inventory['wood'] ?? 0
    if (huileStock < 10 && rival().gold > 30) {
      const qty = Math.min(10 - huileStock, huileMarket.volumeAvailable, Math.floor(rival().gold * 0.15))
      if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'huile', qty)
    }
    if (woodStock < 20 && rival().gold > 30) {
      const qty = Math.min(20 - woodStock, s.market.resources['wood'].volumeAvailable, Math.floor(rival().gold * 0.10))
      if (qty > 0) s = rivalBuyFromMarket(s, guildId, 'wood', qty)
    }
    if (rival().gold >= 40 && (rival().inventory['wood'] ?? 0) >= 20 && (rival().inventory['huile'] ?? 0) >= 10) {
      s = rivalBuyBuilding(s, guildId, 'auberge')
    }
  }

  // ── Upgrade auberge avec meubles ─────────────────────────────────────────
  if (hasAuberge) {
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

