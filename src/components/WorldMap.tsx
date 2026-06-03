import { useState, useEffect, useRef, type ReactNode } from 'react'
import type { GameState, BuildingId, GuildId, SlotType } from '../engine/types'
import { GUILD_COLORS } from '../engine/types'
import { previewBuyShare, EFFECTIVE_CONTROL_THRESHOLD } from '../engine/shares'
import { SAWMILL_PRODUCTION, AUBERGE_REVENUE } from '../engine/buildings'
import buildingDefs from '../data/buildings.json'
import { AZUR } from '../theme'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RESOURCE_ICONS: Record<string, string> = {
  wood: '🪵', olive: '🫒', meuble: '🪑', huile: '🫙', pierre: '🗿',
}

// Resource-native colors — single source of truth in theme.ts (V8).
const RESOURCE_COLORS: Record<string, string> = AZUR.resources

function getBuildingCostLabel(defId: string): string {
  const def = (buildingDefs as any[]).find(b => b.id === defId)
  if (!def) return ''
  const parts: string[] = []
  if (def.costGold) parts.push(`${def.costGold}or`)
  if (def.costResources?.wood)   parts.push(`${def.costResources.wood}🪵`)
  if (def.costResources?.olive)  parts.push(`${def.costResources.olive}🫒`)
  if (def.costResources?.huile)  parts.push(`${def.costResources.huile}🫙`)
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

// Find all buildings available for a given slot type
function getBuildingsForSlot(slotType: SlotType): any[] {
  return (buildingDefs as any[]).filter(d => d.slotType === slotType)
}

function arcPath(cx: number, cy: number, r: number, pct: number): string {
  if (pct <= 0) return ''
  if (pct >= 100) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`
  const angle = -Math.PI / 2 + (pct / 100) * 2 * Math.PI
  const endX = cx + r * Math.cos(angle)
  const endY = cy + r * Math.sin(angle)
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${pct > 50 ? 1 : 0} 1 ${endX} ${endY}`
}

function notchCoords(cx: number, cy: number, r: number, pct: number) {
  const a = -Math.PI / 2 + (pct / 100) * 2 * Math.PI
  return {
    x1: cx + (r - 4) * Math.cos(a), y1: cy + (r - 4) * Math.sin(a),
    x2: cx + (r + 4) * Math.cos(a), y2: cy + (r + 4) * Math.sin(a),
  }
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
  commercial_slot_1: { x: 220, y:  68, label: 'Auberge du Carrefour', icon: '🏨' },
  wonder_slot:       { x: 360, y:  68, label: 'Tour de Magie',        icon: '🗼' },
  cathedrale_slot:   { x: 500, y:  68, label: 'Grande Cathédrale',    icon: '⛪' },
  commercial_slot_2: { x: 620, y:  68, label: 'Grande Auberge',       icon: '🏨' },
  // Artisanale
  workshop_slot_1:   { x: 270, y: 195, label: 'Atelier Sud',          icon: '🔨' },
  workshop_slot_2:   { x: 490, y: 195, label: 'Atelier Nord',         icon: '🔨' },
  // Champs
  farm_slot_1:       { x:  90, y: 350, label: 'Plaine des Oliviers',  icon: '🫒' },
  farm_slot_2:       { x: 230, y: 385, label: 'Collines Fertiles',    icon: '🫒' },
  extraction_slot_1: { x: 490, y: 350, label: 'Forêt du Bois Neuf',  icon: '🪵' },
  extraction_slot_2: { x: 620, y: 388, label: 'Forêt des Hauteurs',  icon: '🪵' },
}

const EDGES: [string, string][] = [
  // Farm → Workshop
  ['farm_slot_1',       'workshop_slot_1'],
  ['farm_slot_2',       'workshop_slot_1'],
  // Extraction → Workshop
  ['extraction_slot_1', 'workshop_slot_2'],
  ['extraction_slot_2', 'workshop_slot_2'],
  // Workshop → Commercial
  ['workshop_slot_1',   'commercial_slot_1'],
  ['workshop_slot_2',   'commercial_slot_2'],
  // Workshop → Wonders
  ['workshop_slot_2',   'cathedrale_slot'],
  ['workshop_slot_1',   'wonder_slot'],
]

// ─── Zone bands ───────────────────────────────────────────────────────────────
const ZONES = [
  { label: 'LA CAPITALE',          yStart: 0,   yEnd: 118, color: 'rgba(86,168,230,0.05)' },
  { label: 'ZONE ARTISANALE',      yStart: 126, yEnd: 254, color: 'rgba(86,168,230,0.04)' },
  { label: 'CHAMPS & EXTRACTION',  yStart: 262, yEnd: 460, color: 'rgba(86,168,230,0.03)' },
]

const svgW = 720
const svgH = 460
const UPGRADE_COSTS: Record<number, number> = { 1: 25, 2: 50, 3: 100, 4: 200 }

// ─── FloatCard — hover info overlay ─────────────────────────────────────────

interface FloatCardProps {
  nodeId: string
  pos: { x: number; y: number }
  state: GameState
}

function FloatCard({ nodeId, pos, state }: FloatCardProps) {
  const mapNode = state.map.nodes.find(n => n.id === nodeId)
  if (!mapNode || mapNode.locked) return null

  const isOwned  = !!mapNode.buildingInstanceId
  const isWonder = nodeId === 'wonder_slot' || nodeId === 'cathedrale_slot'
  if (isWonder) return null

  const ownedBuilding = mapNode.buildingInstanceId
    ? (state.player.buildings.find(b => b.instanceId === mapNode.buildingInstanceId)
       ?? state.rivals.flatMap(r => r.buildings).find(b => b.instanceId === mapNode.buildingInstanceId))
    : undefined
  const def = ownedBuilding
    ? (buildingDefs as any[]).find(d => d.id === ownedBuilding.defId)
    : null

  const available = !isOwned && mapNode.slotType ? getBuildingsForSlot(mapNode.slotType) : []

  const cardLeft = Math.max(4, pos.x - 85)

  return (
    <div className="float-card" style={{ left: cardLeft, top: pos.y }}>
      {isOwned && def ? (
        <>
          <span style={{ fontWeight: 600, color: mapNode.ownedBy === 'player' ? 'var(--player-color)' : 'var(--text)' }}>
            {mapNode.ownedBy === 'player' ? '✓ ' : ''}{def.name}
            {(ownedBuilding?.level ?? 1) > 1 ? ` T${ownedBuilding!.level}` : ''}
          </span>
          {def.produces && (
            <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontFamily: 'var(--font-num)' }}>
              +{def.productionPerDay} {RESOURCE_ICONS[def.produces] ?? ''}/j
            </span>
          )}
          {def.revenuePerDay > 0 && !def.produces && (
            <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontFamily: 'var(--font-num)' }}>
              +{def.revenuePerDay} or/j
            </span>
          )}
        </>
      ) : available.length > 0 ? (
        available.map((bd: any) => {
          const canAfford = canAffordBuilding(bd.id, state)
          return (
            <div key={bd.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600, color: canAfford ? 'var(--text)' : 'var(--text-muted)', fontSize: '0.84rem' }}>
                {bd.name}
              </span>
              <span style={{ fontSize: '0.70rem', fontFamily: 'var(--font-num)', color: canAfford ? 'var(--accent)' : 'var(--danger)' }}>
                {getBuildingCostLabel(bd.id)}
                {!canAfford && ' — insuffisant'}
              </span>
            </div>
          )
        })
      ) : null}
    </div>
  )
}

