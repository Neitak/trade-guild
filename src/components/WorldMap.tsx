import { useState, useEffect, useRef } from 'react'
import type { GameState, BuildingId, GuildId } from '../engine/types'
import { GUILD_COLORS } from '../engine/types'
import { previewBuyShare } from '../engine/shares'
import { SAWMILL_PRODUCTION, AUBERGE_REVENUE } from '../engine/buildings'
import buildingDefs from '../data/buildings.json'
import bgMap from '../../images/bg01.png'

function getBuildingCostLabel(defId: string): string {
  const def = (buildingDefs as any[]).find(b => b.id === defId)
  if (!def) return ''
  const parts: string[] = []
  if (def.costGold) parts.push(`${def.costGold}or`)
  if (def.costResources?.wood)   parts.push(`${def.costResources.wood}🪵`)
  if (def.costResources?.pierre) parts.push(`${def.costResources.pierre}🗿`)
  if (def.costResources?.apple)  parts.push(`${def.costResources.apple}🍎`)
  if (def.costResources?.meuble) parts.push(`${def.costResources.meuble}🪑`)
  return parts.join('+')
}

function canAffordBuilding(defId: string, state: GameState): boolean {
  const def = (buildingDefs as any[]).find(b => b.id === defId)
  if (!def) return false
  if (def.costGold && state.player.gold < def.costGold) return false
  if (def.costResources) {
    const inv = state.player.inventory
    for (const [res, qty] of Object.entries(def.costResources)) {
      if ((inv[res as keyof typeof inv] ?? 0) < (qty as number)) return false
    }
  }
  return true
}

interface Props {
  state: GameState
  onBuyBuilding: (defId: BuildingId) => void
  onBuyShare: (instanceId: string) => void
  onUpgradeBuilding: (instanceId: string) => void
}

// ─── Node positions — match init.ts MAP_NODES exactly ────────────────────────
const NODE_POSITIONS: Record<string, { x: number; y: number; label: string; icon: string }> = {
  // Capitale
  auberge_slot_1:       { x: 100, y:  68, label: 'Auberge du Carrefour', icon: '🏨' },
  wonder_slot:          { x: 270, y:  68, label: 'Tour de Magie',        icon: '🗼' },
  cathedrale_slot:      { x: 450, y:  68, label: 'Grande Cathédrale',    icon: '⛪' },
  auberge_slot_2:       { x: 620, y:  68, label: 'Grande Auberge',       icon: '🏨' },
  // Artisanale
  charpenterie_slot_1:  { x: 125, y: 195, label: 'Atelier Charron',      icon: '🪑' },
  market_slot_1:        { x: 295, y: 195, label: 'Place du Marché',      icon: '🏪' },
  market_slot_2:        { x: 395, y: 195, label: 'Carrefour Nord',       icon: '🏪' },
  menuiserie_slot_1:    { x: 545, y: 195, label: 'Atelier du Bois',      icon: '🔨' },
  menuiserie_slot_2:    { x: 660, y: 195, label: 'Grande Menuiserie',    icon: '🔨' },
  // Champs
  orchard_slot_1:       { x:  80, y: 350, label: 'Verger du Vallon',     icon: '🌳' },
  orchard_slot_2:       { x: 200, y: 385, label: 'Verger des Collines',  icon: '🌳' },
  carriere_slot_1:      { x: 360, y: 345, label: 'Carrière du Vallon',   icon: '🗿' },
  carriere_slot_2:      { x: 470, y: 385, label: 'Carrière du Nord',     icon: '🗿' },
  scierie_slot_1:       { x: 580, y: 345, label: 'Scierie Bois Neuf',    icon: '🪵' },
  scierie_slot_2:       { x: 670, y: 388, label: 'Scierie des Hauteurs', icon: '🪵' },
}

