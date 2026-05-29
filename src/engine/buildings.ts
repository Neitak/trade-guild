import type { GameState, BuildingId, GuildState, OwnedBuilding, GameEvent, GuildId, ResourceId } from './types'
import { getRival, updateRival } from './types'
import buildingDefs from '../data/buildings.json'

// ─── Sawmill upgrade table ────────────────────────────────────────────────────
export const SAWMILL_PRODUCTION: Record<number, number> = { 1: 8, 2: 16, 3: 32, 4: 64, 5: 128 }
const SAWMILL_UPGRADE_COST: Record<number, number> = { 1: 25, 2: 50, 3: 100, 4: 200 }

// ─── Auberge upgrade table (CONFORT — meubles) ────────────────────────────────
export const AUBERGE_REVENUE: Record<number, number> = { 1: 20, 2: 35, 3: 55, 4: 80, 5: 110 }
export const AUBERGE_UPGRADE_COST: Record<number, number> = { 1: 10, 2: 20, 3: 35, 4: 50 }

function getBuildingDef(id: BuildingId) {
  const def = (buildingDefs as any[]).find(b => b.id === id)
  if (!def) throw new Error(`Unknown building: ${id}`)
  return def
}

function makeInstanceId(defId: BuildingId, guildId: string): string {
  return `${guildId}_${defId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// ─── Player buys a building ───────────────────────────────────────────────────

export function buyBuilding(state: GameState, defId: BuildingId): GameState {
  const def = getBuildingDef(defId)

  if (def.costGold !== undefined && state.player.gold < def.costGold) return state

  if (def.costResources) {
    for (const [res, qty] of Object.entries(def.costResources)) {
      const have = state.player.inventory[res as ResourceId] ?? 0
      if (have < (qty as number)) return state
    }
  }

  const instanceId = makeInstanceId(defId, 'player')
  const newBuilding: OwnedBuilding = { defId, instanceId, shares: 100, level: 1 }

  let newGold = state.player.gold
  const newInventory = { ...state.player.inventory }

  if (def.costGold !== undefined) newGold -= def.costGold
  if (def.costResources) {
    for (const [res, qty] of Object.entries(def.costResources)) {
      newInventory[res as ResourceId] = ((newInventory[res as ResourceId] ?? 0)) - (qty as number)
    }
  }

  const event: GameEvent = {
    day: state.day,
    actor: 'player',
    type: 'BUY_BUILDING',
    payload: { defId, instanceId, costGold: def.costGold, costResources: def.costResources },
  }

  const newMap = addBuildingToMap(state, defId, instanceId, 'player')

  return {
    ...state,
    player: {
      ...state.player,
      gold: newGold,
      inventory: newInventory,
      buildings: [...state.player.buildings, newBuilding],
    },
    map: newMap,
    log: [...state.log, event],
  }
}

// ─── Player upgrades a building (sawmill: gold / auberge: meubles) ───────────

export function upgradeBuilding(state: GameState, instanceId: string): GameState {
  const building = state.player.buildings.find(b => b.instanceId === instanceId)
  if (!building) return state
  const def = getBuildingDef(building.defId)
  if (!def.upgradable) return state

  const currentLevel = building.level ?? 1
  const maxLevel = def.maxLevel ?? 5
  if (currentLevel >= maxLevel) return state

  // CONFORT-based upgrade (e.g. auberge uses meubles)
  if (def.upgradeResourceId && def.upgradeResourceCosts) {
    const resCost = def.upgradeResourceCosts[String(currentLevel)] ?? 999
    const resourceId = def.upgradeResourceId as ResourceId
    if ((state.player.inventory[resourceId] ?? 0) < resCost) return state

    const event: GameEvent = {
      day: state.day,
      actor: 'player',
      type: 'UPGRADE_BUILDING',
      payload: { instanceId, defId: building.defId, fromLevel: currentLevel, toLevel: currentLevel + 1, resourceId, resCost },
    }
    return {
      ...state,
      player: {
        ...state.player,
        inventory: { ...state.player.inventory, [resourceId]: (state.player.inventory[resourceId] ?? 0) - resCost },
        buildings: state.player.buildings.map(b =>
          b.instanceId === instanceId ? { ...b, level: currentLevel + 1 } : b
        ),
      },
      log: [...state.log, event],
    }
  }

  // Gold-based upgrade (sawmill)
  const cost = SAWMILL_UPGRADE_COST[currentLevel]
  if (state.player.gold < cost) return state

  const event: GameEvent = {
    day: state.day,
    actor: 'player',
    type: 'UPGRADE_BUILDING',
    payload: { instanceId, defId: building.defId, fromLevel: currentLevel, toLevel: currentLevel + 1, cost },
  }
  return {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold - cost,
      buildings: state.player.buildings.map(b =>
        b.instanceId === instanceId ? { ...b, level: currentLevel + 1 } : b
      ),
    },
    log: [...state.log, event],
  }
}

// ─── Rival upgrades a building ────────────────────────────────────────────────

export function upgradeBuildingRival(state: GameState, guildId: GuildId, instanceId: string): GameState {
  const rival = getRival(state, guildId)
  const building = rival.buildings.find(b => b.instanceId === instanceId)
  if (!building) return state
  const def = getBuildingDef(building.defId)
  if (!def.upgradable) return state

  const currentLevel = building.level ?? 1
  const maxLevel = def.maxLevel ?? 5
  if (currentLevel >= maxLevel) return state

  // CONFORT-based upgrade
  if (def.upgradeResourceId && def.upgradeResourceCosts) {
    const resCost = def.upgradeResourceCosts[String(currentLevel)] ?? 999
    const resourceId = def.upgradeResourceId as ResourceId
    if ((rival.inventory[resourceId] ?? 0) < resCost) return state

    const event: GameEvent = {
      day: state.day,
      actor: guildId,
      type: 'UPGRADE_BUILDING',
      payload: { instanceId, defId: building.defId, fromLevel: currentLevel, toLevel: currentLevel + 1, resourceId, resCost },
    }
    const updatedRival = {
      ...rival,
      inventory: { ...rival.inventory, [resourceId]: (rival.inventory[resourceId] ?? 0) - resCost },
      buildings: rival.buildings.map(b =>
        b.instanceId === instanceId ? { ...b, level: currentLevel + 1 } : b
      ),
    }
    return { ...updateRival(state, updatedRival), log: [...state.log, event] }
  }

  // Gold-based upgrade (sawmill)
  const cost = SAWMILL_UPGRADE_COST[currentLevel]
  if (rival.gold < cost) return state

  const event: GameEvent = {
    day: state.day,
    actor: guildId,
    type: 'UPGRADE_BUILDING',
    payload: { instanceId, defId: building.defId, fromLevel: currentLevel, toLevel: currentLevel + 1, cost },
  }
  const updatedRival = {
    ...rival,
    gold: rival.gold - cost,
    buildings: rival.buildings.map(b =>
      b.instanceId === instanceId ? { ...b, level: currentLevel + 1 } : b
    ),
  }
  return { ...updateRival(state, updatedRival), log: [...state.log, event] }
}

// ─── Rival buys a building ────────────────────────────────────────────────────

export function rivalBuyBuilding(state: GameState, guildId: GuildId, defId: BuildingId): GameState {
  const def = getBuildingDef(defId)
  const rival = getRival(state, guildId)

  if (def.costGold !== undefined && rival.gold < def.costGold) return state
  if (def.costResources) {
    for (const [res, qty] of Object.entries(def.costResources)) {
      const have = rival.inventory[res as ResourceId] ?? 0
      if (have < (qty as number)) return state
    }
  }

  const instanceId = makeInstanceId(defId, guildId)
  const newBuilding: OwnedBuilding = { defId, instanceId, shares: 100, level: 1 }

  let newGold = rival.gold
  const newInventory = { ...rival.inventory }

  if (def.costGold !== undefined) newGold -= def.costGold
  if (def.costResources) {
    for (const [res, qty] of Object.entries(def.costResources)) {
      newInventory[res as ResourceId] = ((newInventory[res as ResourceId] ?? 0)) - (qty as number)
    }
  }

  const event: GameEvent = {
    day: state.day,
    actor: guildId,
    type: 'BUY_BUILDING',
    payload: { defId, instanceId, costGold: def.costGold, costResources: def.costResources },
  }

  const updatedRival: GuildState = { ...rival, gold: newGold, inventory: newInventory, buildings: [...rival.buildings, newBuilding] }
  const newMap = addBuildingToMap(state, defId, instanceId, guildId)

  return {
    ...updateRival(state, updatedRival),
    map: newMap,
    log: [...state.log, event],
  }
}

/** @deprecated use rivalBuyBuilding */
export const texBuyBuilding = (s: GameState, d: BuildingId) => rivalBuyBuilding(s, 'brice', d)

// ─── Map placement ────────────────────────────────────────────────────────────

function addBuildingToMap(
  state: GameState,
  defId: BuildingId,
  instanceId: string,
  owner: GuildId
): typeof state.map {
  const def = (buildingDefs as any[]).find(b => b.id === defId)
  const slotType = def?.slotType
  let assigned = false
  const nodes = state.map.nodes.map(node => {
    if (!assigned && slotType && node.slotType === slotType && !node.ownedBy && !node.locked) {
      assigned = true
      return { ...node, ownedBy: owner, buildingInstanceId: instanceId }
    }
    return node
  })
  return { nodes }
}

// ─── Production (end of day) ──────────────────────────────────────────────────

export function produceResources(state: GameState): GameState {
  let s = state

  s = applyGuildProduction(s, 'player')

  for (const rival of s.rivals) {
    s = applyGuildProduction(s, rival.id)
  }

  return s
}

function applyGuildProduction(state: GameState, guildId: GuildId): GameState {
  const isPlayer = guildId === 'player'
  const guild = isPlayer ? state.player : getRival(state, guildId)
  let s = state

  for (const building of guild.buildings) {
    const def = getBuildingDef(building.defId)

    // ── Atelier auto-consume (e.g. Charpenterie: wood → meuble) ──────────────
    if (def.autoConsumeInput && def.produces) {
      s = applyAtelierProduction(s, guildId, building, def)
      continue
    }

    // ── Standard Tier 1 producer ──────────────────────────────────────────────
    if (def.produces && def.productionPerDay > 0) {
      const degradation = building.degradation ?? 0
      const level = building.level ?? 1
      const levelBonus = def.upgradable ? (SAWMILL_PRODUCTION[level] / SAWMILL_PRODUCTION[1]) : 1
      const produced = Math.round(def.productionPerDay * levelBonus * (building.shares / 100) * (1 - degradation))

      const event: GameEvent = {
        day: s.day,
        actor: guildId,
        type: 'PRODUCTION',
        payload: { buildingId: building.defId, resource: def.produces, qty: produced, degradation, level },
      }

      const currentGuild = isPlayer ? s.player : getRival(s, guildId)
      const updatedGuild = {
        ...currentGuild,
        inventory: {
          ...currentGuild.inventory,
          [def.produces]: (currentGuild.inventory[def.produces as ResourceId] ?? 0) + produced,
        },
      }

      s = isPlayer
        ? { ...s, player: updatedGuild as typeof s.player, log: [...s.log, event] }
        : { ...updateRival(s, updatedGuild), log: [...s.log, event] }
    }

    // ── Tier 2/3 revenue (Tier 3 uses level table) ───────────────────────────
    if (def.revenuePerDay) {
      const level = building.level ?? 1
      const baseRev = def.upgradeRevenues ? (def.upgradeRevenues[String(level)] ?? def.revenuePerDay) : def.revenuePerDay
      const rev = Math.round(baseRev * (building.shares / 100))
      const event: GameEvent = {
        day: s.day,
        actor: guildId,
        type: 'REVENUE',
        payload: { buildingId: building.defId, gold: rev },
      }

      const currentGuild = isPlayer ? s.player : getRival(s, guildId)
      const updatedGuild = { ...currentGuild, gold: currentGuild.gold + rev }

      s = isPlayer
        ? { ...s, player: updatedGuild as typeof s.player, log: [...s.log, event] }
        : { ...updateRival(s, updatedGuild), log: [...s.log, event] }
    }
  }

  return s
}

// ─── Atelier production (auto-consume input → produce output) ─────────────────
// Priority: inventory first, then buy from market, else stop.

function applyAtelierProduction(
  state: GameState,
  guildId: GuildId,
  building: OwnedBuilding,
  def: any
): GameState {
  const isPlayer = guildId === 'player'
  const inputId = def.autoConsumeInput as ResourceId
  const inputQty = (def.autoConsumeQty as number) ?? 1
  const outputId = def.produces as ResourceId
  const outputQty = Math.round((def.productionPerDay as number) * (building.shares / 100))

  if (outputQty <= 0) return state

  const guild = isPlayer ? state.player : getRival(state, guildId)
  const haveInput = guild.inventory[inputId] ?? 0

  let s = state

  if (haveInput >= inputQty) {
    // Consume from inventory — free run
    const updatedGuild = {
      ...guild,
      inventory: {
        ...guild.inventory,
        [inputId]: haveInput - inputQty,
        [outputId]: (guild.inventory[outputId] ?? 0) + outputQty,
      },
    }
    s = isPlayer
      ? { ...s, player: updatedGuild as typeof s.player }
      : updateRival(s, updatedGuild)
  } else {
    // Try to buy input from market
    const marketEntry = s.market.resources[inputId]
    if (!marketEntry) return state

    const cost = inputQty * marketEntry.currentPrice
    const canAfford = guild.gold >= cost && marketEntry.volumeAvailable >= inputQty

    if (canAfford) {
      const newPrice = marketEntry.currentPrice * (1 + marketEntry.elasticityK * (inputQty / Math.max(marketEntry.volumeAvailable, 1)))
      const updatedGuild = {
        ...guild,
        gold: guild.gold - cost,
        inventory: {
          ...guild.inventory,
          [outputId]: (guild.inventory[outputId] ?? 0) + outputQty,
        },
      }
      s = isPlayer
        ? { ...s, player: updatedGuild as typeof s.player }
        : updateRival(s, updatedGuild)
      s = {
        ...s,
        market: {
          resources: {
            ...s.market.resources,
            [inputId]: {
              ...marketEntry,
              currentPrice: newPrice,
              volumeAvailable: marketEntry.volumeAvailable - inputQty,
            },
          },
        },
      }
    }
    // else: Atelier stops cleanly — no output, no debt
  }

  return s
}
