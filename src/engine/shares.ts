import type { GameState, BuildingId, GameEvent, OwnedBuilding, GuildId } from './types'
import { getRival, updateRival } from './types'
import buildingDefs from '../data/buildings.json'

const SHARE_STEP = 10 // percent per transaction

function getBuildingDef(id: BuildingId) {
  return (buildingDefs as any[]).find(b => b.id === id)!
}

function getGuild(state: GameState, guildId: GuildId) {
  if (guildId === 'player') return state.player
  return getRival(state, guildId)
}

function buildingCurrentYield(state: GameState, guildId: GuildId, instanceId: string): number {
  const guild = getGuild(state, guildId)
  const building = guild.buildings.find(b => b.instanceId === instanceId)
  if (!building) return 0
  const def = getBuildingDef(building.defId)
  // Yield = production per day OR gold revenue per day (for Tier 2)
  return def.revenuePerDay ?? def.productionPerDay ?? 0
}

function sharePriceInGold(state: GameState, guildId: GuildId, instanceId: string): number {
  const yieldPerDay = buildingCurrentYield(state, guildId, instanceId)
  // Price per 10% share = yield * 3 (roughly 30 days payback)
  return Math.max(5, Math.round(yieldPerDay * 3))
}

// ─── Player buys a share of a rival's building ───────────────────────────────

export function buyShare(state: GameState, rivalInstanceId: string): GameState {
  // Find which rival owns this building
  const ownerRival = state.rivals.find(r => r.buildings.some(b => b.instanceId === rivalInstanceId))
  if (!ownerRival) return state
  const rivalBuilding = ownerRival.buildings.find(b => b.instanceId === rivalInstanceId)!
  if (rivalBuilding.shares <= 0) return state

  const cost = sharePriceInGold(state, ownerRival.id, rivalInstanceId)
  if (state.player.gold < cost) return state

  const transferredShares = Math.min(SHARE_STEP, rivalBuilding.shares)

  const existingPlayerBuilding = state.player.buildings.find(b => b.instanceId === rivalInstanceId)
  const updatedPlayerBuildings = existingPlayerBuilding
    ? state.player.buildings.map(b =>
        b.instanceId === rivalInstanceId ? { ...b, shares: b.shares + transferredShares } : b
      )
    : [...state.player.buildings, { defId: rivalBuilding.defId, instanceId: rivalInstanceId, shares: transferredShares }]

  const playerShares = (existingPlayerBuilding?.shares ?? 0) + transferredShares
  const controlTransferred = playerShares >= 51

  const updatedRival = {
    ...ownerRival,
    buildings: ownerRival.buildings.map(b =>
      b.instanceId === rivalInstanceId ? { ...b, shares: b.shares - transferredShares } : b
    ),
  }

  const updatedMap = controlTransferred
    ? { nodes: state.map.nodes.map(n => n.buildingInstanceId === rivalInstanceId ? { ...n, ownedBy: 'player' as const } : n) }
    : state.map

  const event: GameEvent = {
    day: state.day,
    actor: 'player',
    type: 'BUY_SHARE',
    payload: { instanceId: rivalInstanceId, defId: rivalBuilding.defId, cost, transferredShares, playerTotalShares: playerShares },
  }

  return {
    ...updateRival({ ...state, player: { ...state.player, gold: state.player.gold - cost, buildings: updatedPlayerBuildings } }, updatedRival),
    map: updatedMap,
    log: [...state.log, event],
  }
}

// (rivalBuyBackShare is handled in ai.ts — shares.ts only exposes player-facing actions)

// ─── Preview helper for UI tooltip ───────────────────────────────────────────

export function previewBuyShare(state: GameState, rivalInstanceId: string) {
  const ownerRival = state.rivals.find(r => r.buildings.some(b => b.instanceId === rivalInstanceId))
  if (!ownerRival) return null
  const rivalBuilding = ownerRival.buildings.find(b => b.instanceId === rivalInstanceId)!

  const cost = sharePriceInGold(state, ownerRival.id, rivalInstanceId)
  const existingPlayerShares = state.player.buildings.find(b => b.instanceId === rivalInstanceId)?.shares ?? 0
  const newPlayerShares = existingPlayerShares + SHARE_STEP
  const def = getBuildingDef(rivalBuilding.defId)
  const yieldPerDay = buildingCurrentYield(state, ownerRival.id, rivalInstanceId)
  const playerCutPerDay = Math.round(yieldPerDay * (SHARE_STEP / 100))
  const controlTransferred = newPlayerShares >= 51

  return {
    cost,
    canAfford: state.player.gold >= cost,
    newPlayerShares,
    playerCutPerDay,
    controlTransferred,
    buildingName: def.name,
    ownerName: ownerRival.name,
    ownerColor: ownerRival.color,
  }
}