const EDGES: [string, string][] = [
  // Apple → Artisanale
  ['orchard_slot_1', 'market_slot_1'],
  ['orchard_slot_2', 'market_slot_1'],
  // Wood → Artisanale
  ['scierie_slot_1', 'menuiserie_slot_1'],
  ['scierie_slot_2', 'menuiserie_slot_1'],
  ['scierie_slot_1', 'charpenterie_slot_1'],
  // Artisanale → Capitale (wonders)
  ['menuiserie_slot_1', 'cathedrale_slot'],
  ['market_slot_1',     'wonder_slot'],
  ['charpenterie_slot_1', 'cathedrale_slot'],
  // Artisanale → Capitale (auberge — needs bois + pierre + or)
  ['charpenterie_slot_1', 'auberge_slot_1'],
  ['menuiserie_slot_1',   'auberge_slot_2'],
]

// ─── Zone bands ───────────────────────────────────────────────────────────────
const ZONES = [
  { label: 'LA CAPITALE',          yStart: 0,   yEnd: 118, color: 'rgba(201,168,76,0.04)' },
  { label: 'ZONE ARTISANALE',      yStart: 126, yEnd: 254, color: 'rgba(155,89,182,0.05)' },
  { label: 'CHAMPS & EXTRACTION',  yStart: 262, yEnd: 460, color: 'rgba(76,138,80,0.04)' },
]

const svgW = 720
const svgH = 460

// Upgrade cost table visible in UI
const UPGRADE_COSTS: Record<number, number> = { 1: 25, 2: 50, 3: 100, 4: 200 }

