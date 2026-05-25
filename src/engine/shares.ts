import type { GameState, BuildingId, GameEvent, OwnedBuilding } from './types'
import buildingDefs from '../data/buildings.json'

const SHARE_STEP = 10 // percent per transaction

function getBuildingDef(id: BuildingId) {
  return (buildingDefs as any[]).find(b => b.id === id)!
}

function buildingCurrentYield(state: GameState, guildId: 'player' | 'tex', instanceId: string): number {
  const guild = guildId === 'player' ? state.player : state.tex
  const building = guild.buildings.find(b => b.instanceId === instanceId)
  if (!building) return 0
  const def = getBuildingDef(building.defId)
  // Yield = production per day OR gold revenue per day (for Tier 2)
  return def.revenuePerDay ?? def.productionPerDay ?? 0
}

function sharePriceInGold(state: GameState, guildId: 'player' | 'tex', instanceId: string): number {
  const yieldPerDay = buildingCurrentYield(state, guildId, instanceId)
  // Price per 10% share = yield * 3 (roughly 30 days payback)
  return Math.max(5, Math.round(yieldPerDay * 3))
}

// ─── Player buys a share of Tex's building ───────────────────────────────────

export function buyShare(state: GameState, texInstanceId: string): GameState {
  const texBuilding = state.tex.buildings.find(b => b.instanceId === texInstanceId)
  if (!texBuilding) return state
  if (texBuilding.shares <= 0) return state // Tex has nothing left to sell

  const cost = sharePriceInGold(state, 'tex', texInstanceId)
  if (state.player.gold < cost) return state

  const transferredShares = Math.min(SHARE_STEP, texBuilding.shares)

  // Find or create player's ownership of this building
  const existingPlayerBuilding = state.player.buildings.find(
    b => b.instanceId === texInstanceId
  )

  const updatedPlayerBuildings = existingPlayerBuilding
    ? state.player.buildings.map(b =>
        b.instanceId === texInstanceId
          ? { ...b, shares: b.shares + transferredShares }
          : b
      )
    : [
        ...state.player.buildings,
        { defId: texBuilding.defId, instanceId: texInstanceId, shares: transferredShares },
      ]

  const updatedTexBuildings = state.tex.buildings.map(b =>
    b.instanceId === texInstanceId
      ? { ...b, shares: b.shares - transferredShares }
      : b
  )

  const playerShares =
    (existingPlayerBuilding?.shares ?? 0) + transferredShares

  const event: GameEvent = {
    day: state.day,
    actor: 'player',
    type: 'BUY_SHARE',
    payload: {
      instanceId: texInstanceId,
      defId: texBuilding.defId,
      cost,
      transferredShares,
      playerTotalShares: playerShares,
    },
  }

  return {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold - cost,
      buildings: updatedPlayerBuildings,
    },
    tex: {
      ...state.tex,
      buildings: updatedTexBuildings,
    },
    log: [...state.log, event],
  }
}

// ─── Tex buys back a share of his own building ───────────────────────────────

export function texBuyBackShare(state: GameState, instanceId: string): GameState {
  const playerBuilding = state.player.buildings.find(b => b.instanceId === instanceId)
  if (!playerBuilding || playerBuilding.shares <= 0) return state

  const cost = sharePriceInGold(state, 'player', instanceId)
  if (state.tex.gold < cost) return state

  const transferredShares = Math.min(SHARE_STEP, playerBuilding.shares)

  const updatedPlayerBuildings = state.player.buildings
    .map(b =>
      b.instanceId === instanceId
        ? { ...b, shares: b.shares - transferredShares }
        : b
    )
    .filter(b => b.shares > 0)

  const updatedTexBuildings = state.tex.buildings.map(b =>
    b.instanceId === instanceId
      ? { ...b, shares: b.shares + transferredShares }
      : b
  )

  const event: GameEvent = {
    day: state.day,
    actor: 'tex',
    type: 'SELL_SHARE',
    payload: { instanceId, transferredShares, cost },
  }

  return {
    ...state,
    tex: {
      ...state.tex,
      gold: state.tex.gold - cost,
      buildings: updatedTexBuildings,
    },
    player: {
      ...state.player,
      buildings: updatedPlayerBuildings,
    },
    log: [...state.log, event],
  }
}

// ─── Preview helper for UI tooltip ───────────────────────────────────────────

export function previewBuyShare(state: GameState, texInstanceId: string) {
  const texBuilding = state.tex.buildings.find(b => b.instanceId === texInstanceId)
  if (!texBuilding) return null

  const cost = sharePriceInGold(state, 'tex', texInstanceId)
  const existingPlayerShares =
    state.player.buildings.find(b => b.instanceId === texInstanceId)?.shares ?? 0
  const newPlayerShares = existingPlayerShares + SHARE_STEP
  const def = getBuildingDef(texBuilding.defId)
  const yieldPerDay = buildingCurrentYield(state, 'tex', texInstanceId)
  const playerCutPerDay = Math.round(yieldPerDay * (SHARE_STEP / 100))
  const controlTransferred = newPlayerShares >= 51

  return {
    cost,
    canAfford: state.player.gold >= cost,
    newPlayerShares,
    playerCutPerDay,
    controlTransferred,
    buildingName: def.name,
  }
}
