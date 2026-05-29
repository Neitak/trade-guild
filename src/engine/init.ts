import type { GameState, MapNode, ResourceId, GuildState } from './types'
import { GUILD_COLORS } from './types'
import resourceDefs from '../data/resources.json'
import wonderDefs from '../data/wonders.json'

// ─── Constants ────────────────────────────────────────────────────────────────

// DEV SPEED: 30 ticks × 1s = 30s/day
export const TICKS_PER_DAY = 30

// ─── Map layout — 3 zones ─────────────────────────────────────────────────────
//
//  SVG 720×460
//  ┌──────────────────── CAPITALE (y 0-115) ─────────────────────────┐
//  │            Tour de Magie          Grande Cathédrale              │
//  ├──────────────────── ARTISANALE (y 130-245) ─────────────────────┤
//  │  Charpenterie   Marché aux fruits   Menuiserie (×2)             │
//  ├──────────────────── CHAMPS & EXTRACTION (y 260-460) ────────────┤
//  │  Verger (×2)    Carrière (×2, Raph) Scierie (×2, Brice)        │
//  └─────────────────────────────────────────────────────────────────┘

const MAP_NODES: MapNode[] = [
  // ── Zone Capitale ──────────────────────────────────────────────────
  { id: 'auberge_slot_1',    zone: 'capitale', label: "Auberge du Carrefour", x: 100, y: 68, type: 'commercial', buildingDefId: 'auberge', locked: true },
  { id: 'wonder_slot',       zone: 'capitale', label: 'Tour de Magie',        x: 270, y: 68, type: 'wonder' },
  { id: 'cathedrale_slot',   zone: 'capitale', label: 'Grande Cathédrale',    x: 450, y: 68, type: 'wonder' },
  { id: 'auberge_slot_2',    zone: 'capitale', label: 'Grande Auberge',       x: 620, y: 68, type: 'commercial', buildingDefId: 'auberge', locked: true },

  // ── Zone Artisanale ────────────────────────────────────────────────
  { id: 'charpenterie_slot_1', zone: 'artisanale', label: 'Atelier Charron',   x: 125, y: 195, type: 'commercial', buildingDefId: 'charpenterie', locked: true },
  { id: 'market_slot_1',       zone: 'artisanale', label: 'Place du Marché',   x: 295, y: 195, type: 'commercial', buildingDefId: 'fruit_market', locked: true },
  { id: 'market_slot_2',       zone: 'artisanale', label: 'Carrefour Nord',    x: 395, y: 195, type: 'commercial', buildingDefId: 'fruit_market', locked: true },
  { id: 'menuiserie_slot_1',   zone: 'artisanale', label: 'Atelier du Bois',   x: 545, y: 195, type: 'commercial', buildingDefId: 'menuiserie' },
  { id: 'menuiserie_slot_2',   zone: 'artisanale', label: 'Grande Menuiserie', x: 660, y: 195, type: 'commercial', buildingDefId: 'menuiserie',  locked: true },

  // ── Zone Champs & Extraction ───────────────────────────────────────
  { id: 'orchard_slot_1',    zone: 'champs', label: 'Verger du Vallon',       x:  80, y: 350, type: 'resource', buildingDefId: 'orchard',   locked: true },
  { id: 'orchard_slot_2',    zone: 'champs', label: 'Verger des Collines',    x: 200, y: 385, type: 'resource', buildingDefId: 'orchard',   locked: true },
  { id: 'carriere_slot_1',   zone: 'champs', label: 'Carrière du Vallon',     x: 360, y: 345, type: 'resource', buildingDefId: 'carriere',  locked: true },
  { id: 'carriere_slot_2',   zone: 'champs', label: 'Carrière du Nord',       x: 470, y: 385, type: 'resource', buildingDefId: 'carriere',  locked: true },
  { id: 'scierie_slot_1',    zone: 'champs', label: 'Scierie du Bois Neuf',   x: 580, y: 345, type: 'resource', buildingDefId: 'sawmill' },
  { id: 'scierie_slot_2',    zone: 'champs', label: 'Scierie des Hauteurs',   x: 670, y: 388, type: 'resource', buildingDefId: 'sawmill',   locked: true },
]

export function initGame(): GameState {
  const resDefs = resourceDefs as any[]
  const woodDef  = resDefs.find(r => r.id === 'wood')!
  const appleDef = resDefs.find(r => r.id === 'apple')!
  const pierreDef = resDefs.find(r => r.id === 'pierre')!
  const meubleDef = resDefs.find(r => r.id === 'meuble')!

  const wDefs = wonderDefs as any[]
  const towerDef      = wDefs.find(w => w.id === 'tower_of_magic')!
  const cathedraleDef = wDefs.find(w => w.id === 'grande_cathedrale')!

  function makeRival(id: 'brice' | 'raph' | 'rita', name: string, gold: number, extraInventory?: Partial<Record<import('./types').ResourceId, number>>): GuildState {
    return {
      id,
      name,
      color: GUILD_COLORS[id],
      gold,
      inventory: { apple: 0, wood: 0, pierre: 0, meuble: 0, ...extraInventory },
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
        pierre: 0,
        meuble: 0,
      },
      buildings: [],
      netWorthHistory: [],
    },

    // ─── Rivals — Brice (Phase 0+), Raph (joins Phase 1 when player buys sawmill) ──
    rivals: [
      makeRival('brice', 'Brice', 80),
      makeRival('raph',  'Raph',  60),   // inactive until player buys sawmill
      makeRival('rita',  'Rita',  100, { pierre: 15, wood: 10 }), // inactive until player buys auberge
    ],

    // ─── Market ─────────────────────────────────────────────────────────────
    market: {
      resources: {
        apple: {
          resourceId: 'apple',
          currentPrice:         appleDef.basePrice,
          equilibriumPrice:     appleDef.equilibriumPrice,
          baseEquilibriumPrice: appleDef.equilibriumPrice,
          volatility:           appleDef.volatility ?? 0.12,
          elasticityK:          appleDef.elasticityK,
          volumeAvailable:      appleDef.startingVolume,
          priceHistory: [{ day: 0, price: appleDef.basePrice }],
        },
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
        pierre: {
          resourceId: 'pierre',
          currentPrice:         pierreDef.basePrice,
          equilibriumPrice:     pierreDef.equilibriumPrice,
          baseEquilibriumPrice: pierreDef.equilibriumPrice,
          volatility:           pierreDef.volatility ?? 0.07,
          elasticityK:          pierreDef.elasticityK,
          volumeAvailable:      pierreDef.startingVolume,
          priceHistory: [{ day: 0, price: pierreDef.basePrice }],
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

    // ─── Strategies — Brice active from start, Raph joins on Phase 1 ────────
    rivalStrategies: {
      brice: { preferredResource: 'wood', pumpPhase: 'idle' },
      // raph: added dynamically when player buys sawmill
    },

    // ─── Shares ─────────────────────────────────────────────────────────────
    shareRegistry: [],

    // ─── Market Events ──────────────────────────────────────────────────────
    pendingMarketEvents: [],
    activeMarketEvents: [],
  }
}