export function WorldMap({ state, onBuyBuilding, onBuyShare, onUpgradeBuilding }: Props) {
  const { map, player, rivals, wonders, rivalStrategies } = state

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
    if (owner === 'brice')  return 'rgba(201,76,76,0.30)'
    if (owner === 'raph')   return 'rgba(155,89,182,0.30)'
    if (owner === 'rita')   return 'rgba(230,126,34,0.30)'
    return 'rgba(18,18,36,0.88)'
  }
  function renderShareInfo(instanceId: string) {
    const playerShares = player.buildings.find(b => b.instanceId === instanceId)?.shares ?? 0
    const ownerRival   = rivals.find(r => r.buildings.some(b => b.instanceId === instanceId))
    const rivalShares  = ownerRival?.buildings.find(b => b.instanceId === instanceId)?.shares ?? 0
    const rivalName    = ownerRival?.name ?? 'Rival'
    return `Toi: ${playerShares}% — ${rivalName}: ${rivalShares}%`
  }

  // Wonder progress
  const tower      = wonders.find(w => w.id === 'tower_of_magic')!
  const cathedrale = wonders.find(w => w.id === 'grande_cathedrale')!
  const towerReq   = tower.requiredResources.apple ?? 800
  const cathedReq  = cathedrale.requiredResources.wood ?? 400

  const bestRivalTower  = Math.max(...rivals.map(r => tower.rivalContributed[r.id]?.apple ?? 0))
  const bestRivalCathed = Math.max(...rivals.map(r => cathedrale.rivalContributed[r.id]?.wood ?? 0))

  const towerPlayerPct  = Math.round(((tower.playerContributed.apple ?? 0) / towerReq) * 100)
  const towerRivalPct   = Math.round((bestRivalTower / towerReq) * 100)
  const cathedPlayerPct = Math.round(((cathedrale.playerContributed.wood ?? 0) / cathedReq) * 100)
  const cathedRivalPct  = Math.round((bestRivalCathed / cathedReq) * 100)

  const leadingRival = rivals.reduce(
    (best, r) => (r.netWorthHistory.at(-1)?.value ?? 0) > (best.netWorthHistory.at(-1)?.value ?? 0) ? r : best,
    rivals[0]
  )

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '0.9rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>
        CARTE
      </h2>

      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ flex: 1, borderRadius: 8 }}>
        <image href={bgMap} x={0} y={0} width={svgW} height={svgH} preserveAspectRatio="xMidYMid slice" />
        <rect x={0} y={0} width={svgW} height={svgH} fill="rgba(10,10,25,0.50)" />

        {/* Zone bands */}
        {ZONES.map(z => (
          <g key={z.label}>
            <rect x={0} y={z.yStart} width={svgW} height={z.yEnd - z.yStart} fill={z.color} />
            <rect x={0} y={z.yEnd}   width={svgW} height={1} fill="rgba(201,168,76,0.08)" />
            <text x={8} y={z.yStart + 14} fontSize={9} fill="rgba(201,168,76,0.35)" fontFamily="var(--font-ui)" letterSpacing="0.12em">
              {z.label}
            </text>
          </g>
        ))}

        {/* Edges */}
        {EDGES.map(([from, to], i) => {
          const a = NODE_POSITIONS[from]
          const b = NODE_POSITIONS[to]
          if (!a || !b) return null
          const aOwner = getNodeOwner(from)
          const bOwner = getNodeOwner(to)
          const bothOwned = aOwner === 'player' && bOwner === 'player'
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={bothOwned ? 'rgba(76,175,106,0.40)' : 'rgba(201,168,76,0.12)'}
              strokeWidth={bothOwned ? 2 : 1.5}
              strokeDasharray="6 4"
            />
          )
        })}

        {/* Nodes */}
        {Object.entries(NODE_POSITIONS).map(([nodeId, pos]) => {
          const mapNode    = map.nodes.find(n => n.id === nodeId)
          const isLocked   = mapNode?.locked ?? false
          const owner      = isLocked ? undefined : getNodeOwner(nodeId)
          const instanceId = isLocked ? undefined : getNodeInstance(nodeId)
          const defId      = isLocked ? undefined : getNodeDef(nodeId)
          const color      = isLocked ? 'rgba(120,120,140,0.3)' : getOwnerColor(owner)
          const isWonder   = nodeId === 'wonder_slot' || nodeId === 'cathedrale_slot'
          const isTower    = nodeId === 'wonder_slot'
          const isCathed   = nodeId === 'cathedrale_slot'

          const canBuy   = !isLocked && !owner && !!defId
          const canShare = !isLocked && !!owner && owner !== 'player' && !!instanceId
          const sharePreview = canShare ? previewBuyShare(state, instanceId!) : null

          // Degradation
          const ownedBuilding = instanceId
            ? (player.buildings.find(b => b.instanceId === instanceId) ?? rivals.flatMap(r => r.buildings).find(b => b.instanceId === instanceId))
            : undefined
          const degradation = ownedBuilding?.degradation ?? 0
          const degradPct   = Math.round(degradation * 100)

          // Production label
          const buildingDef = defId ? (buildingDefs as any[]).find(d => d.id === defId) : null
          const level = ownedBuilding?.level ?? 1
          const baseProduction = buildingDef?.productionPerDay ?? 0
          const levelBonus = buildingDef?.upgradable && buildingDef?.produces ? (SAWMILL_PRODUCTION[level] / SAWMILL_PRODUCTION[1]) : 1
          const effectiveProd = buildingDef?.productionPerDay
            ? Math.round(baseProduction * levelBonus * (1 - degradation))
            : 0
          // Revenue: auberge uses AUBERGE_REVENUE table; others use flat revenuePerDay
          const isAuberge = buildingDef?.id === 'auberge'
          const dailyRevenue = isAuberge
            ? (AUBERGE_REVENUE[level] ?? buildingDef?.revenuePerDay ?? 0)
            : (buildingDef?.revenuePerDay ?? 0)
          const prodIcon = buildingDef?.produces === 'apple' ? '🍎'
                         : buildingDef?.produces === 'wood'  ? '🪵'
                         : buildingDef?.produces === 'pierre' ? '🗿'
                         : buildingDef?.produces === 'meuble' ? '🪑'
                         : null
          const prodLabel = owner && !isWonder
            ? (effectiveProd > 0 && prodIcon ? `+${effectiveProd} ${prodIcon}/j` : dailyRevenue > 0 ? `+${dailyRevenue}or/j` : null)
            : null

          // Upgrade info
          const isPlayerOwned = owner === 'player'
          const isUpgradable = buildingDef?.upgradable && isPlayerOwned && instanceId
          const maxLevel = buildingDef?.maxLevel ?? 5
          // Gold upgrade (sawmill) vs CONFORT upgrade (auberge)
          const isConfortUpgrade = isUpgradable && !!buildingDef?.upgradeResourceId
          const upgradeCost = !isConfortUpgrade && isUpgradable ? (UPGRADE_COSTS[level] ?? null) : null
          const confortCost = isConfortUpgrade ? (buildingDef?.upgradeResourceCosts?.[String(level)] ?? null) : null
          const canAffordUpgrade = upgradeCost != null && state.player.gold >= upgradeCost
          const canAffordConfort = confortCost != null && (state.player.inventory.meuble ?? 0) >= confortCost

          // Wonder progress
          let pPct = 0, rPct = 0
          if (isTower)  { pPct = towerPlayerPct;  rPct = towerRivalPct }
          if (isCathed) { pPct = cathedPlayerPct; rPct = cathedRivalPct }

          const R = isWonder ? 28 : 22

          return (
            <g key={nodeId}>
              {pulsingNodes.has(nodeId) && (
                <circle cx={pos.x} cy={pos.y} r={R + 8} fill="none" stroke={color} strokeWidth={2.5}
                  style={{ animation: 'nodeAcquired 1.4s ease-out forwards' }} />
              )}
              {owner && (
                <circle cx={pos.x} cy={pos.y} r={R + 7} fill="none" stroke={color} strokeWidth={1.5} opacity={0.35} />
              )}
              <circle
                cx={pos.x} cy={pos.y} r={R}
                fill={isLocked ? 'rgba(15,15,28,0.9)' : getOwnerFill(owner)}
                stroke={color}
                strokeWidth={owner ? 3 : (isLocked ? 0.8 : 1.5)}
                style={{ filter: owner ? `drop-shadow(0 0 10px ${color}70)` : undefined }}
              />

              {/* Icon */}
              <text
                x={pos.x} y={prodLabel ? pos.y + 2 : pos.y + 7}
                textAnchor="middle" fontSize={isWonder ? 22 : 14}
                opacity={isLocked ? 0.3 : 1}
              >{isLocked ? '🔒' : pos.icon}</text>

              {/* Level badge (upgradable buildings) */}
              {owner && buildingDef?.upgradable && level > 1 && (
                <text x={pos.x + R - 4} y={pos.y - R + 8} textAnchor="middle" fontSize={9}
                  fill="var(--accent)" fontFamily="var(--font-mono)">T{level}</text>
              )}

              {/* Production label */}
              {prodLabel && (
                <text x={pos.x} y={pos.y + 14} textAnchor="middle" fontSize={9}
                  fill={color} fontFamily="var(--font-mono)" opacity={0.9}>{prodLabel}</text>
              )}

              {/* Node label */}
              <text
                x={pos.x} y={pos.y + R + 13} textAnchor="middle" fontSize={10}
                fill={isLocked ? 'rgba(120,120,140,0.4)' : 'var(--text-dim)'}
              >{isLocked ? '— bientôt —' : pos.label}</text>

              {/* Wonder progress */}
              {isWonder && (
                <>
                  <text x={pos.x} y={pos.y + R + 25} textAnchor="middle" fontSize={10} fill="var(--player-color)" fontFamily="var(--font-mono)">Toi {pPct}%</text>
                  <text x={pos.x} y={pos.y + R + 37} textAnchor="middle" fontSize={10} fill="var(--text-muted)" fontFamily="var(--font-mono)">Rival {rPct}%</text>
                </>
              )}

              {/* Share info */}
              {owner && instanceId && !isWonder && (
                <text x={pos.x} y={pos.y + R + 24} textAnchor="middle" fontSize={8} fill={color} fontFamily="var(--font-mono)">
                  {renderShareInfo(instanceId)}
                </text>
              )}

              {/* Degradation */}
              {!isLocked && !isWonder && degradPct >= 15 && (
                <text x={pos.x} y={pos.y - R - 8} textAnchor="middle" fontSize={9} fill={degradPct >= 30 ? '#c96060' : '#c9a84c'}>
                  {degradPct >= 30 ? '🍂' : '🌿'} −{degradPct}%
                </text>
              )}

              {/* Buy building button */}
              {canBuy && defId && (
                <foreignObject x={pos.x - 60} y={pos.y + R + 14} width={120} height={22}>
                  <button
                    className="btn-secondary"
                    style={{ width: '100%', padding: '2px 0', fontSize: '0.62rem', opacity: canAffordBuilding(defId, state) ? 1 : 0.45 }}
                    disabled={!canAffordBuilding(defId, state)}
                    onClick={() => onBuyBuilding(defId as BuildingId)}
                  >
                    {getBuildingCostLabel(defId)} — Acheter
                  </button>
                </foreignObject>
              )}

              {/* Upgrade button — gold (sawmill) */}
              {isUpgradable && !isConfortUpgrade && level < maxLevel && upgradeCost != null && (
                <foreignObject x={pos.x - 60} y={pos.y + R + (owner && instanceId ? 36 : 14)} width={120} height={22}>
                  <button
                    className="btn-secondary"
                    style={{
                      width: '100%', padding: '2px 0', fontSize: '0.62rem',
                      borderColor: canAffordUpgrade ? 'var(--accent)' : undefined,
                      opacity: canAffordUpgrade ? 1 : 0.45,
                    }}
                    disabled={!canAffordUpgrade}
                    onClick={() => onUpgradeBuilding(instanceId!)}
                  >
                    ↑ T{level + 1} — {upgradeCost}or
                  </button>
                </foreignObject>
              )}

              {/* Upgrade button — CONFORT/meubles (auberge) */}
              {isConfortUpgrade && level < maxLevel && confortCost != null && (
                <foreignObject x={pos.x - 60} y={pos.y + R + (owner && instanceId ? 36 : 14)} width={120} height={22}>
                  <button
                    className="btn-secondary"
                    style={{
                      width: '100%', padding: '2px 0', fontSize: '0.62rem',
                      borderColor: canAffordConfort ? '#e67e22' : undefined,
                      opacity: canAffordConfort ? 1 : 0.45,
                    }}
                    disabled={!canAffordConfort}
                    onClick={() => onUpgradeBuilding(instanceId!)}
                  >
                    ↑ T{level + 1} — {confortCost}🪑
                  </button>
                </foreignObject>
              )}

              {/* Buy share button */}
              {sharePreview && (
                <foreignObject x={pos.x - 60} y={pos.y + R + 36} width={120} height={22}>
                  <button
                    className="btn-secondary"
                    style={{ width: '100%', padding: '2px 0', fontSize: '0.62rem', borderColor: sharePreview.ownerColor }}
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
        {rivals.filter(r => !!rivalStrategies[r.id]).map(r => (
          <span key={r.id} style={{ color: r.color }}>■ {r.name}</span>
        ))}
        <span>□ Disponible</span>
        {leadingRival && rivalStrategies[leadingRival.id] && (
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
            ⚔ {leadingRival.name} → {
              rivalStrategies[leadingRival.id]?.preferredResource === 'wood'   ? 'Bois' :
              rivalStrategies[leadingRival.id]?.preferredResource === 'pierre' ? 'Pierre' :
              rivalStrategies[leadingRival.id]?.preferredResource === 'meuble' ? 'Immobilier' : 'Pommes'
            }
          </span>
        )}
      </div>
    </div>
  )
}
