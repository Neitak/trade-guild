// ─── Resources & Buildings ───────────────────────────────────────────────────

export type ResourceId = 'apple' | 'wood'

export type BuildingId = 'orchard' | 'fruit_market' | 'sawmill' | 'menuiserie'

export type WonderId = 'tower_of_magic' | 'grande_cathedrale'

export type BuildingTier = 1 | 2

export interface BuildingDef {
  id: BuildingId
  name: string
  tier: BuildingTier
  costGold?: number
  costResources?: Partial<Record<ResourceId, number>>
  produces?: ResourceId
  productionPerDay: number
  revenuePerDay?: number // Tier 2 only — gold per day based on stock
}

// ─── Guild IDs ────────────────────────────────────────────────────────────────

export type GuildId = 'player' | 'tex' | 'sam' | 'rita'

export const GUILD_COLORS: Record<GuildId, string> = {
  player: 'var(--player-color)',
  tex:    '#c94c4c',
  sam:    '#9b59b6',
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
  priceHistory: Array<{ day: number; price: number; texMarker?: boolean }>
}

export interface MarketState {
  resources: Record<ResourceId, ResourceMarket>
}

// ─── Guilds ──────────────────────────────────────────────────────────────────

export interface OwnedBuilding {
  defId: BuildingId
  instanceId: string
  shares: number // percentage owned by this guild (0–100)
  degradation?: number // 0.0 → 0.4 — Tier 1 extractors only, reduces production over time
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
  type: 'resource' | 'commercial' | 'wonder'
  resourceId?: ResourceId
  buildingDefId?: BuildingId
  ownedBy?: GuildId
  buildingInstanceId?: string
  locked?: boolean // true = not yet available, unlocks via narrative condition
}

export interface MapState {
  nodes: MapNode[]
}

// ─── Game Phase ──────────────────────────────────────────────────────────────

export type GamePhase = 'playing' | 'won' | 'lost'

// ─── Full Game State ──────────────────────────────────────────────────────────

export interface GameState {
  day: number
  phase: GamePhase
  scenario: string // opening sentence
  player: GuildState
  rivals: GuildState[]  // [tex, sam, rita]
  market: MarketState
  map: MapState
  log: GameEvent[]
  pendingRumors: PendingRumor[]
  activeRumors: ActiveRumor[]
  wonders: WonderProgress[]
  rivalStrategies: Partial<Record<GuildId, { preferredResource: ResourceId }>>
  shareRegistry: ShareOwnership[]
}

// ─── Guild helpers ────────────────────────────────────────────────────────────

export function getTex(state: GameState): GuildState {
  return state.rivals.find(r => r.id === 'tex')!
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