// ─── WorldMap ─────────────────────────────────────────────────────────────────

export function WorldMap({ state, onBuyBuilding, onBuyShare, onUpgradeBuilding }: Props) {
  const { map, player, rivals, wonders, rivalStrategies } = state

  const [pulsingNodes, setPulsingNodes] = useState<Set<string>>(new Set())
  const [hoveredNode, setHoveredNode] = useState<{ id: string; pos: { x: number; y: number } } | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const prevNodesRef = useRef(map.nodes)

  function svgPointToDOM(svgX: number, svgY: number): { x: number; y: number } | null {
    const svg = svgRef.current
    const wrapper = wrapperRef.current
    if (!svg || !wrapper) return null
    try {
      const pt = svg.createSVGPoint()
      pt.x = svgX
      pt.y = svgY
      const screenPt = pt.matrixTransform(svg.getScreenCTM()!)
      const wrapRect = wrapper.getBoundingClientRect()
      return { x: screenPt.x - wrapRect.left, y: screenPt.y - wrapRect.top }
    } catch {
      return null
    }
  }

  function openCard(nodeId: string, svgX: number, svgY: number, R: number) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    const pos = svgPointToDOM(svgX, svgY + R + 10)
    if (pos) setHoveredNode({ id: nodeId, pos })
  }

  function scheduleClose() {
    closeTimerRef.current = setTimeout(() => setHoveredNode(null), 120)
  }

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }, [])

  // ─── Responsive viewBox — fill the available container height ────────────────
  const [dims, setDims] = useState({ w: svgW, h: svgH })
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect
      if (cr.width > 0 && cr.height > 0) setDims({ w: cr.width, h: cr.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Uniform render scale (user units → screen px) and vertical spread factor.
  const s       = dims.w / svgW
  const viewH   = Math.max(svgH, svgW * dims.h / dims.w)
  const vSpread = viewH / svgH
  // foreignObject content scales with the SVG — counter-scale to keep true px size.
  const inv     = 1 / s

  // ─── Production floaters — "+N🫒" rising from producing buildings ────────────
  const [floaters, setFloaters] = useState<{ id: number; nodeId: string; text: string; color: string }[]>([])
  const floaterIdRef  = useRef(0)
  const processedLogRef = useRef(state.log.length) // skip events that predate mount

  function findNodeForProduction(actor: string, defId: string): string | null {
    const guild = actor === 'player' ? player : rivals.find(r => r.id === actor)
    const inst = guild?.buildings.find(b => b.defId === defId)
    if (!inst) return null
    return map.nodes.find(n => n.buildingInstanceId === inst.instanceId)?.id ?? null
  }

  useEffect(() => {
    const log = state.log
    if (log.length < processedLogRef.current) processedLogRef.current = 0 // new game reset
    const fresh = log.slice(processedLogRef.current)
    processedLogRef.current = log.length

    const spawned: typeof floaters = []
    for (const ev of fresh) {
      if (ev.type !== 'PRODUCTION') continue
      const qty = ev.payload.qty as number
      if (!qty || qty <= 0) continue
      const nodeId = findNodeForProduction(ev.actor, ev.payload.buildingId as string)
      if (!nodeId) continue
      const resource = ev.payload.resource as string
      spawned.push({
        id: ++floaterIdRef.current,
        nodeId,
        text: `+${qty} ${RESOURCE_ICONS[resource] ?? ''}`,
        color: RESOURCE_COLORS[resource] ?? 'var(--success)',
      })
    }
    if (spawned.length > 0) {
      setFloaters(f => [...f, ...spawned])
      const ids = new Set(spawned.map(x => x.id))
      setTimeout(() => setFloaters(f => f.filter(x => !ids.has(x.id))), 1500)
    }
  }, [state.log])

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
  function getOwnerColor(owner?: GuildId | string) {
    if (!owner) return 'var(--text-muted)'
    return GUILD_COLORS[owner as GuildId] ?? 'var(--text-muted)'
  }
  function getOwnerFill(owner?: GuildId | string) {
    if (owner === 'player') return 'rgba(86,197,214,0.30)'
    if (owner === 'brice')  return 'rgba(224,138,69,0.22)'
    if (owner === 'raph')   return 'rgba(232,192,105,0.22)'
    return 'url(#nodeFillGrad)'
  }

  // Wonder progress
  const cathedrale  = wonders.find(w => w.id === 'grande_cathedrale')!
  const cathedReq   = cathedrale.requiredResources.wood ?? 400
  const bestRivalCathed = Math.max(...rivals.map(r => cathedrale.rivalContributed[r.id]?.wood ?? 0))
  const cathedPlayerPct = Math.round(((cathedrale.playerContributed.wood ?? 0) / cathedReq) * 100)
  const cathedRivalPct  = Math.round((bestRivalCathed / cathedReq) * 100)

  const tower     = wonders.find(w => w.id === 'tower_of_magic')!
  const towerReq  = tower.requiredResources.wood ?? tower.requiredResources.olive ?? 800
  const bestRivalTower = Math.max(...rivals.map(r =>
    (tower.rivalContributed[r.id]?.wood ?? 0) + (tower.rivalContributed[r.id]?.olive ?? 0)
  ))
  const towerPlayerPct = Math.round(((tower.playerContributed.wood ?? tower.playerContributed.olive ?? 0) / towerReq) * 100)
  const towerRivalPct  = Math.round((bestRivalTower / towerReq) * 100)

  const leadingRival = rivals.reduce(
    (best, r) => (r.netWorthHistory.at(-1)?.value ?? 0) > (best.netWorthHistory.at(-1)?.value ?? 0) ? r : best,
    rivals[0]
  )

  // Node action buttons render as a DOM overlay (NOT foreignObject) so text never
  // clips — a div sizes to its content. Collected during the node map, drawn after.
  const nodeButtons: {
    key: string; svgX: number; svgY: number; stack: number
    content: ReactNode; color?: string; disabled?: boolean; title?: string; onClick?: () => void
  }[] = []

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', background: 'var(--bg-panel)', border: '1px solid var(--edge-soft)' }}>
      <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
        Carte
      </h2>

      <div ref={wrapperRef} style={{ flex: 1, position: 'relative', minHeight: 0 }}>
      <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${svgW} ${viewH}`} style={{ borderRadius: 8, display: 'block' }}>
        <defs>
          <radialGradient id="nodeFillGrad" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#16304c"/>
            <stop offset="100%" stopColor="#0c1827"/>
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={svgW} height={viewH} fill="#070d16" />

        {/* Zone bands */}
        {ZONES.map(z => {
          const yStart = z.yStart * vSpread
          const yEnd   = z.yEnd * vSpread
          return (
          <g key={z.label}>
            <rect x={0} y={yStart} width={svgW} height={yEnd - yStart} fill={z.color} />
            <rect x={0} y={yEnd}   width={svgW} height={1} fill="rgba(96,160,224,0.12)" />
            <text x={10} y={yStart + 16} fontSize={9 * inv} fill="rgba(96,160,224,0.40)" fontFamily="var(--font-ui)" letterSpacing="0.18em">
              {z.label}
            </text>
          </g>
          )
        })}


        {/* Nodes */}
        {Object.entries(NODE_POSITIONS).map(([nodeId, basePos]) => {
          const pos = { ...basePos, y: basePos.y * vSpread }
          const mapNode    = map.nodes.find(n => n.id === nodeId)
          const isLocked   = mapNode?.locked ?? false
          const owner      = isLocked ? undefined : getNodeOwner(nodeId)
          const instanceId = isLocked ? undefined : getNodeInstance(nodeId)
          const slotType   = mapNode?.slotType
          const isWonder   = nodeId === 'wonder_slot' || nodeId === 'cathedrale_slot'
          const isTower    = nodeId === 'wonder_slot'
          const isCathed   = nodeId === 'cathedrale_slot'

          // Find the owned building def (by instance)
          const ownedBuilding = instanceId
            ? (player.buildings.find(b => b.instanceId === instanceId) ?? rivals.flatMap(r => r.buildings).find(b => b.instanceId === instanceId))
            : undefined
          const buildingDef = ownedBuilding
            ? (buildingDefs as any[]).find(d => d.id === ownedBuilding.defId)
            : null
          const defId = ownedBuilding?.defId as BuildingId | undefined

          const color  = isLocked ? 'rgba(70,96,125,0.35)' : getOwnerColor(owner)
          const canBuy   = !isLocked && !owner && !!slotType && !isWonder
          const canShare = !isLocked && !!owner && owner !== 'player' && !!instanceId
          const sharePreview = canShare ? previewBuyShare(state, instanceId!) : null

          const degradation = ownedBuilding?.degradation ?? 0
          const degradPct   = Math.round(degradation * 100)

          const level = ownedBuilding?.level ?? 1
          const baseProduction = buildingDef?.productionPerDay ?? 0
          const levelBonus = buildingDef?.upgradable && buildingDef?.produces ? (SAWMILL_PRODUCTION[level] / SAWMILL_PRODUCTION[1]) : 1
          const effectiveProd = baseProduction > 0 ? Math.round(baseProduction * levelBonus * (1 - degradation)) : 0
          const isAuberge = buildingDef?.id === 'auberge'
          const dailyRevenue = isAuberge
            ? (AUBERGE_REVENUE[level] ?? buildingDef?.revenuePerDay ?? 0)
            : (buildingDef?.revenuePerDay ?? 0)
          const prodIcon  = buildingDef?.produces ? (RESOURCE_ICONS[buildingDef.produces] ?? null) : null
          const prodLabel = owner && !isWonder
            ? (effectiveProd > 0 && prodIcon ? `+${effectiveProd}${prodIcon}/j` : dailyRevenue > 0 ? `+${dailyRevenue}or/j` : null)
            : null

          const isPlayerOwned   = owner === 'player'
          const isUpgradable    = buildingDef?.upgradable && isPlayerOwned && instanceId
          const maxLevel        = buildingDef?.maxLevel ?? 5
          const isConfortUpgrade = isUpgradable && !!buildingDef?.upgradeResourceId
          const upgradeCost     = !isConfortUpgrade && isUpgradable ? (UPGRADE_COSTS[level] ?? null) : null
          const confortCost     = isConfortUpgrade ? (buildingDef?.upgradeResourceCosts?.[String(level)] ?? null) : null
          const canAffordUpgrade = upgradeCost != null && state.player.gold >= upgradeCost
          const canAffordConfort = confortCost != null && (state.player.inventory.meuble ?? 0) >= confortCost

          let pPct = 0, rPct = 0
          if (isTower)  { pPct = towerPlayerPct;  rPct = towerRivalPct }
          if (isCathed) { pPct = cathedPlayerPct; rPct = cathedRivalPct }

          const R = isWonder ? 28 : 22

          // Available buildings for this slot (player choice)
          const availableBuildings = canBuy && slotType ? getBuildingsForSlot(slotType) : []

          // Share arc — player arc on rival buildings, rival arc on player buildings
          let shareArcPct = 0
          let shareArcColor = ''
          if (!isWonder && instanceId) {
            if (owner !== 'player') {
              shareArcPct = player.buildings.find(b => b.instanceId === instanceId)?.shares ?? 0
              shareArcColor = 'var(--player-color)'
            } else {
              const rivalOwner = rivals.find(r => r.buildings.some(b => b.instanceId === instanceId))
              shareArcPct = rivalOwner?.buildings.find(b => b.instanceId === instanceId)?.shares ?? 0
              shareArcColor = rivalOwner?.color ?? ''
            }
          }
          const arcR = R + 5
          const notch = shareArcPct > 0 ? notchCoords(pos.x, pos.y, arcR, EFFECTIVE_CONTROL_THRESHOLD) : null

          // Rival cut — shown on player-owned buildings where rival still has shares
          let rivalCutLabel: string | null = null
          let rivalCutColor = ''
          if (isPlayerOwned && instanceId && buildingDef) {
            const rivalWithShares = rivals.find(r => r.buildings.some(b => b.instanceId === instanceId && b.shares > 0))
            if (rivalWithShares) {
              const rShares = rivalWithShares.buildings.find(b => b.instanceId === instanceId)!.shares
              if (isAuberge && dailyRevenue > 0) {
                rivalCutLabel = `${rivalWithShares.name}: −${Math.round(dailyRevenue * rShares / 100)}or/j`
              } else if (effectiveProd > 0 && prodIcon) {
                rivalCutLabel = `${rivalWithShares.name}: −${Math.round(effectiveProd * rShares / 100)}${prodIcon}/j`
              }
              rivalCutColor = rivalWithShares.color
            }
          }

          // ── Collect DOM-overlay action buttons (anchored just below the node) ──
          const btnAnchorY = pos.y + R + 24
          if (availableBuildings.length > 1) {
            availableBuildings.forEach((bd, bi) => {
              const aff = canAffordBuilding(bd.id, state)
              nodeButtons.push({
                key: `${nodeId}-buy-${bd.id}`,
                svgX: pos.x, svgY: btnAnchorY, stack: bi,
                color: aff ? 'rgba(96,160,224,0.35)' : undefined,
                disabled: !aff,
                onClick: () => onBuyBuilding(bd.id as BuildingId),
                content: (
                  <>
                    <span style={{ fontSize: '0.66rem', lineHeight: 1.1 }}>{bd.name}</span>
                    <span style={{ fontSize: '0.54rem', opacity: 0.7, fontFamily: 'var(--font-num)', lineHeight: 1.1 }}>{getBuildingCostLabel(bd.id)}</span>
                  </>
                ),
              })
            })
          }
          if (isUpgradable && !isConfortUpgrade && level < maxLevel && upgradeCost != null) {
            nodeButtons.push({
              key: `${nodeId}-upg`,
              svgX: pos.x, svgY: btnAnchorY, stack: 0,
              color: canAffordUpgrade ? 'var(--accent)' : undefined,
              disabled: !canAffordUpgrade,
              onClick: () => onUpgradeBuilding(instanceId!),
              content: <span style={{ fontFamily: 'var(--font-num)' }}>↑ T{level + 1} — {upgradeCost}or</span>,
            })
          }
          if (isConfortUpgrade && level < maxLevel && confortCost != null) {
            nodeButtons.push({
              key: `${nodeId}-cfu`,
              svgX: pos.x, svgY: btnAnchorY, stack: 0,
              color: canAffordConfort ? 'rgba(232,192,105,0.6)' : undefined,
              disabled: !canAffordConfort,
              onClick: () => onUpgradeBuilding(instanceId!),
              content: <span style={{ fontFamily: 'var(--font-num)' }}>↑ T{level + 1} — {confortCost}🪑</span>,
            })
          }
          if (sharePreview) {
            nodeButtons.push({
              key: `${nodeId}-share`,
              svgX: pos.x, svgY: btnAnchorY, stack: 0,
              color: sharePreview.ownerColor,
              disabled: !sharePreview.canAfford,
              title: `Acheter 10% de ${sharePreview.ownerName} pour ${sharePreview.cost}or → +${sharePreview.playerCutPerDay}/j`,
              onClick: () => onBuyShare(instanceId!),
              content: <span style={{ fontFamily: 'var(--font-num)' }}>Part 10% — {sharePreview.cost}or (+{sharePreview.playerCutPerDay}/j)</span>,
            })
          }

          return (
            <g key={nodeId}>
              {pulsingNodes.has(nodeId) && (
                <circle cx={pos.x} cy={pos.y} r={R + 8} fill="none" stroke={color} strokeWidth={2.5}
                  style={{ animation: 'nodeAcquired 1.4s ease-out forwards' }} />
              )}
              {owner && (
                <circle cx={pos.x} cy={pos.y} r={R + 7} fill="none" stroke={color} strokeWidth={1.5} opacity={0.30} />
              )}
              <circle
                cx={pos.x} cy={pos.y} r={R}
                fill={isLocked ? 'rgba(10,20,35,0.90)' : getOwnerFill(owner)}
                stroke={isLocked ? 'rgba(96,160,224,0.15)' : color}
                strokeWidth={owner ? 2.5 : (isLocked ? 0.8 : 1.5)}
                style={{
                  filter: owner ? `drop-shadow(0 0 10px ${color}60)` : undefined,
                  cursor: (!isLocked && !owner && availableBuildings.length > 0) ? 'pointer' : undefined,
                  transition: 'all .18s',
                }}
                onMouseEnter={() => openCard(nodeId, pos.x, pos.y, R)}
                onMouseLeave={scheduleClose}
                onClick={availableBuildings.length === 1 ? () => { onBuyBuilding(availableBuildings[0].id as BuildingId); setHoveredNode(null) } : undefined}
              />

              {/* Share arc + control threshold notch */}
              {shareArcPct > 0 && (
                <>
                  <path d={arcPath(pos.x, pos.y, arcR, shareArcPct)}
                    fill="none" stroke={shareArcColor} strokeWidth={3.5} strokeLinecap="round" opacity={0.90} />
                  {notch && (
                    <line x1={notch.x1} y1={notch.y1} x2={notch.x2} y2={notch.y2}
                      stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" />
                  )}
                </>
              )}

              <text
                x={pos.x} y={prodLabel ? pos.y + 2 : pos.y + 7}
                textAnchor="middle" fontSize={isWonder ? 22 : 14}
                opacity={isLocked ? 0.3 : 1}
              >{isLocked ? '🔒' : pos.icon}</text>

              {owner && buildingDef?.upgradable && level > 1 && (
                <text x={pos.x + R - 4} y={pos.y - R + 8} textAnchor="middle" fontSize={9}
                  fill="var(--accent)" fontFamily="var(--font-mono)">T{level}</text>
              )}

              {prodLabel && (
                <text x={pos.x} y={pos.y + 14} textAnchor="middle" fontSize={9}
                  fill={color} fontFamily="var(--font-mono)" opacity={0.9}>{prodLabel}</text>
              )}

              <text
                x={pos.x} y={pos.y + R + 14} textAnchor="middle" fontSize={10}
                fill={isLocked ? 'rgba(70,96,125,0.45)' : 'var(--text-dim)'}
                fontFamily="var(--font-ui)"
              >{isLocked ? '— bientôt —' : (owner && buildingDef ? buildingDef.name : pos.label)}</text>

              {rivalCutLabel && (
                <text x={pos.x} y={pos.y + R + 25} textAnchor="middle" fontSize={8}
                  fill={rivalCutColor} fontFamily="var(--font-mono)" opacity={0.9}>
                  {rivalCutLabel}
                </text>
              )}

              {isWonder && (pPct > 0 || rPct > 0) && (
                <>
                  <text x={pos.x} y={pos.y + R + 25} textAnchor="middle" fontSize={10} fill="var(--player-color)" fontFamily="var(--font-mono)">Toi {pPct}%</text>
                  <text x={pos.x} y={pos.y + R + 37} textAnchor="middle" fontSize={10} fill="var(--text-muted)" fontFamily="var(--font-mono)">Rival {rPct}%</text>
                </>
              )}


              {!isLocked && !isWonder && degradPct >= 15 && (
                <text x={pos.x} y={pos.y - R - 8} textAnchor="middle" fontSize={9}
                  fill={degradPct >= 30 ? 'var(--danger)' : 'var(--accent)'}>
                  {degradPct >= 30 ? '🍂' : '🌿'} −{degradPct}%
                </text>
              )}

              {/* Action buttons (buy / upgrade / share) are rendered as a DOM overlay
                  below the SVG — see {nodeButtons} map. foreignObject clips text. */}
            </g>
          )
        })}

        {/* Production floaters — rise from the producing building */}
        {floaters.map(f => {
          const base = NODE_POSITIONS[f.nodeId]
          if (!base) return null
          const R = (f.nodeId === 'wonder_slot' || f.nodeId === 'cathedrale_slot') ? 28 : 22
          return (
            <text
              key={f.id}
              x={base.x} y={base.y * vSpread - R - 4}
              textAnchor="middle"
              fontSize={15 * inv} fontWeight={700}
              fill={f.color} fontFamily="var(--font-num)"
              style={{
                animation: 'floatUp 1.5s ease-out forwards',
                transformBox: 'fill-box', transformOrigin: 'center',
                pointerEvents: 'none',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
              }}
            >
              {f.text}
            </text>
          )
        })}
      </svg>

      {/* Node action buttons — DOM overlay, true pixel size, never clips text */}
      {nodeButtons.map(b => {
        const p = svgPointToDOM(b.svgX, b.svgY)
        if (!p) return null
        return (
          <button
            key={b.key}
            className="btn-secondary"
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y + b.stack * 28,
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              lineHeight: 1.15,
              padding: '3px 9px',
              fontSize: '0.62rem',
              borderRadius: 6,
              borderColor: b.color,
              opacity: b.disabled ? 0.45 : 1,
              pointerEvents: 'auto',
              zIndex: 5,
            }}
            disabled={b.disabled}
            title={b.title}
            onClick={b.onClick}
          >
            {b.content}
          </button>
        )
      })}

      {/* FloatCard overlay */}
      {hoveredNode && (
        <FloatCard nodeId={hoveredNode.id} pos={hoveredNode.pos} state={state} />
      )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, fontSize: '0.68rem', color: 'var(--text-muted)', flexWrap: 'wrap', fontFamily: 'var(--font-ui)' }}>
        <span style={{ color: 'var(--player-color)' }}>■ Toi</span>
        {rivals.filter(r => !!rivalStrategies[r.id]).map(r => (
          <span key={r.id} style={{ color: r.color }}>■ {r.name}</span>
        ))}
        <span style={{ color: 'var(--text-muted)' }}>□ Disponible</span>
        {leadingRival && rivalStrategies[leadingRival.id] && (
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.62rem' }}>
            ⚔ {leadingRival.name} → {
              rivalStrategies[leadingRival.id]?.preferredResource === 'wood'  ? 'Bois' :
              rivalStrategies[leadingRival.id]?.preferredResource === 'huile' ? 'Huile' :
              rivalStrategies[leadingRival.id]?.preferredResource === 'meuble'? 'Immobilier' : 'Olives'
            }
          </span>
        )}
      </div>
    </div>
  )
}
