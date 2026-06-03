import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  ResponsiveContainer,
} from 'recharts'
import type { GameState, ResourceId, WonderId, ResourceMarket, BuildingId } from '../engine/types'
import { previewSell, previewBuy } from '../engine/market'
import { SAWMILL_PRODUCTION } from '../engine/buildings'
import { AZUR } from '../theme'
import buildingDefs from '../data/buildings.json'

const PHASE0_WOOD_GOAL = 10

// ─── Couleur helpers (une ressource = une couleur, partout — V8) ───────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
/** Version plus claire/vive d'une teinte — pour la courbe sur fond sombre. */
function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  const f = (c: number) => Math.round(c + (255 - c) * amt)
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

function formatGold(g: number): string {
  if (g >= 100) return Math.round(g).toString()
  if (g >= 10)  return g.toFixed(1)
  return g.toFixed(2)
}
function formatPrice(p: number): string {
  return p >= 10 ? p.toFixed(1) : p.toFixed(2)
}

// ─── Méta ressources — couleur unique tirée de AZUR.resources ──────────────────
interface ResMeta {
  label: string
  icon: string
  color: string        // identité (titre, prix, icône, fond, courbe)
  category: string
  wonderId?: WonderId
}
const RESOURCE_META: Record<ResourceId, ResMeta> = {
  wood:   { label: 'Bois',          icon: '🪵', color: AZUR.resources.wood,   category: 'Construction', wonderId: 'grande_cathedrale' },
  olive:  { label: 'Olives',        icon: '🫒', color: AZUR.resources.olive,  category: 'Alimentaire' },
  meuble: { label: 'Meubles',       icon: '🪑', color: AZUR.resources.meuble, category: 'Confort' },
  huile:  { label: "Huile d'olive", icon: '🫙', color: AZUR.resources.huile,  category: 'Luxe' },
  pierre: { label: 'Pierre',        icon: '🪨', color: AZUR.resources.pierre, category: '' },
}

const ALL_RESOURCES: ResourceId[] = ['wood', 'olive', 'meuble', 'huile']

// ─── Flux net joueur /jour pour une ressource (production − conso interne) ──────
function netFlowFor(state: GameState, resourceId: ResourceId): number {
  let flow = 0
  for (const b of state.player.buildings) {
    const def = (buildingDefs as any[]).find(d => d.id === b.defId)
    if (!def) continue
    const shares = (b.shares ?? 100) / 100
    if (def.produces === resourceId) {
      const level = b.level ?? 1
      const levelBonus = def.upgradable ? (SAWMILL_PRODUCTION[level] / SAWMILL_PRODUCTION[1]) : 1
      const degr = b.degradation ?? 0
      flow += Math.round((def.productionPerDay ?? 0) * levelBonus * shares * (1 - degr))
    }
    if (def.autoConsumeInput === resourceId) {
      flow -= Math.round((def.autoConsumeQty ?? 0) * shares)
    }
  }
  return flow
}

// ─── Triangle de tendance EMA (vert/rouge selon DIRECTION, jamais la ressource) ─
function TrendTriangle({ dir, big }: { dir: 'up' | 'down' | 'flat'; big?: boolean }) {
  const color = dir === 'up' ? 'var(--success)' : dir === 'down' ? 'var(--danger)' : 'var(--text-muted)'
  const glyph = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '▬'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: big ? 20 : 16, height: big ? 20 : 16, borderRadius: '50%',
      background: 'rgba(5,10,18,0.55)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
      color, fontSize: big ? '0.62rem' : '0.52rem', lineHeight: 1, flexShrink: 0,
    }}>
      {glyph}
    </span>
  )
}

// ─── Carte ressource ───────────────────────────────────────────────────────────
interface CardProps {
  resourceId: ResourceId
  resourceMarket: ResourceMarket
  selected: boolean
  allMode: boolean
  locked: boolean
  playerQty: number
  avgCost: number
  netFlow: number
  onClick: () => void
}

