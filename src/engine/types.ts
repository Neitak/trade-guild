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

export const GUILD_COLORS: Record<GuildId, string> = {
  player: 'var(--player-color)',
  brice:  '#e08a45',
  raph:   '#e8c069',
  rita:   '#e67e22',
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
  shares: number // percentage owned by this guild (0–100)
  degradation?: number // 0.0 → 0.4 — Tier 1 extractors only
  level?: number        // 1–5 for upgradable buildings (default 1)
}

export interface GuildState {
  id: GuildId
  name: string   // display name
  color: string  // CSS color
  gold: number
  inventory: Partial<Record<ResourceId, number>>
  buildings: OwnedBuilding[]
  netWorthHistory: Array<{ day: number; value: number }>
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
