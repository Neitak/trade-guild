import type { GameState, MapNode, ResourceId, GuildState } from './types'
import { GUILD_COLORS } from './types'
import resourceDefs from '../data/resources.json'
import wonderDefs from '../data/wonders.json'

// ─── Constants ────────────────────────────────────────────────────────────────

// DEV SPEED: 30 ticks × 1s = 30s/day
export const TICKS_PER_DAY = 30

// ─── Map layout — 3 zones, slots génériques ───────────────────────────────────
//
//  SVG 720×460
//  ┌──────────────────── CAPITALE (y 0-115) ──────────────────────────────────┐
//  │            commercial_slot_1 (Auberge)     commercial_slot_2             │
//  ├──────────────────── ARTISANALE (y 130-245) ──────────────────────────────┤
//  │            workshop_slot_1                 workshop_slot_2               │
//  ├──────────────────── CHAMPS & EXTRACTION (y 260-460) ────────────────────┤
//  │  farm_slot_1   farm_slot_2   extraction_slot_1   extraction_slot_2      │
//  └─────────────────────────────────────────────────────────────────────────┘

const MAP_NODES: MapNode[] = [
  // ── Zone Capitale ──────────────────────────────────────────────────────────
  { id: 'commercial_slot_1', zone: 'capitale',   label: 'Auberge du Carrefour', x: 220, y: 68, type: 'commercial', slotType: 'commercial' },
  { id: 'wonder_slot',       zone: 'capitale',   label: 'Tour de Magie',        x: 360, y: 68, type: 'wonder' },
  { id: 'cathedrale_slot',   zone: 'capitale',   label: 'Grande Cathédrale',    x: 500, y: 68, type: 'wonder' },
  { id: 'commercial_slot_2', zone: 'capitale',   label: 'Grande Auberge',       x: 620, y: 68, type: 'commercial', slotType: 'commercial', locked: true },

  // ── Zone Artisanale ────────────────────────────────────────────────────────
  { id: 'workshop_slot_1',   zone: 'artisanale', label: 'Atelier Sud',          x: 270, y: 195, type: 'commercial', slotType: 'workshop' },
  { id: 'workshop_slot_2',   zone: 'artisanale', label: 'Atelier Nord',         x: 490, y: 195, type: 'commercial', slotType: 'workshop' },

  // ── Zone Champs & Extraction ───────────────────────────────────────────────
  { id: 'farm_slot_1',       zone: 'champs',     label: 'Plaine des Oliviers',  x:  90, y: 350, type: 'resource', slotType: 'farm' },
  { id: 'farm_slot_2',       zone: 'champs',     label: 'Collines Fertiles',    x: 230, y: 385, type: 'resource', slotType: 'farm' },
  { id: 'extraction_slot_1', zone: 'champs',     label: 'Forêt du Bois Neuf',   x: 490, y: 350, type: 'resource', slotType: 'extraction' },
  { id: 'extraction_slot_2', zone: 'champs',     label: 'Forêt des Hauteurs',   x: 620, y: 388, type: 'resource', slotType: 'extraction', locked: true },
]