function ResourceCard({
  resourceId, resourceMarket, selected, allMode, locked, playerQty, avgCost, netFlow, onClick,
}: CardProps) {
  const meta = RESOURCE_META[resourceId]
  const price = resourceMarket.currentPrice

  // Courbe LIVE (par tick, local) — alimentée à chaque changement de prix
  const [ready, setReady] = useState(false)
  const [liveHistory, setLiveHistory] = useState<{ t: number; price: number }[]>(
    () => [{ t: 0, price }],
  )
  const prevPriceRef = useRef(price)
  const tickRef = useRef(0)

  // EMA incrémentale locale (tendance de fond ~60 ticks) — seed au prix courant
  const emaRef = useRef(price)
  const [emaVal, setEmaVal] = useState(price)
  const ALPHA = 2 / (60 + 1)

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const diff = price - prevPriceRef.current
    if (Math.abs(diff) > 0.0005) {
      tickRef.current++
      setLiveHistory(prev => [...prev.slice(-59), { t: tickRef.current, price }])
      emaRef.current = emaRef.current + ALPHA * (price - emaRef.current)
      setEmaVal(emaRef.current)
      prevPriceRef.current = price
    }
  }, [price, ALPHA])

  const dev = emaVal > 0 ? (price - emaVal) / emaVal : 0
  const dir: 'up' | 'down' | 'flat' = dev > 0.02 ? 'up' : dev < -0.02 ? 'down' : 'flat'

  // Données de courbe selon le mode
  const chartData = useMemo(() => {
    if (allMode && resourceMarket.priceHistory.length >= 2) {
      return resourceMarket.priceHistory.map((p, i) => ({ x: i, price: parseFloat(p.price.toFixed(3)) }))
    }
    return liveHistory.map(p => ({ x: p.t, price: parseFloat(p.price.toFixed(3)) }))
  }, [allMode, resourceMarket.priceHistory, liveHistory])

  // Paliers d'échelle verticale (#7bis)
  const levels = useMemo(() => {
    if (chartData.length === 0) return [] as number[]
    const prices = chartData.map(d => d.price)
    const min = Math.min(...prices), max = Math.max(...prices)
    if (max - min < 0.001) return [max]
    return selected ? [max, (max + min) / 2, min] : [max, min]
  }, [chartData, selected])

  const sparkId = `spark_${resourceId}`
  const lineColor = lighten(meta.color, 0.28)
  const chartH = selected ? 76 : 46

  if (locked) {
    return (
      <button
        disabled
        style={{
          gridColumn: 'auto', background: 'rgba(12,22,36,0.5)',
          border: '1px dashed rgba(96,160,224,0.14)', borderRadius: 10,
          padding: '12px 11px', display: 'flex', flexDirection: 'column', gap: 4,
          cursor: 'default', textAlign: 'left', minWidth: 0, opacity: 0.7,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.95rem', filter: 'grayscale(1)', opacity: 0.5 }}>{meta.icon}</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.86rem', color: 'var(--text-muted)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {meta.label}
          </span>
          <span style={{ fontSize: '0.78rem', opacity: 0.6 }}>🔒</span>
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.62rem', color: 'var(--text-muted)', opacity: 0.6, letterSpacing: '0.04em' }}>
          {meta.category}
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      style={{
        gridColumn: selected ? '1 / -1' : 'auto',
        background: selected
          ? `linear-gradient(165deg, ${rgba(meta.color, 0.26)} 0%, ${rgba(meta.color, 0.07)} 60%, rgba(12,24,39,0.96) 100%)`
          : `linear-gradient(165deg, ${rgba(meta.color, 0.16)} 0%, rgba(12,24,39,0.94) 78%)`,
        border: `1px solid ${rgba(meta.color, selected ? 0.62 : 0.30)}`,
        borderRadius: 12,
        padding: selected ? '12px 13px 11px' : '10px 11px 9px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 7,
        transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s',
        boxShadow: selected ? `0 0 22px ${rgba(meta.color, 0.30)}, inset 0 0 0 1px ${rgba(meta.color, 0.18)}` : 'none',
        position: 'relative', textAlign: 'left', minWidth: 0,
      }}
    >
      {/* Header : icône + nom (couleur ressource) | triangle + prix (couleur ressource) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: selected ? '1.15rem' : '1.0rem', lineHeight: 1, flexShrink: 0 }}>{meta.icon}</span>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: selected ? '1.0rem' : '0.9rem', fontWeight: 600,
          color: lighten(meta.color, 0.35), flex: 1, letterSpacing: '0.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {meta.label}
        </span>
        <TrendTriangle dir={dir} big={selected} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-num)', fontSize: selected ? '1.3rem' : '1.05rem', fontWeight: 700,
            color: lighten(meta.color, 0.42), lineHeight: 1,
          }}>
            {formatPrice(price)}
          </span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>or</span>
        </div>
      </div>

      {/* Sparkline + paliers d'échelle */}
      <div style={{ height: chartH, width: '100%', position: 'relative' }}>
        {ready && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 30, left: -44, bottom: 0 }}>
              <defs>
                <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="2%"  stopColor={meta.color} stopOpacity={0.42} />
                  <stop offset="92%" stopColor={meta.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <YAxis domain={['auto', 'auto']} hide />
              <XAxis dataKey="x" hide />
              <Area type="monotone" dataKey="price" stroke="none" fill={`url(#${sparkId})`} fillOpacity={1} isAnimationActive={false} />
              <Line type="monotone" dataKey="price" stroke={lineColor} strokeWidth={selected ? 2 : 1.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {/* Paliers (bord droit) — repères d'échelle type trading */}
        <div style={{
          position: 'absolute', top: 2, bottom: 0, right: 0, width: 28,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          pointerEvents: 'none',
        }}>
          {levels.map((v, i) => (
            <span key={i} style={{
              fontFamily: 'var(--font-num)', fontSize: '0.56rem', color: 'var(--text-muted)',
              textAlign: 'right', opacity: 0.7, lineHeight: 1,
            }}>
              {formatPrice(v)}
            </span>
          ))}
        </div>

        {/* Mini-label LIVE / ALL sur la carte sélectionnée */}
        {selected && (
          <span style={{
            position: 'absolute', top: 2, left: 0,
            fontFamily: 'var(--font-ui)', fontSize: '0.54rem', letterSpacing: '0.14em',
            color: 'var(--text-muted)', opacity: 0.7, textTransform: 'uppercase',
          }}>
            {allMode ? 'Tout l’historique' : 'En direct'}
          </span>
        )}
      </div>

      {/* Ligne stock · coût moyen · flux net */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 9,
        fontFamily: 'var(--font-num)', fontSize: '0.7rem', lineHeight: 1,
      }}>
        <span style={{ color: playerQty > 0 ? lighten(meta.color, 0.3) : 'var(--text-muted)', fontWeight: 600 }}>
          {meta.icon} {playerQty}
        </span>
        {playerQty > 0 && (
          <span style={{ color: 'var(--text-muted)' }}>
            ⌀ {avgCost > 0.005 ? formatPrice(avgCost) : '0'}
          </span>
        )}
        {netFlow !== 0 && (
          <span style={{ marginLeft: 'auto', color: netFlow > 0 ? 'var(--success)' : 'var(--danger)', opacity: 0.9 }}>
            {netFlow > 0 ? '+' : ''}{netFlow}/j
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Strip de trade NEUTRE (fond navy — séparé des cartes teintées) ────────────
interface StripProps {
  meta: ResMeta
  qty: number
  setQty: (n: number) => void
  playerQty: number
  maxBuyAvail: number
  canSell: boolean
  canBuy: boolean
  sellGold: number
  buyCost: number
  safeSellQty: number
  safeBuyQty: number
  insufficientGold: boolean
  onSell: () => void
  onBuy: () => void
}

function TradeStrip({
  meta, qty, setQty, playerQty, maxBuyAvail,
  canSell, canBuy, sellGold, buyCost, safeSellQty, safeBuyQty, insufficientGold,
  onSell, onBuy,
}: StripProps) {
  // Moitié / Tout : contextuel — stock si on en a (vente), sinon or dispo (achat)
  const sellMode = playerQty > 0
  const ref = sellMode ? playerQty : maxBuyAvail
  const presets = [1, 10, 100]

  return (
    <div style={{
      background: 'rgba(7,13,22,0.6)', border: '1px solid var(--edge-soft)',
      borderRadius: 12, padding: 11, display: 'flex', flexDirection: 'column', gap: 9,
      flexShrink: 0,
    }}>
      {/* Sélecteur de quantité : presets + Moitié/Tout + nombre tap-to-type */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {presets.map(p => (
          <button key={p} className="btn-secondary"
            style={{
              padding: '4px 9px', fontSize: '0.78rem', minWidth: 34,
              fontFamily: 'var(--font-num)',
              borderColor: qty === p ? 'var(--blue)' : undefined,
              color: qty === p ? 'var(--blue)' : undefined,
            }}
            onClick={() => setQty(p)}
          >
            {p}
          </button>
        ))}
        {ref > 1 && (
          <>
            <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.72rem' }}
              onClick={() => setQty(Math.max(1, Math.floor(ref / 2)))}>
              Moitié
            </button>
            <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.72rem' }}
              onClick={() => setQty(ref)}>
              Tout
            </button>
          </>
        )}
        <input
          type="text" inputMode="numeric" value={qty}
          onChange={e => {
            const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
            setQty(Number.isNaN(n) || n < 1 ? 1 : n)
          }}
          style={{
            marginLeft: 'auto', width: 64, textAlign: 'center',
            background: 'rgba(7,13,22,0.8)', border: '1px solid var(--edge)',
            borderRadius: 8, color: 'var(--text)', padding: '5px 4px',
            fontFamily: 'var(--font-num)', fontSize: '1.05rem', fontWeight: 700,
          }}
        />
      </div>

      {/* Vendre (rouge) | Acheter (vert) — neutres, ne touchent jamais une carte teintée */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn-primary"
          style={{
            flex: 1, padding: '10px 6px',
            background: canSell ? `linear-gradient(180deg, var(--danger), #8f2020)` : 'rgba(214,70,63,0.10)',
            borderColor: canSell ? 'var(--danger)' : 'rgba(214,70,63,0.25)',
            color: canSell ? 'var(--sell-ink, #ffd7d2)' : 'rgba(255,255,255,0.28)',
            boxShadow: canSell ? `0 0 14px var(--sell-glow, rgba(214,70,63,0.32))` : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}
          disabled={!canSell}
          onClick={onSell}
        >
          <span style={{ fontSize: '0.92rem', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>
            ▾ Vendre {safeSellQty || ''}
          </span>
          {canSell && (
            <span style={{ fontSize: '0.8rem', opacity: 0.9, fontFamily: 'var(--font-num)', fontWeight: 600 }}>
              +{formatGold(sellGold)} or
            </span>
          )}
        </button>

        <button
          className="btn-primary"
          style={{
            flex: 1, padding: '10px 6px',
            background: canBuy ? `linear-gradient(180deg, var(--success), #2a6e42)` : 'rgba(70,176,111,0.08)',
            borderColor: canBuy ? 'var(--success)' : 'rgba(70,176,111,0.25)',
            color: canBuy ? '#e8fef2' : 'rgba(255,255,255,0.28)',
            boxShadow: canBuy ? `0 0 14px var(--buy-glow, rgba(70,176,111,0.32))` : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}
          disabled={!canBuy}
          onClick={onBuy}
        >
          <span style={{ fontSize: '0.92rem', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>
            ▴ Acheter {safeBuyQty || ''}
          </span>
          {canBuy ? (
            <span style={{ fontSize: '0.8rem', opacity: 0.9, fontFamily: 'var(--font-num)', fontWeight: 600 }}>
              −{formatGold(buyCost)} or
            </span>
          ) : (
            <span style={{ fontSize: '0.66rem', opacity: 0.5, fontFamily: 'var(--font-ui)' }}>
              {insufficientGold ? 'or insuffisant' : 'marché vide'}
            </span>
          )}
        </button>
      </div>

      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textAlign: 'center', opacity: 0.6 }}>
        Moitié / Tout = {sellMode ? `ton stock (${playerQty} ${meta.icon})` : 'or disponible'}
      </div>
    </div>
  )
}

// ─── Main SpotMarket ──────────────────────────────────────────────────────────
interface Props {
  state: GameState
  onSell: (resourceId: ResourceId, qty: number) => void
  onBuy: (resourceId: ResourceId, qty: number) => void
  onContribute: (qty: number, wonderId: WonderId) => void
  onBuyBuilding: (defId: BuildingId) => void
}

export function SpotMarket({ state, onSell, onBuy, onContribute: _onContribute, onBuyBuilding }: Props) {
  const [selectedResource, setSelectedResource] = useState<ResourceId>('wood')
  const [allMode, setAllMode] = useState(false)
  const [qty, setQty] = useState(1)

  const { player } = state
  const playerWood  = player.inventory['wood']  ?? 0
  const playerOlive = player.inventory['olive'] ?? 0
  const phase0Done  = playerWood >= PHASE0_WOOD_GOAL

  const hasBucheron   = player.buildings.some(b => b.defId === 'sawmill')
  const hasMenuiserie = player.buildings.some(b => b.defId === 'menuiserie')
  const hasOlivery    = player.buildings.some(b => b.defId === 'olivery')
  const hasPress      = player.buildings.some(b => b.defId === 'press')

  const MENUISERIE_WOOD_COST = 80
  const PRESS_OLIVE_COST = 80
  const menuiserieProgress = Math.min(playerWood / MENUISERIE_WOOD_COST * 100, 100)
  const pressProgress = Math.min(playerOlive / PRESS_OLIVE_COST * 100, 100)

  const bucheronBuilding = player.buildings.find(b => b.defId === 'sawmill')
  const bucheronLevel = bucheronBuilding?.level ?? 1
  const bucheronProduction = SAWMILL_PRODUCTION[bucheronLevel] ?? 8

  // Progressive disclosure : ressources débloquées vs futures (grisées + cadenas)
  const hasOliveActivity  = hasOlivery || playerOlive > 0 || !!state.rivalStrategies['raph']
  const hasHuileActivity  = hasPress || (player.inventory['huile'] ?? 0) > 0
  const hasMeubleActivity = hasMenuiserie || (player.inventory['meuble'] ?? 0) > 0
  const isUnlocked = (rid: ResourceId): boolean => {
    if (rid === 'wood') return true
    if (rid === 'olive') return hasOliveActivity
    if (rid === 'meuble') return hasMeubleActivity
    if (rid === 'huile') return hasHuileActivity
    return false
  }

  const effectiveSelected = isUnlocked(selectedResource) ? selectedResource : 'wood'
  const meta = RESOURCE_META[effectiveSelected]
  const mkt = state.market.resources[effectiveSelected]
  const playerQty = player.inventory[effectiveSelected] ?? 0
  const avgCost = player.inventoryAvgCost?.[effectiveSelected] ?? 0

  const maxBuyQty   = Math.floor(player.gold / Math.max(mkt.currentPrice, 0.01))
  const maxBuyAvail = Math.min(maxBuyQty, Math.floor(mkt.volumeAvailable))
  const safeQty     = Math.max(1, qty)
  const safeSellQty = Math.min(safeQty, playerQty)
  const safeBuyQty  = Math.min(safeQty, maxBuyAvail)

  const sellPreview = previewSell(state, effectiveSelected, safeSellQty)
  const buyPreview  = previewBuy(state, effectiveSelected, safeBuyQty)
  const canSell = playerQty >= safeSellQty && safeSellQty > 0
  const canBuy  = player.gold >= buyPreview.cost && buyPreview.actualQty > 0 && safeBuyQty > 0

  function handleCardClick(rid: ResourceId) {
    if (!isUnlocked(rid)) return
    if (rid === effectiveSelected) {
      setAllMode(a => !a)   // re-tap → toggle LIVE ↔ ALL
    } else {
      setSelectedResource(rid)
      setAllMode(false)
      setQty(1)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 13px', gap: 11, minHeight: '100%' }}>

      {/* ── Grille de cartes ressources (progressive disclosure) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flexShrink: 0 }}>
        {ALL_RESOURCES.map(rid => {
          const unlocked = isUnlocked(rid)
          return (
            <ResourceCard
              key={rid}
              resourceId={rid}
              resourceMarket={state.market.resources[rid]}
              selected={unlocked && rid === effectiveSelected}
              allMode={allMode}
              locked={!unlocked}
              playerQty={player.inventory[rid] ?? 0}
              avgCost={player.inventoryAvgCost?.[rid] ?? 0}
              netFlow={netFlowFor(state, rid)}
              onClick={() => handleCardClick(rid)}
            />
          )
        })}
      </div>

      {/* ── Strip de trade NEUTRE pour la ressource sélectionnée ── */}
      <TradeStrip
        meta={meta}
        qty={safeQty}
        setQty={setQty}
        playerQty={playerQty}
        maxBuyAvail={maxBuyAvail}
        canSell={canSell}
        canBuy={canBuy}
        sellGold={sellPreview.goldEarned}
        buyCost={buyPreview.cost}
        safeSellQty={safeSellQty}
        safeBuyQty={safeBuyQty}
        insufficientGold={player.gold < mkt.currentPrice}
        onSell={() => onSell(effectiveSelected, safeSellQty)}
        onBuy={() => onBuy(effectiveSelected, safeBuyQty)}
      />

      <div style={{ flex: 1 }} />

      {/* ── Phase 0 — Objectif 10 bois ── */}
      {!phase0Done && (
        <div style={{ borderTop: '1px solid var(--edge)', paddingTop: 12, flexShrink: 0 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '0.86rem', fontFamily: 'var(--font-ui)', marginBottom: 7, color: 'var(--text-muted)',
          }}>
            <span>🪵 Objectif Bûcheron</span>
            <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-num)', fontWeight: 600 }}>{playerWood} / {PHASE0_WOOD_GOAL}</span>
          </div>
          <div style={{ height: 5, background: 'var(--edge-soft)', borderRadius: 3, overflow: 'hidden', marginBottom: 9 }}>
            <div style={{
              height: '100%', width: `${Math.min(playerWood / PHASE0_WOOD_GOAL * 100, 100)}%`,
              background: `linear-gradient(90deg, ${RESOURCE_META.wood.color}, ${lighten(RESOURCE_META.wood.color, 0.2)})`,
              borderRadius: 3, transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textAlign: 'center', lineHeight: 1.4, fontStyle: 'italic' }}>
            Encore {PHASE0_WOOD_GOAL - playerWood} bois pour débloquer le Bûcheron
          </div>
        </div>
      )}

      {/* ── Phase 1 — acheter Bûcheron ── */}
      {phase0Done && !hasBucheron && (
        <div style={{ borderTop: '1px solid var(--edge)', paddingTop: 12, flexShrink: 0 }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--accent)', fontFamily: 'var(--font-ui)', letterSpacing: '0.06em', marginBottom: 6 }}>
            ✦ Bûcheron débloqué
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 9, lineHeight: 1.4 }}>
            Automatise ta production — +8 🪵/jour
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%', fontSize: '0.96rem', padding: '10px 0', opacity: playerWood >= 10 ? 1 : 0.55 }}
            disabled={playerWood < 10}
            onClick={() => onBuyBuilding('sawmill')}
          >
            🪵 Bûcheron — 10 🪵
            {playerWood < 10 && (
              <span style={{ fontSize: '0.8rem', marginLeft: 6, color: 'rgba(255,255,255,0.5)' }}>
                (manque {10 - playerWood})
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── Phase 1 active — filières ── */}
      {hasBucheron && (
        <div style={{ borderTop: '1px solid var(--edge)', paddingTop: 12, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontFamily: 'var(--font-ui)', color: 'var(--success)' }}>
            <span>🪵 Bûcheron T{bucheronLevel}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.84rem', fontFamily: 'var(--font-num)', fontWeight: 600 }}>+{bucheronProduction} 🪵/j</span>
          </div>

          {!hasMenuiserie && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)' }}>
                <span>🏭 Menuiserie</span>
                <span style={{ fontFamily: 'var(--font-num)' }}>{Math.min(playerWood, MENUISERIE_WOOD_COST)} / {MENUISERIE_WOOD_COST} 🪵</span>
              </div>
              <div style={{ height: 4, background: 'var(--edge-soft)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${menuiserieProgress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-dim))', borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
              {playerWood >= MENUISERIE_WOOD_COST && (
                <button className="btn-primary" style={{ width: '100%', fontSize: '0.92rem', padding: '9px 0' }} onClick={() => onBuyBuilding('menuiserie')}>
                  🏭 Menuiserie — {MENUISERIE_WOOD_COST} 🪵
                </button>
              )}
            </>
          )}
          {hasMenuiserie && (
            <div style={{ fontSize: '0.84rem', color: 'var(--success)', fontFamily: 'var(--font-ui)' }}>
              ✓ Menuiserie — 4🪵/j → 1🪑/j
            </div>
          )}

          {!hasOlivery && (
            <div style={{ fontSize: '0.84rem', color: 'var(--accent)', fontFamily: 'var(--font-ui)', letterSpacing: '0.03em' }}>
              ✦ Oliveraie disponible (Carte → Zone Champs)
            </div>
          )}

          {hasOlivery && !hasPress && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)' }}>
                <span>🫙 Presse</span>
                <span style={{ fontFamily: 'var(--font-num)' }}>{Math.min(playerOlive, PRESS_OLIVE_COST)} / {PRESS_OLIVE_COST} 🫒</span>
              </div>
              <div style={{ height: 4, background: 'var(--edge-soft)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pressProgress}%`, background: `linear-gradient(90deg, ${RESOURCE_META.olive.color}, ${lighten(RESOURCE_META.olive.color, 0.2)})`, borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
              {playerOlive >= PRESS_OLIVE_COST && (
                <button className="btn-primary" style={{ width: '100%', fontSize: '0.92rem', padding: '9px 0' }} onClick={() => onBuyBuilding('press')}>
                  🫙 Presse — {PRESS_OLIVE_COST} 🫒
                </button>
              )}
            </>
          )}
          {hasPress && (
            <div style={{ fontSize: '0.84rem', color: 'var(--success)', fontFamily: 'var(--font-ui)' }}>
              ✓ Presse — 3🫒/j → 1🫙/j
            </div>
          )}
        </div>
      )}

    </div>
  )
}
