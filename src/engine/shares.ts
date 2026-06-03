import type { GameState, BuildingId, GameEvent, OwnedBuilding, GuildId } from './types'
import { getRival, updateRival, casesOwnedBy, operatorOf, sharePct } from './types'
import { SAWMILL_PRODUCTION } from './buildings'
import buildingDefs from '../data/buildings.json'

// ─── Tuning (placeholders — voir project-shares-4bars-schema.md) ──────────────
export const SHARE_CASE_PCT = 25          // une case = 25 %
export const PRICE_MULT_DAYS = 12         // prix d'une case ≈ 12 jours de revenu × 25 %
export const TRANSFER_SURCHARGE = 1.5     // surenchère ×1.5 par changement de main

function getBuildingDef(id: BuildingId) {
  return (buildingDefs as any[]).find(b => b.id === id)!
}

function getGuild(state: GameState, guildId: GuildId) {
  return guildId === 'player' ? state.player : getRival(state, guildId)
}

// Localise le bâtiment canonique (dans le tableau de son bâtisseur) + sa guilde hôte.
function findBuilding(state: GameState, instanceId: string): { building: OwnedBuilding; hostId: GuildId } | null {
  const all: { g: GuildId; list: OwnedBuilding[] }[] = [
    { g: 'player', list: state.player.buildings },
    ...state.rivals.map(r => ({ g: r.id, list: r.buildings })),
  ]
  for (const { g, list } of all) {
    const b = list.find(x => x.instanceId === instanceId)
    if (b) return { building: b, hostId: g }
  }
  return null
}

// Valeur or/jour d'un bâtiment (revenu direct, ou production × prix marché).
// Reflète le niveau ET la dégradation, comme `applyBuildingProduction` (buildings.ts),
// sinon les parts d'un extracteur amélioré seraient massivement sous-évaluées.
function buildingDailyGoldValue(state: GameState, building: OwnedBuilding): number {
  const def = getBuildingDef(building.defId)
  const level = building.level ?? 1
  if (def.revenuePerDay) {
    return def.upgradeRevenues ? (def.upgradeRevenues[String(level)] ?? def.revenuePerDay) : def.revenuePerDay
  }
  if (def.produces) {
    const mkt = state.market.resources[def.produces as keyof typeof state.market.resources]
    const degradation = building.degradation ?? 0
    const levelBonus = def.upgradable ? (SAWMILL_PRODUCTION[level] / SAWMILL_PRODUCTION[1]) : 1
    const effectiveProd = (def.productionPerDay ?? 0) * levelBonus * (1 - degradation)
    return effectiveProd * (mkt?.currentPrice ?? 0)
  }
  return 0
}

// Valeur d'actif des parts détenues par une guilde sur TOUT le plateau (or).
// Sert au net worth : on capitalise le revenu/jour des cases possédées (PRICE_MULT_DAYS),
// SANS la surcharge de transfert (= prime de transaction, pas une valeur intrinsèque).
export function shareAssetValue(state: GameState, guildId: GuildId): number {
  const all: OwnedBuilding[] = [
    ...state.player.buildings,
    ...state.rivals.flatMap(r => r.buildings),
  ]
  let total = 0
  for (const b of all) {
    const cases = casesOwnedBy(b, guildId)
    if (cases <= 0) continue
    total += buildingDailyGoldValue(state, b) * (cases / 4) * PRICE_MULT_DAYS
  }
  return Math.round(total)
}

// Prix d'UNE case (25 %), indexé sur la valeur + surenchère par transfert.
export function sharePriceInGold(state: GameState, building: OwnedBuilding): number {
  const daily = buildingDailyGoldValue(state, building)
  const base = daily * (SHARE_CASE_PCT / 100) * PRICE_MULT_DAYS
  const surcharge = Math.pow(TRANSFER_SURCHARGE, building.transferCount ?? 0)
  return Math.max(5, Math.round(base * surcharge))
}

// La victime par défaut = le plus gros propriétaire qui n'est pas l'acheteur.
function defaultVictim(building: OwnedBuilding, buyerId: GuildId): GuildId | null {
  const counts = new Map<GuildId, number>()
  for (const c of building.cases) if (c !== buyerId) counts.set(c, (counts.get(c) ?? 0) + 1)
  let best: GuildId | null = null
  let max = 0
  for (const [g, n] of counts) if (n > max) { max = n; best = g }
  return best
}

// Regroupe les cases par propriétaire : bâtisseur ancré à gauche, puis les autres
// dans un ordre stable (player, brice, raph, rita). La barre raconte la prise.
function regroupCases(building: OwnedBuilding): GuildId[] {
  const order: GuildId[] = ['player', 'brice', 'raph', 'rita']
  const owners = [building.builtBy, ...order.filter(g => g !== building.builtBy)]
  const out: GuildId[] = []
  for (const g of owners) {
    for (let i = 0; i < casesOwnedBy(building, g); i++) out.push(g)
  }
  return out
}

// ─── Rachat d'une case (générique, symétrique) ────────────────────────────────

