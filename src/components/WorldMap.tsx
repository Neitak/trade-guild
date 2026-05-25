import type { GameState } from '../engine/types'
import { previewBuyShare } from '../engine/shares'
import buildingDefs from '../data/buildings.json'

function getBuildingCostLabel(defId: string): string {
  const def = (buildingDefs as any[]).find(b => b.id === defId)
  if (!def) return ''
  if (def.costGold) return `${def.costGold} or`
  if (def.costResources?.apple) return `${def.costResources.apple} 🍎`
  return ''
}

function canAffordBuilding(defId: string, state: GameState): boolean {
  const def = (buildingDefs as any[]).find(b => b.id === defId)
  if (!def) return false
  if (def.costGold) return state.player.gold >= def.costGold
  if (def.costResources?.apple) return (state.player.inventory.apple ?? 0) >= def.costResources.apple
  return false
}

interface Props {
  state: GameState
  onBuyBuilding: (defId: 'orchard' | 'fruit_market') => void
  onBuyShare: (instanceId: string) => void
}

const NODE_POSITIONS: Record<string, { x: number; y: number; label: string; icon: string }> = {
  orchard_slot_1:  { x: 160, y: 120, label: 'Verger du Vallon',    icon: '🌳' },
  orchard_slot_2:  { x: 380, y: 80,  label: 'Verger des Collines', icon: '🌳' },
  market_slot_1:   { x: 280, y: 240, label: 'Place du Marché',     icon: '🏪' },
  market_slot_2:   { x: 100, y: 260, label: 'Carrefour Nord',      icon: '🏪' },
  wonder_slot:     { x: 480, y: 200, label: 'Tour de Magie',       icon: '🗼' },
}

const EDGES = [
  ['orchard_slot_1', 'market_slot_1'],
  ['orchard_slot_2', 'market_slot_1'],
  ['market_slot_1', 'market_slot_2'],
  ['market_slot_1', 'wonder_slot'],
  ['orchard_slot_2', 'wonder_slot'],
]

