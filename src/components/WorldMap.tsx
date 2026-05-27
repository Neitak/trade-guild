import { useState, useEffect, useRef } from 'react'
import type { GameState, BuildingId, GuildId } from '../engine/types'
import { GUILD_COLORS } from '../engine/types'
import { previewBuyShare } from '../engine/shares'
import buildingDefs from '../data/buildings.json'
import bgMap from '../../images/bg01.png'

function getBuildingCostLabel(defId: string): string {
  const def = (buildingDefs as any[]).find(b => b.id === defId)
  if (!def) return ''
  if (def.costGold) return `${def.costGold} or`
  if (def.costResources?.apple) return `${def.costResources.apple} 🍎`
  if (def.costResources?.wood)  return `${def.costResources.wood} 🪵`
  return ''
}

function canAffordBuilding(defId: string, state: GameState): boolean {
  const def = (buildingDefs as any[]).find(b => b.id === defId)
  if (!def) return false
  if (def.costGold) return state.player.gold >= def.costGold
  if (def.costResources?.apple) return (state.player.inventory.apple ?? 0) >= def.costResources.apple
  if (def.costResources?.wood)  return (state.player.inventory.wood  ?? 0) >= def.costResources.wood
  return false
}

interface Props {
  state: GameState
  onBuyBuilding: (defId: BuildingId) => void
  onBuyShare: (instanceId: string) => void
}

// ─── Node positions match init.ts MAP_NODES coordinates ─────────────────────
const NODE_POSITIONS: Record<string, { x: number; y: number; label: string; icon: string }> = {
  // Apple filière (left)
  orchard_slot_1:    { x: 100, y:  90, label: 'Verger du Vallon',    icon: '🌳' },
  orchard_slot_2:    { x: 215, y:  50, label: 'Verger des Collines', icon: '🌳' },
  market_slot_1:     { x: 145, y: 215, label: 'Place du Marché',     icon: '🏪' },
  market_slot_2:     { x:  55, y: 275, label: 'Carrefour Nord',      icon: '🏪' },
  // Wonders (center)
  wonder_slot:       { x: 365, y:  90, label: 'Tour de Magie',       icon: '🗼' },
  cathedrale_slot:   { x: 365, y: 265, label: 'Grande Cathédrale',   icon: '⛪' },
  // Wood filière (right)
  scierie_slot_1:    { x: 540, y:  75, label: 'Scierie Bois Neuf',   icon: '🪵' },
  scierie_slot_2:    { x: 650, y: 125, label: 'Scierie des Hauteurs', icon: '🪵' },
  menuiserie_slot_1: { x: 575, y: 215, label: 'Atelier du Bois',     icon: '🔨' },
  menuiserie_slot_2: { x: 660, y: 280, label: 'Grande Menuiserie',   icon: '🔨' },
}

const EDGES = [
  // Apple filière
  ['orchard_slot_1', 'market_slot_1'],
  ['orchard_slot_2', 'market_slot_1'],
  ['market_slot_1',  'market_slot_2'],
  ['orchard_slot_2', 'wonder_slot'],
  ['market_slot_1',  'wonder_slot'],
  // Wood filière
  ['scierie_slot_1',    'menuiserie_slot_1'],
  ['scierie_slot_2',    'menuiserie_slot_1'],
  ['menuiserie_slot_1', 'menuiserie_slot_2'],
  ['scierie_slot_2',    'cathedrale_slot'],
  ['menuiserie_slot_1', 'cathedrale_slot'],
  // Center axis between the two wonders
  ['wonder_slot', 'cathedrale_slot'],
]

