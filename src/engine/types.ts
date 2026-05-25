// ─── Resources & Buildings ───────────────────────────────────────────────────

export type ResourceId = 'apple'

export type BuildingId = 'orchard' | 'fruit_market'

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

// ─── Shares (rachat hostile) ──────────────────────────────────────────────────

export interface ShareOwnership {
  buildingId: BuildingId
  ownerGuildId: 'player' | 'tex'
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

export interface GameEvent {
  day: number
  actor: 'player' | 'tex' | 'system'
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
}

export interface GuildState {
  id: 'player' | 'tex'
  gold: number
  inventory: Partial<Record<ResourceId, number>>
  buildings: OwnedBuilding[]
  netWorthHistory: Array<{ day: number; value: number }>
}

// ─── Wonder ──────────────────────────────────────────────────────────────────

export interface WonderContribution {
  apple: number
}

export interface WonderProgress {
  id: 'tower_of_magic'
  name: string
  requiredResources: Partial<Record<ResourceId, number>>
  // Each guild builds independently — first to reach required wins
  playerContributed: Partial<Record<ResourceId, number>>
  texContributed: Partial<Record<ResourceId, number>>
  complete: boolean
  completedBy?: 'player' | 'tex'
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
  ownedBy?: 'player' | 'tex'
  buildingInstanceId?: string
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
  tex: GuildState
  market: MarketState
  map: MapState
  log: GameEvent[]
  pendingRumors: PendingRumor[]
  activeRumors: ActiveRumor[]
  wonder: WonderProgress
  // Share registry: who owns what % of which building
  shareRegistry: ShareOwnership[]
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
