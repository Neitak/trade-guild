import type { GameState, MapNode, ResourceId, GuildState } from './types'
import { GUILD_COLORS } from './types'
import resourceDefs from '../data/resources.json'
import wonderDefs from '../data/wonders.json'

// ─── Constants ────────────────────────────────────────────────────────────────

export const TICKS_PER_DAY = 30  // 30 × 3s = 90s per day (dev speed)

// ─── Map layout — bois filière (right) + 2 wonders (center) ──────────────────
// Apple nodes kept in map for Phase 1+ but grayed — won't be interactable in Phase 0
const MAP_NODES: MapNode[] = [
  // Apple filière (left) — locked until Phase 1 (building unlocks market)
  { id: 'orchard_slot_1',    label: 'Verger du Vallon',       x: 100, y: 90,  type: 'resource',   buildingDefId: 'orchard',     locked: true },
  { id: 'orchard_slot_2',    label: 'Verger des Collines',    x: 215, y: 50,  type: 'resource',   buildingDefId: 'orchard',     locked: true },
  { id: 'market_slot_1',     label: 'Place du Marché',        x: 145, y: 215, type: 'commercial', buildingDefId: 'fruit_market', locked: true },
  { id: 'market_slot_2',     label: 'Carrefour Nord',         x:  55, y: 275, type: 'commercial', buildingDefId: 'fruit_market', locked: true },
  // Wonders (center)
  { id: 'wonder_slot',       label: 'Tour de Magie',          x: 365, y:  90, type: 'wonder' },
  { id: 'cathedrale_slot',   label: 'Grande Cathédrale',      x: 365, y: 265, type: 'wonder' },
  // Wood filière (right) — slot_1 available, slot_2 locked
  { id: 'scierie_slot_1',    label: 'Scierie du Bois Neuf',   x: 540, y: 75,  type: 'resource',   buildingDefId: 'sawmill' },
  { id: 'scierie_slot_2',    label: 'Scierie des Hauteurs',   x: 650, y: 125, type: 'resource',   buildingDefId: 'sawmill',     locked: true },
  { id: 'menuiserie_slot_1', label: 'Atelier du Bois',        x: 575, y: 215, type: 'commercial', buildingDefId: 'menuiserie' },
  { id: 'menuiserie_slot_2', label: 'Grande Menuiserie',      x: 660, y: 280, type: 'commercial', buildingDefId: 'menuiserie',  locked: true },
]

export function initGame(): GameState {
  const resDefs = resourceDefs as any[]
  const woodDef  = resDefs.find(r => r.id === 'wood')!
  const appleDef = resDefs.find(r => r.id === 'apple')!

  const wDefs = wonderDefs as any[]
  const towerDef      = wDefs.find(w => w.id === 'tower_of_magic')!
  const cathedraleDef = wDefs.find(w => w.id === 'grande_cathedrale')!

  function makeRival(id: 'brice' | 'raph' | 'rita', name: string, gold: number): GuildState {
    return {
      id,
      name,
      color: GUILD_COLORS[id],
      gold,
      inventory: { apple: 0, wood: 0 },
      buildings: [],
      netWorthHistory: [],
    }
  }

  const briceResource: ResourceId = 'wood'  // Phase 0: Brice focuses on wood

  return {
    // ─── Time ───────────────────────────────────────────────────────────────
    day: 0,
    tick: 0,
    tickOfDay: 0,

    phase: 'playing',

    // ─── Opening ────────────────────────────────────────────────────────────
    scenario: 'Tu arrives en ville avec une planche de bois et zéro pièce d\'or. Brice, lui, a déjà les yeux sur la scierie. Objectif : construire un empire avant lui.',

    // ─── Player — Phase 0 start : 1 bois, 0 or ──────────────────────────────
    player: {
      id: 'player',
      name: 'Vous',
      color: GUILD_COLORS['player'],
      gold: 0,
      inventory: {
        apple: 0,
        wood:  1,
      },
      buildings: [],
      netWorthHistory: [],
    },

    // ─── Rivals — Phase 0 : Brice only ──────────────────────────────────────
    rivals: [
      makeRival('brice', 'Brice', 80),
    ],

    // ─── Market ─────────────────────────────────────────────────────────────
    market: {
      resources: {
        apple: {
          resourceId: 'apple',
          currentPrice:         appleDef.basePrice,
          equilibriumPrice:     appleDef.equilibriumPrice,
          baseEquilibriumPrice: appleDef.equilibriumPrice,
          volatility:           appleDef.volatility ?? 0.10,
          elasticityK:          appleDef.elasticityK,
          volumeAvailable:      appleDef.startingVolume,
          priceHistory: [{ day: 0, price: appleDef.basePrice }],
        },
        wood: {
          resourceId: 'wood',
          // Phase 0 : start at 1.0g (round, readable, bullish from here)
          currentPrice:         1.0,
          equilibriumPrice:     woodDef.equilibriumPrice,
          baseEquilibriumPrice: woodDef.equilibriumPrice,
          volatility:           0.04,  // low volatility in Phase 0 (tutorial feel)
          elasticityK:          woodDef.elasticityK,
          volumeAvailable:      woodDef.startingVolume,
          priceHistory: [{ day: 0, price: 1.0 }],
        },
      },
    },

    // ─── Map ────────────────────────────────────────────────────────────────
    map: { nodes: MAP_NODES.map(n => ({ ...n })) },

    // ─── Log & Rumors ───────────────────────────────────────────────────────
    log: [],
    pendingRumors: [],
    activeRumors: [],

    // ─── Wonders ────────────────────────────────────────────────────────────
    wonders: [
      {
        id: 'tower_of_magic',
        name: towerDef.name,
        requiredResources: towerDef.requiredResources,
        playerContributed: {},
        rivalContributed: { brice: {} },
        complete: false,
      },
      {
        id: 'grande_cathedrale',
        name: cathedraleDef.name,
        requiredResources: cathedraleDef.requiredResources,
        playerContributed: {},
        rivalContributed: { brice: {} },
        complete: false,
      },
    ],

    // ─── Strategies ─────────────────────────────────────────────────────────
    rivalStrategies: {
      brice: { preferredResource: briceResource },
    },

    // ─── Shares ─────────────────────────────────────────────────────────────
    shareRegistry: [],

    // ─── Market Events ──────────────────────────────────────────────────────
    pendingMarketEvents: [],
    activeMarketEvents: [],
  }
}