export function WorldMap({ state, onBuyBuilding, onBuyShare }: Props) {
  const { map, player, rivals, wonders, rivalStrategies } = state

  // 2b — Pulse animation on newly acquired nodes
  const [pulsingNodes, setPulsingNodes] = useState<Set<string>>(new Set())
  const prevNodesRef = useRef(map.nodes)
  useEffect(() => {
    const prev = prevNodesRef.current
    const newlyOwned = map.nodes
      .filter(n => n.ownedBy === 'player' && prev.find(p => p.id === n.id)?.ownedBy !== 'player')
      .map(n => n.id)
    if (newlyOwned.length > 0) {
      setPulsingNodes(s => new Set([...s, ...newlyOwned]))
      setTimeout(() => {
        setPulsingNodes(s => { const next = new Set(s); newlyOwned.forEach(id => next.delete(id)); return next })
      }, 1400)
    }
    prevNodesRef.current = map.nodes
  }, [map.nodes])

  function getNodeOwner(nodeId: string) {
    return map.nodes.find(n => n.id === nodeId)?.ownedBy
  }
  function getNodeInstance(nodeId: string) {
    return map.nodes.find(n => n.id === nodeId)?.buildingInstanceId
  }
  function getNodeDef(nodeId: string) {
    return map.nodes.find(n => n.id === nodeId)?.buildingDefId
  }
  function getOwnerColor(owner?: GuildId | string) {
    if (!owner) return 'var(--text-muted)'
    return GUILD_COLORS[owner as GuildId] ?? 'var(--text-muted)'
  }
  function getOwnerFill(owner?: GuildId | string) {
    if (owner === 'player') return 'rgba(76,138,201,0.45)'
    if (owner === 'tex')    return 'rgba(201,76,76,0.3)'
    if (owner === 'sam')    return 'rgba(155,89,182,0.3)'
    if (owner === 'rita')   return 'rgba(230,126,34,0.3)'
    return 'rgba(18,18,36,0.88)'
  }
  function renderShareInfo(instanceId: string) {
    const playerShares = player.buildings.find(b => b.instanceId === instanceId)?.shares ?? 0
    const ownerRival   = rivals.find(r => r.buildings.some(b => b.instanceId === instanceId))
    const rivalShares  = ownerRival?.buildings.find(b => b.instanceId === instanceId)?.shares ?? 0
    const rivalName    = ownerRival?.name ?? 'Rival'
    return `Toi: ${playerShares}% — ${rivalName}: ${rivalShares}%`
  }

  // Wonder progress per wonder node — player vs best rival
  const tower     = wonders.find(w => w.id === 'tower_of_magic')!
  const cathedrale = wonders.find(w => w.id === 'grande_cathedrale')!

  const towerReq    = tower.requiredResources.apple ?? 800
  const cathedReq   = cathedrale.requiredResources.wood ?? 400
  const towerPlayerPct  = Math.round(((tower.playerContributed.apple ?? 0) / towerReq) * 100)
  const towerTexPct     = Math.round((Math.max(...rivals.map(r => tower.rivalContributed[r.id]?.apple ?? 0)) / towerReq) * 100)
  const cathedPlayerPct = Math.round(((cathedrale.playerContributed.wood ?? 0) / cathedReq) * 100)
  const cathedTexPct    = Math.round((Math.max(...rivals.map(r => cathedrale.rivalContributed[r.id]?.wood ?? 0)) / cathedReq) * 100)
  const leadingRival    = rivals.reduce((best, r) => (r.netWorthHistory.at(-1)?.value ?? 0) > (best.netWorthHistory.at(-1)?.value ?? 0) ? r : best, rivals[0])

  const svgW = 720
  const svgH = 380

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '0.9rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>
        CARTE
      </h2>

      {/* Rumors */}
      {state.activeRumors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[...new Map(state.activeRumors.map(r => [r.text, r])).values()].slice(-3).map((r, i) => (
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
      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ flex: 1, borderRadius: 8 }}>
        <image href={bgMap} x={0} y={0} width={svgW} height={svgH} preserveAspectRatio="xMidYMid slice" />
        <rect x={0} y={0} width={svgW} height={svgH} fill="rgba(10,10,25,0.45)" />
        {/* Edges */}
        {EDGES.map(([from, to], i) => {
          const a = NODE_POSITIONS[from]
          const b = NODE_POSITIONS[to]
          if (!a || !b) return null
          // Style center axis differently
          const isCenterAxis = (from === 'wonder_slot' && to === 'cathedrale_slot')
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={isCenterAxis ? 'rgba(201,168,76,0.08)' : 'rgba(201,168,76,0.15)'}
              strokeWidth={isCenterAxis ? 1 : 1.5}
              strokeDasharray="6 4"
            />
          )
        })}

        {/* Nodes */}
        {Object.entries(NODE_POSITIONS).map(([nodeId, pos]) => {
          const mapNode  = map.nodes.find(n => n.id === nodeId)
          const isLocked = mapNode?.locked ?? false
          const owner    = isLocked ? undefined : getNodeOwner(nodeId)
          const instanceId = isLocked ? undefined : getNodeInstance(nodeId)
          const defId    = isLocked ? undefined : getNodeDef(nodeId)
          const color    = isLocked ? 'rgba(120,120,140,0.3)' : getOwnerColor(owner)
          const isWonder = nodeId === 'wonder_slot' || nodeId === 'cathedrale_slot'
          const isTower  = nodeId === 'wonder_slot'
          const isCathed = nodeId === 'cathedrale_slot'

          const canBuy   = !isLocked && !owner && !!defId
          const canShare = !isLocked && !!owner && owner !== 'player' && !!instanceId
          const sharePreview = canShare ? previewBuyShare(state, instanceId!) : null

          // Degradation of owned Tier 1 building
          const ownedBuilding = instanceId
            ? (player.buildings.find(b => b.instanceId === instanceId) ?? rivals.flatMap(r => r.buildings).find(b => b.instanceId === instanceId))
            : undefined
          const degradation = ownedBuilding?.degradation ?? 0
          const degradPct = Math.round(degradation * 100)

          // 2a — Production label for owned non-wonder nodes
          const buildingDef = defId ? (buildingDefs as any[]).find(d => d.id === defId) : null
          const effectiveProd = buildingDef?.productionPerDay
            ? Math.round(buildingDef.productionPerDay * (1 - degradation))
            : 0
          const dailyRevenue = buildingDef?.revenuePerDay ?? 0
          const prodIcon = buildingDef?.produces === 'apple' ? '🍎' : buildingDef?.produces === 'wood' ? '🪵' : null
          const prodLabel = owner && !isWonder
            ? (effectiveProd > 0 && prodIcon ? `+${effectiveProd} ${prodIcon}/j` : dailyRevenue > 0 ? `+${dailyRevenue} or/j` : null)
            : null

          // Wonder-specific progress
          let pPct = 0, tPct = 0
          if (isTower)  { pPct = towerPlayerPct;  tPct = towerTexPct }
          if (isCathed) { pPct = cathedPlayerPct; tPct = cathedTexPct }

          const R = isWonder ? 28 : 24

          return (
            <g key={nodeId}>
              {/* 2b — Pulse ring: expands & fades on acquisition */}
              {pulsingNodes.has(nodeId) && (
                <circle
                  cx={pos.x} cy={pos.y} r={R + 8}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  style={{ animation: 'nodeAcquired 1.4s ease-out forwards' }}
                />
              )}

              {/* Outer glow ring — owned nodes only */}
              {owner && (
                <circle
                  cx={pos.x} cy={pos.y} r={R + 7}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.35}
                />
              )}

              {/* Node circle */}
              <circle
                cx={pos.x} cy={pos.y} r={R}
                fill={isLocked ? 'rgba(15,15,28,0.9)' : getOwnerFill(owner)}
                stroke={color}
                strokeWidth={owner ? 3 : (isLocked ? 0.8 : 1.5)}
                style={{ filter: owner ? `drop-shadow(0 0 10px ${color}70)` : undefined }}
              />

              {/* Icon — locked nodes show 🔒 */}
              <text
                x={pos.x} y={prodLabel ? pos.y + 2 : pos.y + 7}
                textAnchor="middle"
                fontSize={isWonder ? 22 : 16}
                opacity={isLocked ? 0.3 : 1}
              >{isLocked ? '🔒' : pos.icon}</text>

              {/* 2a — Production label inside owned node */}
              {prodLabel && (
                <text
                  x={pos.x} y={pos.y + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill={color}
                  fontFamily="var(--font-mono)"
                  opacity={0.9}
                >{prodLabel}</text>
              )}

              {/* Label */}
              <text
                x={pos.x} y={pos.y + R + 14}
                textAnchor="middle"
                fontSize={11}
                fill={isLocked ? 'rgba(120,120,140,0.4)' : 'var(--text-dim)'}
              >
                {isLocked ? '— bientôt —' : pos.label}
              </text>

              {/* Wonder progress text */}
              {isWonder && (
                <>
                  <text x={pos.x} y={pos.y + R + 26} textAnchor="middle" fontSize={10} fill="var(--player-color)" fontFamily="var(--font-mono)">
                    Toi {pPct}%
                  </text>
                  <text x={pos.x} y={pos.y + R + 38} textAnchor="middle" fontSize={10} fill="var(--tex-color)" fontFamily="var(--font-mono)">
                    Tex {tPct}%
                  </text>
                </>
              )}

              {/* Owner share info — below label */}
              {owner && instanceId && (
                <text x={pos.x} y={pos.y + R + 26} textAnchor="middle" fontSize={9} fill={color} fontFamily="var(--font-mono)">
                  {renderShareInfo(instanceId)}
                </text>
              )}

              {/* Degradation indicator */}
              {!isLocked && !isWonder && degradPct >= 15 && (
                <text x={pos.x} y={pos.y - R - 10} textAnchor="middle" fontSize={9} fill={degradPct >= 30 ? '#c96060' : '#c9a84c'}>
                  {degradPct >= 30 ? '🍂' : '🌿'} −{degradPct}%
                </text>
              )}

              {/* Buy building button */}
              {canBuy && defId && (
                <foreignObject x={pos.x - 65} y={pos.y + R + 14} width={130} height={22}>
                  <button
                    className="btn-secondary"
                    style={{
                      width: '100%', padding: '2px 0', fontSize: '0.65rem',
                      opacity: canAffordBuilding(defId, state) ? 1 : 0.45,
                    }}
                    disabled={!canAffordBuilding(defId, state)}
                    onClick={() => onBuyBuilding(defId as BuildingId)}
                  >
                    {getBuildingCostLabel(defId)} — Acheter
                  </button>
                </foreignObject>
              )}

              {/* Buy share button */}
              {sharePreview && (
                <foreignObject x={pos.x - 65} y={pos.y + R + 36} width={130} height={22}>
                  <button
                    className="btn-secondary"
                    style={{ width: '100%', padding: '2px 0', fontSize: '0.65rem', borderColor: sharePreview.ownerColor }}
                    title={`Acheter 10% de ${sharePreview.ownerName} pour ${sharePreview.cost} or → +${sharePreview.playerCutPerDay}/j`}
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
      <div style={{ display: 'flex', gap: 12, fontSize: '0.7rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--player-color)' }}>■ Toi</span>
        {rivals.map(r => (
          <span key={r.id} style={{ color: r.color }}>■ {r.name}</span>
        ))}
        <span>□ Disponible</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
          ⚔ {leadingRival.name} → {rivalStrategies[leadingRival.id]?.preferredResource === 'wood' ? 'Bois' : 'Pommes'}
        </span>
      </div>
    </div>
  )
}
