import type { GameState, MapNode, ResourceId } from './types'
import resourceDefs from '../data/resources.json'
import wonderDefs from '../data/wonders.json'
import scenarioDefs from '../data/scenarios.json'

// ─── Map layout — 2 filières (apples left, wood right) + 2 wonders (center) ──
const MAP_NODES: MapNode[] = [
  // Apple filière (left)
  { id: 'orchard_slot_1',    label: 'Verger du Vallon',       x: 100, y: 90,  type: 'resource',   buildingDefId: 'orchard' },
  { id: 'orchard_slot_2',    label: 'Verger des Collines',    x: 215, y: 50,  type: 'resource',   buildingDefId: 'orchard' },
  { id: 'market_slot_1',     label: 'Place du Marché',        x: 145, y: 215, type: 'commercial', buildingDefId: 'fruit_market' },
  { id: 'market_slot_2',     label: 'Carrefour Nord',         x:  55, y: 275, type: 'commercial', buildingDefId: 'fruit_market' },
  // Wonders (center)
  { id: 'wonder_slot',       label: 'Tour de Magie',          x: 365, y:  90, type: 'wonder' },
  { id: 'cathedrale_slot',   label: 'Grande Cathédrale',      x: 365, y: 265, type: 'wonder' },
  // Wood filière (right)
  { id: 'scierie_slot_1',    label: 'Scierie du Bois Neuf',   x: 540, y: 75,  type: 'resource',   buildingDefId: 'sawmill' },
  { id: 'scierie_slot_2',    label: 'Scierie des Hauteurs',   x: 650, y: 125, type: 'resource',   buildingDefId: 'sawmill' },
  { id: 'menuiserie_slot_1', label: 'Atelier du Bois',        x: 575, y: 215, type: 'commercial', buildingDefId: 'menuiserie' },
  { id: 'menuiserie_slot_2', label: 'Grande Menuiserie',      x: 660, y: 280, type: 'commercial', buildingDefId: 'menuiserie' },
]

export function initGame(scenarioId?: string): GameState {
  const defs = scenarioDefs as any[]
  const scenario = scenarioId
    ? (defs.find(s => s.id === scenarioId) ?? defs[0])
    : defs[Math.floor(Math.random() * defs.length)]

  const resDefs = resourceDefs as any[]
  const appleDef = resDefs.find(r => r.id === 'apple')!
  const woodDef  = resDefs.find(r => r.id === 'wood')!

  const wDefs = wonderDefs as any[]
  const towerDef     = wDefs.find(w => w.id === 'tower_of_magic')!
  const cathedraleDef = wDefs.find(w => w.id === 'grande_cathedrale')!

  // Tex randomly picks apple or wood filière at game start
  const texResource: ResourceId = Math.random() < 0.5 ? 'apple' : 'wood'

  return {
    day: 0,
    phase: 'playing',
    scenario: scenario.openingSentence,
    player: {
      id: 'player',
      gold: scenario.player.gold,
      inventory: {
        apple: scenario.player.inventory.apple ?? 0,
        wood:  scenario.player.inventory.wood  ?? 0,
      },
      buildings: [],
      netWorthHistory: [],
    },
    tex: {
      id: 'tex',
      gold: scenario.tex.gold,
      inventory: {
        apple: scenario.tex.inventory.apple ?? 0,
        wood:  scenario.tex.inventory.wood  ?? 0,
      },
      buildings: [],
      netWorthHistory: [],
    },
    market: {
      resources: {
        apple: {
          resourceId: 'apple',
          currentPrice:    appleDef.basePrice,
          equilibriumPrice: appleDef.equilibriumPrice,
          elasticityK:     appleDef.elasticityK,
          volumeAvailable: appleDef.startingVolume,
          priceHistory: [{ day: 0, price: appleDef.basePrice }],
        },
        wood: {
          resourceId: 'wood',
          currentPrice:    woodDef.basePrice,
          equilibriumPrice: woodDef.equilibriumPrice,
          elasticityK:     woodDef.elasticityK,
          volumeAvailable: woodDef.startingVolume,
          priceHistory: [{ day: 0, price: woodDef.basePrice }],
        },
      },
    },
    map: { nodes: MAP_NODES.map(n => ({ ...n })) },
    log: [],
    pendingRumors: [],
    activeRumors: [],
    wonders: [
      {
        id: 'tower_of_magic',
        name: towerDef.name,
        requiredResources: towerDef.requiredResources,
        playerContributed: {},
        texContributed: {},
        complete: false,
      },
      {
        id: 'grande_cathedrale',
        name: cathedraleDef.name,
        requiredResources: cathedraleDef.requiredResources,
        playerContributed: {},
        texContributed: {},
        complete: false,
      },
    ],
    texStrategy: { preferredResource: texResource },
    shareRegistry: [],
  }
}