export function initGame(): GameState {
  const resDefs = resourceDefs as any[]
  const woodDef   = resDefs.find(r => r.id === 'wood')!
  const oliveDef  = resDefs.find(r => r.id === 'olive')!
  const meubleDef = resDefs.find(r => r.id === 'meuble')!
  const huileDef  = resDefs.find(r => r.id === 'huile')!

  const wDefs = wonderDefs as any[]
  const towerDef      = wDefs.find(w => w.id === 'tower_of_magic')!
  const cathedraleDef = wDefs.find(w => w.id === 'grande_cathedrale')!

  function makeRival(id: 'brice' | 'raph' | 'rita', name: string, gold: number, extraInventory?: Partial<Record<import('./types').ResourceId, number>>): GuildState {
    return {
      id,
      name,
      color: GUILD_COLORS[id],
      gold,
      inventory: { olive: 0, wood: 0, meuble: 0, huile: 0, ...extraInventory },
      buildings: [],
      netWorthHistory: [],
    }
  }

  return {
    // ─── Time ───────────────────────────────────────────────────────────────
    day: 0,
    tick: 0,
    tickOfDay: 0,

    phase: 'playing',

    // ─── Opening ────────────────────────────────────────────────────────────
    scenario: 'Tu arrives en ville avec une planche de bois et zéro pièce d\'or. Brice a les yeux sur la forêt, Raph sur les oliveraies. Objectif : construire un empire avant eux.',

    // ─── Player — Phase 0 start : 1 bois, 0 or ──────────────────────────────
    player: {
      id: 'player',
      name: 'Nun',
      color: GUILD_COLORS['player'],
      gold: 0,
      inventory: {
        olive: 0,
        wood:  1,
        meuble: 0,
        huile: 0,
      },
      buildings: [],
      netWorthHistory: [],
    },

    // ─── Rivals — tous actifs dès le Jour 0 ─────────────────────────────────
    rivals: [
      makeRival('brice', 'Brice', 80),
      makeRival('raph',  'Raph',  60),
    ],

    // ─── Market ─────────────────────────────────────────────────────────────
    market: {
      resources: {
        wood: {
          resourceId: 'wood',
          currentPrice:         5.0,
          equilibriumPrice:     5.0,
          baseEquilibriumPrice: woodDef.equilibriumPrice,
          volatility:           0.04,
          elasticityK:          woodDef.elasticityK,
          volumeAvailable:      woodDef.startingVolume,
          priceHistory: [{ day: 0, price: 5.0 }],
        },
        olive: {
          resourceId: 'olive',
          currentPrice:         oliveDef.basePrice,
          equilibriumPrice:     oliveDef.equilibriumPrice,
          baseEquilibriumPrice: oliveDef.equilibriumPrice,
          volatility:           oliveDef.volatility ?? 0.14,
          elasticityK:          oliveDef.elasticityK,
          volumeAvailable:      oliveDef.startingVolume,
          priceHistory: [{ day: 0, price: oliveDef.basePrice }],
        },
        meuble: {
          resourceId: 'meuble',
          currentPrice:         meubleDef.basePrice,
          equilibriumPrice:     meubleDef.equilibriumPrice,
          baseEquilibriumPrice: meubleDef.equilibriumPrice,
          volatility:           meubleDef.volatility ?? 0.10,
          elasticityK:          meubleDef.elasticityK,
          volumeAvailable:      meubleDef.startingVolume,
          priceHistory: [{ day: 0, price: meubleDef.basePrice }],
        },
        huile: {
          resourceId: 'huile',
          currentPrice:         huileDef.basePrice,
          equilibriumPrice:     huileDef.equilibriumPrice,
          baseEquilibriumPrice: huileDef.equilibriumPrice,
          volatility:           huileDef.volatility ?? 0.15,
          elasticityK:          huileDef.elasticityK,
          volumeAvailable:      huileDef.startingVolume,
          priceHistory: [{ day: 0, price: huileDef.basePrice }],
        },
        // pierre reste dans le type mais sans marché actif
        pierre: {
          resourceId: 'pierre',
          currentPrice:         4.0,
          equilibriumPrice:     3.8,
          baseEquilibriumPrice: 3.8,
          volatility:           0.07,
          elasticityK:          0.12,
          volumeAvailable:      0,
          priceHistory: [{ day: 0, price: 4.0 }],
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

    // ─── Strategies — tous actifs Jour 0 ────────────────────────────────────
    rivalStrategies: {
      brice: { preferredResource: 'wood', pumpPhase: 'idle' },
      raph:  { preferredResource: 'huile' },
    },

    // ─── Shares ─────────────────────────────────────────────────────────────
    shareRegistry: [],

    // ─── Market Events ──────────────────────────────────────────────────────
    pendingMarketEvents: [],
    activeMarketEvents: [],
  }
}
