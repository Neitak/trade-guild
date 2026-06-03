// ─── Resources & Buildings ───────────────────────────────────────────────────

export type ResourceId = 'olive' | 'wood' | 'pierre' | 'meuble' | 'huile'

export type ResourceCategory = 'CONSTRUCTION' | 'CONFORT' | 'LUXE' | 'ALIMENTAIRE'

export type BuildingId = 'olivery' | 'press' | 'sawmill' | 'menuiserie' | 'auberge'

export type SlotType = 'farm' | 'extraction' | 'workshop' | 'commercial'

export type WonderId = 'tower_of_magic' | 'grande_cathedrale'

export type BuildingTier = 1 | 2 | 3
export type BuildingZone = 'champs' | 'artisanale' | 'capitale'

export interface BuildingDef {
  id: BuildingId
  name: string
  tier: BuildingTier
  zone?: BuildingZone
  slotType?: SlotType
  costGold?: number
  costResources?: Partial<Record<ResourceId, number>>
  produces?: ResourceId
  productionPerDay: number
  revenuePerDay?: number       // Tier 2/3 — gold/day
  autoConsumeInput?: ResourceId // Atelier: consumes this resource each day
  autoConsumeQty?: number       // Atelier: units consumed per day
  upgradable?: boolean          // can be leveled up
  maxLevel?: number
  upgradeResourceId?: ResourceId           // CONFORT upgrade: resource consumed per level-up
  upgradeResourceCosts?: Record<string, number> // cost at each current level (key = level as string)
  upgradeRevenues?: Record<string, number>      // revenue at each level (key = level as string)
}

// ─── Guild IDs ────────────────────────────────────────────────────────────────

export type GuildId = 'player' | 'brice' | 'raph' | 'rita'

// V8 — couleurs joueurs : Nun=bleu (var), Brice=jaune, Raph=vert, Julien=rouge (4e, invisible).
// Source UI dupliquée dans theme.ts AZUR.players — garder synchronisé.
export const GUILD_COLORS: Record<GuildId, string> = {
  player: 'var(--player-color)',
  brice:  '#f2c230', // jaune (était #e08a45 orange)
  raph:   '#4caf66', // vert (était #e8c069 doré)
  rita:   '#e67e22', // legacy — Rita retirée du jeu
}

// ─── Shares (rachat hostile) ──────────────────────────────────────────────────

