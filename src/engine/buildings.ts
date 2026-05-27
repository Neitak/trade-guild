import type { GameState, BuildingId, GuildState, OwnedBuilding, GameEvent, GuildId } from './types'
import { getRival, updateRival } from './types'
import buildingDefs from '../data/buildings.json'

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

  // Check gold cost (Tier 1)
  if (def.costGold !== undefined && state.player.gold < def.costGold) return state

  // Check resource cost (Tier 2)
  if (def.costResources) {
    for (const [res, qty] of Object.entries(def.costResources)) {
      const have = state.player.inventory[res as keyof typeof state.player.inventory] ?? 0
      if (have < (qty as number)) return state
    }
  }

  const instanceId = makeInstanceId(defId, 'player')
  const newBuilding: OwnedBuilding = { defId, instanceId, shares: 100 }

  // Deduct costs
  let newGold = state.player.gold
  const newInventory = { ...state.player.inventory }

  if (def.costGold !== undefined) newGold -= def.costGold
  if (def.costResources) {
    for (const [res, qty] of Object.entries(def.costResources)) {
      newInventory[res as keyof typeof newInventory] =
        ((newInventory[res as keyof typeof newInventory] as number) ?? 0) - (qty as number)
    }
  }

  const event: GameEvent = {
    day: state.day,
    actor: 'player',
    type: 'BUY_BUILDING',
    payload: { defId, instanceId, costGold: def.costGold, costResources: def.costResources },
  }

  // Add node to map
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

// ─── Rival buys a building (internal) ────────────────────────────────────────

export function rivalBuyBuilding(state: GameState, guildId: GuildId, defId: BuildingId): GameState {
  const def   = getBuildingDef(defId)
  const rival = getRival(state, guildId)

  if (def.costGold !== undefined && rival.gold < def.costGold) return state
  if (def.costResources) {
    for (const [res, qty] of Object.entries(def.costResources)) {
      const have = rival.inventory[res as keyof typeof rival.inventory] ?? 0
      if (have < (qty as number)) return state
    }
  }

  const instanceId = makeInstanceId(defId, guildId)
  const newBuilding: OwnedBuilding = { defId, instanceId, shares: 100 }

  let newGold = rival.gold
  const newInventory = { ...rival.inventory }

  if (def.costGold !== undefined) newGold -= def.costGold
  if (def.costResources) {
    for (const [res, qty] of Object.entries(def.costResources)) {
      newInventory[res as keyof typeof newInventory] =
        ((newInventory[res as keyof typeof newInventory] as number) ?? 0) - (qty as number)
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
export const texBuyBuilding = (s: GameState, d: BuildingId) => rivalBuyBuilding(s, 'tex', d)

// ─── Map placement ────────────────────────────────────────────────────────────

function addBuildingToMap(
  state: GameState,
  defId: BuildingId,
  instanceId: string,
  owner: GuildId
): typeof state.map {
  let assigned = false
  const nodes = state.map.nodes.map(node => {
    if (!assigned && node.buildingDefId === defId && !node.ownedBy) {
      assigned = true
      return { ...node, ownedBy: owner, buildingInstanceId: instanceId }
    }
    return node
  })
  return { nodes }
}

// ─── Production (called at end of day) ───────────────────────────────────────

export function produceResources(state: GameState): GameState {
  let s = state

  // Player buildings
  for (const building of s.player.buildings) {
    const def = getBuildingDef(building.defId)
    if (def.produces && def.productionPerDay > 0) {
      const degradation = building.degradation ?? 0
      const produced = Math.round(def.productionPerDay * (building.shares / 100) * (1 - degradation))
      const event: GameEvent = {
        day: s.day,
        actor: 'player',
        type: 'PRODUCTION',
        payload: { buildingId: building.defId, resource: def.produces, qty: produced, degradation },
      }
      s = {
        ...s,
        player: {
          ...s.player,
          inventory: {
            ...s.player.inventory,
            [def.produces]: (s.player.inventory[def.produces as keyof typeof s.player.inventory] ?? 0) + produced,
          },
        },
        log: [...s.log, event],
      }
    }

    // Tier 2: generate gold revenue
    if (def.revenuePerDay && def.tier === 2) {
      const rev = Math.round(def.revenuePerDay * (building.shares / 100))
      const event: GameEvent = {
        day: s.day,
        actor: 'player',
        type: 'REVENUE',
        payload: { buildingId: building.defId, gold: rev },
      }
      s = {
        ...s,
        player: { ...s.player, gold: s.player.gold + rev },
        log: [...s.log, event],
      }
    }
  }

  // All rivals' buildings
  for (const rival of s.rivals) {
    let updatedRival = { ...rival }
    for (const building of rival.buildings) {
      const def = getBuildingDef(building.defId)
      if (def.produces && def.productionPerDay > 0) {
        const degradation = building.degradation ?? 0
        const produced = Math.round(def.productionPerDay * (building.shares / 100) * (1 - degradation))
        updatedRival = {
          ...updatedRival,
          inventory: {
            ...updatedRival.inventory,
            [def.produces]: (updatedRival.inventory[def.produces as keyof typeof updatedRival.inventory] ?? 0) + produced,
          },
        }
      }
      if (def.revenuePerDay && def.tier === 2) {
        const rev = Math.round(def.revenuePerDay * (building.shares / 100))
        updatedRival = { ...updatedRival, gold: updatedRival.gold + rev }
      }
    }
    if (updatedRival !== rival) s = updateRival(s, updatedRival)
  }

  return s
}
