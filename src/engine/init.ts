import type { GameState, MapNode } from './types'
import resourceDefs from '../data/resources.json'
import wonderDefs from '../data/wonders.json'
import scenarioDefs from '../data/scenarios.json'

const MAP_NODES: MapNode[] = [
  { id: 'orchard_slot_1', label: 'Verger du Vallon', x: 200, y: 150, type: 'resource', buildingDefId: 'orchard' },
  { id: 'orchard_slot_2', label: 'Verger des Collines', x: 400, y: 100, type: 'resource', buildingDefId: 'orchard' },
  { id: 'market_slot_1', label: 'Place du Marché', x: 300, y: 280, type: 'commercial', buildingDefId: 'fruit_market' },
  { id: 'market_slot_2', label: 'Carrefour Nord', x: 150, y: 320, type: 'commercial', buildingDefId: 'fruit_market' },
  { id: 'wonder_slot', label: 'Tour de Magie', x: 500, y: 250, type: 'wonder' },
]

export function initGame(scenarioId?: string): GameState {
  const defs = scenarioDefs as any[]
  const scenario = scenarioId
    ? (defs.find(s => s.id === scenarioId) ?? defs[0])
    : defs[Math.floor(Math.random() * defs.length)]
  const wonder = (wonderDefs as any[])[0]
  const appleResource = (resourceDefs as any[])[0]

  return {
    day: 0,
    phase: 'playing',
    scenario: scenario.openingSentence,
    player: {
      id: 'player',
      gold: scenario.player.gold,
      inventory: { apple: scenario.player.inventory.apple ?? 0 },
      buildings: [],
      netWorthHistory: [],
    },
    tex: {
      id: 'tex',
      gold: scenario.tex.gold,
      inventory: { apple: scenario.tex.inventory.apple ?? 0 },
      buildings: [],
      netWorthHistory: [],
    },
    market: {
      resources: {
        apple: {
          resourceId: 'apple',
          currentPrice: appleResource.basePrice,
          equilibriumPrice: appleResource.equilibriumPrice,
          elasticityK: appleResource.elasticityK,
          volumeAvailable: appleResource.startingVolume,
          priceHistory: [{ day: 0, price: appleResource.basePrice }],
        },
      },
    },
    map: { nodes: MAP_NODES.map(n => ({ ...n })) },
    log: [],
    pendingRumors: [],
    activeRumors: [],
    wonder: {
      id: 'tower_of_magic',
      name: wonder.name,
      requiredResources: wonder.requiredResources,
      playerContributed: {},
      texContributed: {},
      complete: false,
    },
    shareRegistry: [],
  }
}
