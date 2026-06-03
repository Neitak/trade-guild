import type { GameState, BuildingId, GuildState, OwnedBuilding, GameEvent, GuildId, ResourceId } from './types'
import { getRival, updateRival, nextAvgCost, ownersOf, casesOwnedBy, operatorOf } from './types'
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
  const newBuilding: OwnedBuilding = { defId, instanceId, cases: ['player', 'player', 'player', 'player'], builtBy: 'player', transferCount: 0, level: 1 }

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
  const newBuilding: OwnedBuilding = { defId, instanceId, cases: [guildId, guildId, guildId, guildId], builtBy: guildId, transferCount: 0, level: 1 }

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

// ─── Production (end of day) — distribuée au prorata des 4 cases ───────────────
//
// V9 : chaque bâtiment est canonique dans le tableau de son BÂTISSEUR, mais sa
// production est répartie entre les propriétaires de cases (`building.cases`).
// L'OPÉRATEUR (= propriétaire majoritaire) paie les intrants des ateliers ; les
// autres co-propriétaires skimment gratuitement. Si l'opérateur ne peut pas payer
// l'intrant, le bâtiment ne produit rien ce jour (jauge gelée).

export function produceResources(state: GameState): GameState {
  let s = state
  // Itère sur les bâtiments de chaque guilde (chacun est canonique chez son bâtisseur).
  const guildIds: GuildId[] = ['player', ...s.rivals.map(r => r.id)]
  for (const gid of guildIds) {
    const owner = gid === 'player' ? s.player : getRival(s, gid)
    for (const building of owner.buildings) {
      s = applyBuildingProduction(s, building)
    }
  }
  return s
}

// ─── Helpers d'écriture immuable par guilde ───────────────────────────────────

function addInventory(state: GameState, guildId: GuildId, resId: ResourceId, qty: number): GameState {
  if (qty === 0) return state
  const isPlayer = guildId === 'player'
  const guild = isPlayer ? state.player : getRival(state, guildId)
  const updated = {
    ...guild,
    inventory: { ...guild.inventory, [resId]: (guild.inventory[resId] ?? 0) + qty },
    // production = gratuite (coût 0) → tire le coût moyen vers le bas
    inventoryAvgCost: {
      ...(guild.inventoryAvgCost ?? {}),
      [resId]: nextAvgCost(guild.inventoryAvgCost?.[resId] ?? 0, guild.inventory[resId] ?? 0, qty, 0),
    },
  }
  return isPlayer ? { ...state, player: updated as typeof state.player } : updateRival(state, updated)
}

function addGold(state: GameState, guildId: GuildId, amount: number): GameState {
  if (amount === 0) return state
  const isPlayer = guildId === 'player'
  const guild = isPlayer ? state.player : getRival(state, guildId)
  const updated = { ...guild, gold: guild.gold + amount }
  return isPlayer ? { ...state, player: updated as typeof state.player } : updateRival(state, updated)
}

/**
 * Répartit `total` unités entre les propriétaires de cases (prorata) via la
 * méthode du plus grand reste → conserve le total EXACT, pas d'inflation au split.
 */
function splitProrata(total: number, building: OwnedBuilding): Map<GuildId, number> {
  const result = new Map<GuildId, number>()
  const remainders: { g: GuildId; r: number }[] = []
  let assigned = 0
  for (const g of ownersOf(building)) {
    const exact = (total * casesOwnedBy(building, g)) / 4
    const fl = Math.floor(exact)
    result.set(g, fl)
    assigned += fl
    remainders.push({ g, r: exact - fl })
  }
  let leftover = total - assigned
  remainders.sort((a, b) => b.r - a.r)
  for (let i = 0; i < remainders.length && leftover > 0; i++) {
    result.set(remainders[i].g, (result.get(remainders[i].g) ?? 0) + 1)
    leftover--
  }
  return result
}

function applyBuildingProduction(state: GameState, building: OwnedBuilding): GameState {
  const def = getBuildingDef(building.defId)
  let s = state

  // ── Atelier (intrant → produit) : l'OPÉRATEUR paie l'intrant ───────────────
  if (def.autoConsumeInput && def.produces) {
    const inputId = def.autoConsumeInput as ResourceId
    const inputQty = (def.autoConsumeQty as number) ?? 1
    const outputId = def.produces as ResourceId
    const outputTotal = Math.round(def.productionPerDay as number)
    if (outputTotal <= 0) return s

    const operator = operatorOf(building)
    const opGuild = operator === 'player' ? s.player : getRival(s, operator)
    const haveInput = opGuild.inventory[inputId] ?? 0

    if (haveInput >= inputQty) {
      // L'opérateur paie l'intrant depuis son stock
      s = addInventory(s, operator, inputId, -inputQty)
    } else {
      // Sinon l'opérateur tente d'acheter l'intrant au marché
      const marketEntry = s.market.resources[inputId]
      const cost = inputQty * marketEntry.currentPrice
      if (opGuild.gold < cost || marketEntry.volumeAvailable < inputQty) {
        return s // jauge gelée : l'opérateur ne peut pas payer → aucune production
      }
      const newPrice = marketEntry.currentPrice * (1 + marketEntry.elasticityK * (inputQty / Math.max(marketEntry.volumeAvailable, 1)))
      s = addGold(s, operator, -cost)
      s = {
        ...s,
        market: {
          resources: {
            ...s.market.resources,
            [inputId]: { ...marketEntry, currentPrice: newPrice, volumeAvailable: marketEntry.volumeAvailable - inputQty },
          },
        },
      }
    }

    // Distribution du produit au prorata des cases
    const split = splitProrata(outputTotal, building)
    for (const [g, qty] of split) {
      if (qty <= 0) continue
      s = addInventory(s, g, outputId, qty)
      s = { ...s, log: [...s.log, { day: s.day, actor: g, type: 'PRODUCTION', payload: { buildingId: building.defId, resource: outputId, qty } }] }
    }
    return s
  }

  // ── Producteur Tier 1 (pas d'intrant) — production gratuite, prorata ───────
  if (def.produces && def.productionPerDay > 0) {
    const degradation = building.degradation ?? 0
    const level = building.level ?? 1
    const levelBonus = def.upgradable ? (SAWMILL_PRODUCTION[level] / SAWMILL_PRODUCTION[1]) : 1
    const total = Math.round(def.productionPerDay * levelBonus * (1 - degradation))
    const prodId = def.produces as ResourceId

    const split = splitProrata(total, building)
    for (const [g, qty] of split) {
      if (qty <= 0) continue
      s = addInventory(s, g, prodId, qty)
      s = { ...s, log: [...s.log, { day: s.day, actor: g, type: 'PRODUCTION', payload: { buildingId: building.defId, resource: prodId, qty, degradation, level } }] }
    }
  }

  // ── Revenu Tier 2/3 (or/jour) — réparti au prorata des cases ───────────────
  if (def.revenuePerDay) {
    const level = building.level ?? 1
    const baseRev = def.upgradeRevenues ? (def.upgradeRevenues[String(level)] ?? def.revenuePerDay) : def.revenuePerDay
    const totalRev = Math.round(baseRev)
    const split = splitProrata(totalRev, building)
    for (const [g, gold] of split) {
      if (gold <= 0) continue
      s = addGold(s, g, gold)
      s = { ...s, log: [...s.log, { day: s.day, actor: g, type: 'REVENUE', payload: { buildingId: building.defId, gold } }] }
    }
  }

  return s
}