export interface ShareOwnership {
  buildingId: BuildingId
  ownerGuildId: GuildId
  shares: number // 0–100 (percentage)
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type GameEventType =
  | 'SELL'
  | 'BUY'
  | 'BUY_BUILDING'
  | 'UPGRADE_BUILDING'
  | 'BUY_SHARE'
  | 'SELL_SHARE'
  | 'END_DAY'
  | 'WONDER_PROGRESS'
  | 'WONDER_COMPLETE'
  | 'RUMOR_GENERATED'
  | 'PRICE_CHANGE'
  | 'PRODUCTION'
  | 'REVENUE'
  | 'GAME_OVER'
  | 'NODE_UNLOCKED'
  | 'RIVAL_JOINED'

export interface GameEvent {
  day: number
  actor: GuildId | 'system'
  type: GameEventType
  payload: Record<string, unknown>
}

// ─── Rumors ──────────────────────────────────────────────────────────────────

export interface PendingRumor {
  revealOnDay: number
  text: string
  nodeId?: string // Position on the map for the bubble
}

export interface ActiveRumor {
  day: number
  text: string
  nodeId?: string
}

// ─── Market ──────────────────────────────────────────────────────────────────

export interface ResourceMarket {
  resourceId: ResourceId
  currentPrice: number
  equilibriumPrice: number
  baseEquilibriumPrice: number  // immuable — référence avant dégradation
  volatility: number            // 0.08 calme → 0.15 volatile
  elasticityK: number
  volumeAvailable: number
  priceHistory: Array<{ day: number; price: number; marker?: GuildId }>
}

export interface MarketState {
  resources: Record<ResourceId, ResourceMarket>
}

// ─── Guilds ──────────────────────────────────────────────────────────────────

export interface OwnedBuilding {
  defId: BuildingId
  instanceId: string
  // ── V9 — système de parts à 4 cases (25 % chacune) ──
  // `cases` a TOUJOURS longueur 4 : chaque entrée = la guilde propriétaire de cette case.
  // Le bâtisseur remplit les 4 cases à la construction (100 %). Ordre = rangement visuel
  // (bâtisseur ancré à gauche). Le bâtiment reste canonique dans le tableau de son bâtisseur ;
  // les co-propriétaires n'ont PAS d'entrée dupliquée — l'ownership vit dans `cases`.
  cases: GuildId[]
  builtBy: GuildId         // fondateur (ancre gauche de la barre)
  transferCount?: number   // nb de cases ayant changé de main (surenchère du rachat)
  degradation?: number     // 0.0 → 0.4 — Tier 1 extractors only
  level?: number           // 1–5 for upgradable buildings (default 1)
}

// ── Helpers parts (4 cases) ──
export function casesOwnedBy(b: OwnedBuilding, g: GuildId): number {
  return b.cases.filter(c => c === g).length
}
/** % détenu par une guilde (0/25/50/75/100). */
export function sharePct(b: OwnedBuilding, g: GuildId): number {
  return casesOwnedBy(b, g) * 25
}
/** Liste des guildes co-propriétaires (au moins 1 case), dédupliquée. */
export function ownersOf(b: OwnedBuilding): GuildId[] {
  return [...new Set(b.cases)]
}
/** Opérateur = propriétaire MAJORITAIRE (paie les intrants). Égalité → le bâtisseur s'il est à égalité, sinon le 1er. */
export function operatorOf(b: OwnedBuilding): GuildId {
  const counts = new Map<GuildId, number>()
  for (const c of b.cases) counts.set(c, (counts.get(c) ?? 0) + 1)
  let max = 0
  let leaders: GuildId[] = []
  for (const [g, n] of counts) {
    if (n > max) { max = n; leaders = [g] }
    else if (n === max) leaders.push(g)
  }
  if (leaders.includes(b.builtBy)) return b.builtBy
  return leaders[0]
}

export interface GuildState {
  id: GuildId
  name: string   // display name
  color: string  // CSS color
  gold: number
  inventory: Partial<Record<ResourceId, number>>
  // V8 — coût unitaire moyen pondéré du stock détenu (« Coût moyen » dans l'UI).
  // Mis à jour UNIQUEMENT aux acquisitions : achat marché = prix payé, production = 0
  // (« ce que tu produis est gratuit »). Les retraits (vente, conso atelier, construction)
  // ne touchent pas le coût unitaire des unités restantes → modèle robuste.
  inventoryAvgCost?: Partial<Record<ResourceId, number>>
  buildings: OwnedBuilding[]
  netWorthHistory: Array<{ day: number; value: number }>
}

/**
 * Nouveau coût unitaire moyen après une acquisition de `addQty` unités pour `addCost` or.
 * Production gratuite → addCost = 0. À stock final nul → 0 (reset implicite : prevQty=0
 * annule tout coût résiduel à la prochaine acquisition).
 */
export function nextAvgCost(prevAvg: number, prevQty: number, addQty: number, addCost: number): number {
  const newQty = prevQty + addQty
  return newQty > 0 ? (prevAvg * prevQty + addCost) / newQty : 0
}

// ─── Wonder ──────────────────────────────────────────────────────────────────

export interface WonderProgress {
  id: WonderId
  name: string
  requiredResources: Partial<Record<ResourceId, number>>
  playerContributed: Partial<Record<ResourceId, number>>
  rivalContributed: Partial<Record<GuildId, Partial<Record<ResourceId, number>>>>
  complete: boolean
  completedBy?: GuildId
  completedOnDay?: number
}

// ─── Map ─────────────────────────────────────────────────────────────────────

export interface MapNode {
  id: string
  label: string
  x: number
  y: number
  zone?: BuildingZone
  type: 'resource' | 'commercial' | 'wonder'
  slotType?: SlotType
  resourceId?: ResourceId
  ownedBy?: GuildId
  buildingInstanceId?: string
  locked?: boolean
}

export interface MapState {
  nodes: MapNode[]
}

// ─── Market Events (pénuries, etc.) ──────────────────────────────────────────

export interface PendingMarketEvent {
  id: string
  resourceId: ResourceId
  type: 'shortage'
  probability: number       // 0.4–0.9 — chance it actually fires
  magnitude: number         // 0.2–0.8 — price spike %
  duration: number          // ticks the spike lasts
  firesOnTick: number       // absolute tick when event resolves
  rumorRevealedOnTick: number // absolute tick when rumor appears
  fired: boolean
}

export interface ActiveMarketEvent {
  id: string
  resourceId: ResourceId
  magnitudePerTick: number  // per-tick price boost applied to currentPrice
  remainingTicks: number
}

// ─── Game Phase ──────────────────────────────────────────────────────────────

export type GamePhase = 'playing' | 'won' | 'lost'

// ─── Full Game State ──────────────────────────────────────────────────────────

export interface RivalStrategy {
  preferredResource: ResourceId
  pumpPhase?: 'idle' | 'pumping' | 'dumping'
  pumpStartDay?: number
  pumpCooldownDay?: number
}

export interface GameState {
  day: number
  tick: number
  tickOfDay: number
  phase: GamePhase
  scenario: string
  player: GuildState
  rivals: GuildState[]
  market: MarketState
  map: MapState
  log: GameEvent[]
  pendingRumors: PendingRumor[]
  activeRumors: ActiveRumor[]
  wonders: WonderProgress[]
  rivalStrategies: Partial<Record<GuildId, RivalStrategy>>
  shareRegistry: ShareOwnership[]
  pendingMarketEvents: PendingMarketEvent[]
  activeMarketEvents: ActiveMarketEvent[]
}

// ─── Guild helpers ────────────────────────────────────────────────────────────

export function getBrice(state: GameState): GuildState {
  return state.rivals.find(r => r.id === 'brice')!
}

/** @deprecated Use getBrice */
export function getTex(state: GameState): GuildState {
  return getBrice(state)
}

export function getRival(state: GameState, id: GuildId): GuildState {
  return state.rivals.find(r => r.id === id)!
}

export function updateRival(state: GameState, updated: GuildState): GameState {
  return { ...state, rivals: state.rivals.map(r => r.id === updated.id ? updated : r) }
}

// ─── Sim types ────────────────────────────────────────────────────────────────

export interface SimConfig {
  games?: number
  maxDays?: number
  seed?: number
}

export interface SimResult {
  winner: 'player' | 'tex' | 'draw'
  days: number
  playerFinalGold: number
  texFinalGold: number
  priceMin: number
  priceMax: number
  priceAvg: number
  archetype: 'investor' | 'trader' | 'manipulator' | 'mixed'
  log: GameEvent[]
}

export interface BatchStats {
  games: number
  playerWins: number
  texWins: number
  draws: number
  avgDays: number
  avgPriceMin: number
  avgPriceMax: number
  archetypes: Record<string, number>
  outOfSpec: number // games outside 20-60 day window
}