export function buyCase(state: GameState, instanceId: string, buyerId: GuildId, fromId?: GuildId): GameState {
  const found = findBuilding(state, instanceId)
  if (!found) return state
  const { building, hostId } = found

  const victim = fromId ?? defaultVictim(building, buyerId)
  if (!victim || victim === buyerId) return state
  if (casesOwnedBy(building, victim) <= 0) return state

  const cost = sharePriceInGold(state, building)
  const buyer = getGuild(state, buyerId)
  if (buyer.gold < cost) return state

  // Transfert : une case de la victime → l'acheteur, puis regroupement.
  const idx = building.cases.indexOf(victim)
  const nextCases = [...building.cases]
  nextCases[idx] = buyerId
  const updatedBuilding: OwnedBuilding = {
    ...building,
    cases: regroupCases({ ...building, cases: nextCases }),
    transferCount: (building.transferCount ?? 0) + 1,
  }

  // Écrit le bâtiment mis à jour dans le tableau de la guilde hôte (bâtisseur).
  let s = state
  const host = getGuild(s, hostId)
  const hostUpdated = { ...host, buildings: host.buildings.map(b => b.instanceId === instanceId ? updatedBuilding : b) }
  s = hostId === 'player' ? { ...s, player: hostUpdated as typeof s.player } : updateRival(s, hostUpdated)

  // Flux d'or : l'acheteur paie, la VICTIME encaisse.
  s = adjustGold(s, buyerId, -cost)
  s = adjustGold(s, victim, +cost)

  // Carte : ownedBy = opérateur (proprio majoritaire) pour le visuel.
  const newOperator = operatorOf(updatedBuilding)
  s = { ...s, map: { nodes: s.map.nodes.map(n => n.buildingInstanceId === instanceId ? { ...n, ownedBy: newOperator } : n) } }

  const event: GameEvent = {
    day: s.day,
    actor: buyerId,
    type: 'BUY_SHARE',
    payload: { instanceId, defId: building.defId, cost, from: victim, buyerPct: sharePct(updatedBuilding, buyerId) },
  }
  return { ...s, log: [...s.log, event] }
}

function adjustGold(state: GameState, guildId: GuildId, delta: number): GameState {
  const isPlayer = guildId === 'player'
  const guild = getGuild(state, guildId)
  const updated = { ...guild, gold: guild.gold + delta }
  return isPlayer ? { ...state, player: updated as typeof state.player } : updateRival(state, updated)
}

// ─── Action joueur (rachète une case au plus gros proprio non-joueur) ─────────

export function buyShare(state: GameState, instanceId: string): GameState {
  return buyCase(state, instanceId, 'player')
}

// ─── Décisions de rachat IA (symétrique, 1×/jour) ─────────────────────────────
// Tuning délégué (voir project-shares-4bars-schema.md). Placeholders à affiner par sim.
const GRACE_DAYS = 10        // l'IA ne fait pas tomber le joueur sous 50 % avant J10
const PAYBACK_MAX = 20       // n'achète que si la case se rembourse en < 20 jours
const GOLD_RESERVE = 40      // garde au moins ça pour la stratégie cœur
const SPEND_FRACTION = 0.30  // ≤ 30 % de l'or libre/jour en parts

export function rivalShareDecisions(state: GameState, guildId: GuildId): GameState {
  let s = state
  let budget = Math.max(0, getGuild(s, guildId).gold - GOLD_RESERVE) * SPEND_FRACTION

  // Toutes les cibles : tout bâtiment du jeu (joueur + rivaux), y compris entre rivaux.
  const targets: string[] = []
  for (const b of s.player.buildings) targets.push(b.instanceId)
  for (const r of s.rivals) for (const b of r.buildings) targets.push(b.instanceId)

  for (const instanceId of targets) {
    if (budget <= 0) break
    const found = findBuilding(s, instanceId)
    if (!found) continue
    const { building } = found
    if (casesOwnedBy(building, guildId) >= 4) continue // déjà 100 % à moi

    const victim = defaultVictim(building, guildId)
    if (!victim) continue
    // Grâce : ne pas réduire le joueur sous 50 % avant J10
    if (victim === 'player' && s.day < GRACE_DAYS && sharePct(building, 'player') <= 50) continue

    const me = getGuild(s, guildId)
    const cost = sharePriceInGold(s, building)
    if (cost > budget || me.gold < cost + GOLD_RESERVE) continue

    // ROI : la case (25 % du revenu/jour) doit se rembourser en < PAYBACK_MAX jours
    const dailyCut = buildingDailyGoldValue(s, building) * (SHARE_CASE_PCT / 100)
    if (dailyCut <= 0 || cost / dailyCut > PAYBACK_MAX) continue

    const before = getGuild(s, guildId).gold
    s = buyCase(s, instanceId, guildId, victim)
    budget -= Math.max(before - getGuild(s, guildId).gold, 0)
  }
  return s
}

// ─── Preview pour la bulle UI ─────────────────────────────────────────────────

export function previewBuyShare(state: GameState, instanceId: string) {
  const found = findBuilding(state, instanceId)
  if (!found) return null
  const { building } = found
  const victim = defaultVictim(building, 'player')
  if (!victim) return null

  const cost = sharePriceInGold(state, building)
  const def = getBuildingDef(building.defId)
  const victimGuild = getGuild(state, victim)
  const daily = buildingDailyGoldValue(state, building)
  const newPlayerPct = Math.min(100, sharePct(building, 'player') + SHARE_CASE_PCT)

  return {
    cost,
    canAfford: state.player.gold >= cost,
    newPlayerShares: newPlayerPct,
    playerCutPerDay: Math.round(daily * (SHARE_CASE_PCT / 100)),
    buildingName: def.name,
    ownerName: victimGuild.name,
    ownerColor: victimGuild.color,
    victimId: victim,
  }
}