export function WorldMap({ state, onBuyBuilding, onBuyShare }: Props) {
  const { map, player, tex } = state

  // Find which buildings are on which node
  function getNodeOwner(nodeId: string) {
    const node = map.nodes.find(n => n.id === nodeId)
    return node?.ownedBy
  }
  function getNodeInstance(nodeId: string) {
    const node = map.nodes.find(n => n.id === nodeId)
    return node?.buildingInstanceId
  }
  function getNodeDef(nodeId: string) {
    const node = map.nodes.find(n => n.id === nodeId)
    return node?.buildingDefId
  }

  function getOwnerColor(owner?: string) {
    if (owner === 'player') return 'var(--player-color)'
    if (owner === 'tex') return 'var(--tex-color)'
    return 'var(--text-muted)'
  }

  function renderShareInfo(instanceId: string) {
    const playerShares = player.buildings.find(b => b.instanceId === instanceId)?.shares ?? 0
    const texShares = tex.buildings.find(b => b.instanceId === instanceId)?.shares ?? 0
    return `Toi: ${playerShares}% — Tex: ${texShares}%`
  }

  // Wonder progress
  const required = state.wonder.requiredResources.apple ?? 0
  const playerPct = Math.round(((state.wonder.playerContributed.apple ?? 0) / required) * 100)
  const texPct = Math.round(((state.wonder.texContributed.apple ?? 0) / required) * 100)

  const svgW = 580
  const svgH = 340

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '0.9rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>
        CARTE
      </h2>

      {/* Rumors */}
      {state.activeRumors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {state.activeRumors.slice(-3).map((r, i) => (
            <div key={i} style={{
              background: 'rgba(201,168,76,0.08)',
              border: '1px solid var(--accent-dim)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: '0.78rem',
              color: 'var(--text-dim)',
              fontStyle: 'italic',
              animation: 'fadeIn 0.3s ease',
            }}>
              📜 {r.text}
            </div>
          ))}
        </div>
      )}

      {/* SVG Map */}
      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ flex: 1 }}>
        {/* Edges */}
        {EDGES.map(([from, to], i) => {
          const a = NODE_POSITIONS[from]
          const b = NODE_POSITIONS[to]
          if (!a || !b) return null
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="rgba(201,168,76,0.15)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
          )
        })}

        {/* Nodes */}
        {Object.entries(NODE_POSITIONS).map(([nodeId, pos]) => {
          const owner = getNodeOwner(nodeId)
          const instanceId = getNodeInstance(nodeId)
          const defId = getNodeDef(nodeId)
          const color = getOwnerColor(owner)
          const isWonder = nodeId === 'wonder_slot'

          // Can player buy this building?
          const canBuy = !owner && defId && defId !== undefined
          const canShare = owner === 'tex' && instanceId

          // Share preview
          const sharePreview = canShare ? previewBuyShare(state, instanceId!) : null

          return (
            <g key={nodeId}>
              {/* Node circle */}
              <circle
                cx={pos.x} cy={pos.y} r={isWonder ? 28 : 22}
                fill="var(--bg-card)"
                stroke={color}
                strokeWidth={owner ? 2 : 1}
                style={{ filter: owner ? `drop-shadow(0 0 6px ${color}40)` : undefined }}
              />

              {/* Icon */}
              <text
                x={pos.x} y={pos.y + 6}
                textAnchor="middle"
                fontSize={isWonder ? 18 : 14}
              >{pos.icon}</text>

              {/* Wonder progress arc */}
              {isWonder && (
                <>
                  <text x={pos.x} y={pos.y + 50} textAnchor="middle" fontSize={9} fill="var(--player-color)">
                    Toi {playerPct}%
                  </text>
                  <text x={pos.x} y={pos.y + 62} textAnchor="middle" fontSize={9} fill="var(--tex-color)">
                    Tex {texPct}%
                  </text>
                </>
              )}

              {/* Label */}
              <text x={pos.x} y={pos.y + (isWonder ? 38 : 32)} textAnchor="middle" fontSize={9} fill="var(--text-dim)">
                {pos.label}
              </text>

              {/* Owner badge */}
              {owner && instanceId && (
                <text x={pos.x} y={pos.y - 26} textAnchor="middle" fontSize={8} fill={color}>
                  {renderShareInfo(instanceId)}
                </text>
              )}

              {/* Buy building button */}
              {canBuy && defId && (
                <foreignObject x={pos.x - 65} y={pos.y + 36} width={130} height={22}>
                  <button
                    className="btn-secondary"
                    style={{
                      width: '100%', padding: '2px 0', fontSize: '0.65rem',
                      opacity: canAffordBuilding(defId, state) ? 1 : 0.45,
                    }}
                    disabled={!canAffordBuilding(defId, state)}
                    onClick={() => onBuyBuilding(defId as 'orchard' | 'fruit_market')}
                  >
                    {getBuildingCostLabel(defId)} — Acheter
                  </button>
                </foreignObject>
              )}

              {/* Buy share button */}
              {sharePreview && (
                <foreignObject x={pos.x - 65} y={pos.y + 36} width={130} height={22}>
                  <button
                    className="btn-secondary"
                    style={{ width: '100%', padding: '2px 0', fontSize: '0.65rem', borderColor: 'var(--tex-color)' }}
                    title={`Acheter 10% pour ${sharePreview.cost} or → +${sharePreview.playerCutPerDay} pommes/j`}
                    onClick={() => onBuyShare(instanceId!)}
                    disabled={!sharePreview.canAfford}
                  >
                    Part 10% ({sharePreview.cost}or)
                  </button>
                </foreignObject>
              )}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--player-color)' }}>■ Toi</span>
        <span style={{ color: 'var(--tex-color)' }}>■ Tex</span>
        <span>□ Disponible</span>
      </div>
    </div>
  )
}
