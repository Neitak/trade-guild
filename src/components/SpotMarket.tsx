import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  ResponsiveContainer,
} from 'recharts'
import type { GameState, ResourceId, WonderId, ResourceMarket, BuildingId } from '../engine/types'
import { previewSell, previewBuy } from '../engine/market'
import { SAWMILL_PRODUCTION } from '../engine/buildings'

const PHASE0_WOOD_GOAL = 10

function formatGold(g: number): string {
  if (g >= 100) return Math.round(g).toString()
  if (g >= 10)  return g.toFixed(1)
  return g.toFixed(2)
}

const RESOURCE_META: Partial<Record<ResourceId, {
  label: string
  icon: string
  chartHex: string
  chartColor: string
  cardHex: string   // tint de fond de la carte (couleur naturelle de la ressource)
  gradientId: string
  wonderId?: WonderId
  dumpThreshold: number
  category: string
}>> = {
  wood: {
    label: 'Bois',
    icon: '🪵',
    chartHex: '#5a9e6a',
    chartColor: '#5a9e6a',
    cardHex: '#8B5E3C',   // brun chaud — bois
    gradientId: 'priceGradientWood',
    wonderId: 'grande_cathedrale',
    dumpThreshold: 5,
    category: 'CONSTRUCTION',
  },
  olive: {
    label: 'Olives',
    icon: '🫒',
    chartHex: '#8bc34a',
    chartColor: '#8bc34a',
    cardHex: '#5a7a28',   // vert olive
    gradientId: 'priceGradientOlive',
    dumpThreshold: 20,
    category: 'ALIMENTAIRE',
  },
  meuble: {
    label: 'Meubles',
    icon: '🪑',
    chartHex: '#9b59b6',
    chartColor: '#b07ec8',
    cardHex: '#7B4FA6',   // violet meuble
    gradientId: 'priceGradientMeuble',
    dumpThreshold: 5,
    category: 'CONFORT',
  },
  huile: {
    label: "Huile d'olive",
    icon: '🫙',
    chartHex: '#c9a84c',
    chartColor: 'var(--accent)',
    cardHex: '#B8961C',   // or doré — huile
    gradientId: 'priceGradientHuile',
    dumpThreshold: 5,
    category: 'LUXE',
  },
}

// ─── Mini chart card (2-col grid) ────────────────────────────────────────────

interface MiniChartProps {
  resourceId: ResourceId
  resourceMarket: ResourceMarket
  selected: boolean
  playerQty: number
  onClick: () => void
}

function MiniResourceChart({ resourceId, resourceMarket, selected, playerQty, onClick }: MiniChartProps) {
  const meta = RESOURCE_META[resourceId] ?? {
    label: resourceId, icon: '?', chartHex: '#888', chartColor: '#888', cardHex: '#666',
    gradientId: 'spark_default', dumpThreshold: 5, category: '',
  }

  const [ready, setReady] = useState(false)
  const [liveHistory, setLiveHistory] = useState<{ t: number; price: number }[]>(() => [
    { t: 0, price: resourceMarket.currentPrice },
  ])
  const prevPriceRef = useRef(resourceMarket.currentPrice)
  const tickCountRef = useRef(0)
  const [flashDir, setFlashDir] = useState<'up' | 'down' | null>(null)

  // Attendre que le layout soit calculé avant de rendre Recharts
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const diff = resourceMarket.currentPrice - prevPriceRef.current
    if (Math.abs(diff) > 0.001) {
      tickCountRef.current++
      setLiveHistory(prev => [...prev.slice(-29), { t: tickCountRef.current, price: resourceMarket.currentPrice }])
      setFlashDir(diff > 0 ? 'up' : 'down')
      prevPriceRef.current = resourceMarket.currentPrice
      const t = setTimeout(() => setFlashDir(null), 500)
      return () => clearTimeout(t)
    }
  }, [resourceMarket.currentPrice])

  const priceColor = flashDir === 'up' ? 'var(--success)' : flashDir === 'down' ? 'var(--danger)' : meta.chartColor

  const chartData = liveHistory.map(p => ({ x: p.t, price: parseFloat(p.price.toFixed(3)) }))
  const sparkId = `spark_${resourceId}`

  const cardBg = selected ? 'rgba(20,38,60,0.90)' : 'var(--bg-card)'
  const cardBorder = selected
    ? `1px solid rgba(96,160,224,0.40)`
    : `1px solid var(--edge-soft)`

  return (
    <button
      onClick={onClick}
      style={{
        background: cardBg,
        border: cardBorder,
        borderRadius: 10,
        padding: '11px 11px 9px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'all 0.15s',
        boxShadow: selected ? `0 0 20px rgba(96,160,224,0.15), 0 0 0 1px rgba(96,160,224,0.20)` : 'none',
        position: 'relative',
        textAlign: 'left',
        minWidth: 0,
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', bottom: 0, left: '18%', right: '18%', height: 2,
          background: `linear-gradient(90deg, var(--blue), var(--accent))`,
          borderRadius: '2px 2px 0 0', opacity: 0.9,
        }} />
      )}

      {/* Header: icon + nom en valeur + prix à droite — même ligne */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '1.0rem', lineHeight: 1, flexShrink: 0 }}>{meta.icon}</span>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '0.92rem', fontWeight: 600,
          color: selected ? 'var(--text)' : 'var(--text-dim)', flex: 1, letterSpacing: '0.02em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {meta.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-num)', fontSize: '1.05rem', fontWeight: 700,
            color: priceColor, transition: 'color 0.35s ease', lineHeight: 1,
          }}>
            {resourceMarket.currentPrice.toFixed(2)}
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>or</span>
        </div>
      </div>

      {/* Sparkline — différé d'un rAF pour que le layout soit stable avant la mesure Recharts */}
      <div style={{ height: 52, width: '100%' }}>
        {ready && <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 2, right: 0, left: -40, bottom: 0 }}>
            <defs>
              <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={meta.chartHex} stopOpacity={0.35} />
                <stop offset="90%" stopColor={meta.chartHex} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis domain={['auto', 'auto']} hide />
            <XAxis dataKey="x" hide />
            <Area
              type="monotone" dataKey="price"
              stroke="none" fill={`url(#${sparkId})`} fillOpacity={1}
              isAnimationActive={false}
            />
            <Line
              type="monotone" dataKey="price"
              stroke={meta.chartColor} strokeWidth={1.5} dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>}
      </div>

      {/* Stock */}
      <div style={{
        fontFamily: 'var(--font-num)', fontSize: '0.72rem', lineHeight: 1,
        color: playerQty > 0 ? meta.chartColor : 'var(--text-muted)',
        opacity: playerQty > 0 ? 0.85 : 0.35,
      }}>
        {playerQty > 0 ? `${playerQty} en stock` : '—'}
      </div>
    </button>
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

  const hasOliveActivity  = hasOlivery || (player.inventory['olive'] ?? 0) > 0 || !!state.rivalStrategies['raph']
  const hasHuileActivity  = hasPress || (player.inventory['huile'] ?? 0) > 0
  const hasMeubleActivity = hasMenuiserie || (player.inventory['meuble'] ?? 0) > 0

  const activeResources: ResourceId[] = ['wood']
  if (hasOliveActivity)  activeResources.push('olive')
  if (hasMeubleActivity) activeResources.push('meuble')
  if (hasHuileActivity)  activeResources.push('huile')

  const effectiveSelected = activeResources.includes(selectedResource) ? selectedResource : 'wood'
  const meta = RESOURCE_META[effectiveSelected] ?? RESOURCE_META['wood']!
  const mkt = state.market.resources[effectiveSelected]
  const playerQty = player.inventory[effectiveSelected] ?? 0

  const maxBuyQty = Math.floor(player.gold / Math.max(mkt.currentPrice, 0.01))
  const safeQty   = Math.max(1, qty)
  const safeSellQty = Math.min(safeQty, playerQty)
  const safeBuyQty  = Math.min(safeQty, Math.min(maxBuyQty, Math.floor(mkt.volumeAvailable)))

  const sellPreview = previewSell(state, effectiveSelected, safeSellQty)
  const buyPreview  = previewBuy(state, effectiveSelected, safeBuyQty)
  const canSell = playerQty >= safeSellQty && safeSellQty > 0
  const canBuy  = player.gold >= buyPreview.cost && buyPreview.actualQty > 0 && safeBuyQty > 0

  function handleSelectResource(rid: ResourceId) {
    setSelectedResource(rid)
    setQty(1)
  }

  const quickPresets = useMemo(() => {
    const maxSell = playerQty
    const maxBuy  = Math.min(maxBuyQty, Math.floor(mkt.volumeAvailable))
    const ceiling = Math.max(maxSell, maxBuy)
    if (ceiling <= 0) return []
    const candidates = [5, 10, 25, 50].filter(q => q <= ceiling)
    if (ceiling > 0 && ceiling < 100 && !candidates.includes(ceiling)) candidates.push(ceiling)
    return candidates.slice(0, 3)
  }, [playerQty, maxBuyQty, mkt.volumeAvailable])

  const rumors = state.activeRumors.slice(-3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 16, gap: 13, minHeight: '100%' }}>

      {/* ── Header ── */}
      <div style={{
        fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
        letterSpacing: '0.22em', paddingBottom: 10, borderBottom: '1px solid var(--edge)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        textTransform: 'uppercase',
      }}>
        <span style={{ color: 'var(--text-dim)' }}>⚖ Spot Market</span>
        <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-num)', fontSize: '0.90rem', fontWeight: 700 }}>J{state.day}</span>
      </div>

      {/* ── Resource grid — mini charts, 2 cols ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        flexShrink: 0,
      }}>
        {activeResources.map(rid => (
          <MiniResourceChart
            key={rid}
            resourceId={rid}
            resourceMarket={state.market.resources[rid]}
            selected={rid === effectiveSelected}
            playerQty={player.inventory[rid] ?? 0}
            onClick={() => handleSelectResource(rid)}
          />
        ))}
      </div>

      {/* ── Rumeurs (gauche) + Actions (droite) ── */}
      <div style={{
        borderTop: '1px solid var(--edge)',
        paddingTop: 13,
        flexShrink: 0,
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
      }}>

        {/* ── Rumors column ── */}
        <div style={{ width: 170, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            fontSize: '0.70rem', color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)', letterSpacing: '0.18em',
            textTransform: 'uppercase', marginBottom: 4,
          }}>
            Rumeurs
          </div>

          {rumors.length === 0 ? (
            <div style={{
              fontSize: '0.85rem', color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)', opacity: 0.45, lineHeight: 1.5, paddingTop: 2,
            }}>
              Silence sur les marchés…
            </div>
          ) : (
            rumors.map((r, i) => (
              <div key={i} style={{
                fontSize: '0.84rem',
                color: 'var(--text-dim)',
                background: 'rgba(86,168,230,0.05)',
                border: '1px solid var(--edge-soft)',
                borderLeft: '2px solid var(--blue)',
                borderRadius: '0 7px 7px 0',
                padding: '7px 10px',
                fontFamily: 'var(--font-ui)',
                lineHeight: 1.5,
                letterSpacing: '0.01em',
              }}>
                {r.text}
              </div>
            ))
          )}
        </div>

        {/* ── Actions column ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>

          {/* Resource label + price */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1.12rem', lineHeight: 1 }}>{meta.icon}</span>
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '0.92rem',
              color: 'var(--text)', flex: 1, letterSpacing: '0.02em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {meta.label}
            </span>
            <span style={{ fontFamily: 'var(--font-num)', fontSize: '0.92rem', fontWeight: 600, color: 'var(--accent)' }}>
              {mkt.currentPrice.toFixed(2)}
            </span>
          </div>

          {/* Qty control */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              className="btn-secondary"
              style={{ width: 32, height: 32, padding: '0', fontSize: '1.1rem', lineHeight: 1 }}
              onClick={() => setQty(q => Math.max(1, q - 1))}
            >
              −
            </button>
            <span style={{
              fontFamily: 'var(--font-num)', fontSize: '1.2rem', fontWeight: 700,
              color: 'var(--text)', minWidth: 30, textAlign: 'center',
            }}>
              {safeQty}
            </span>
            <button
              className="btn-secondary"
              style={{ width: 32, height: 32, padding: '0', fontSize: '1.1rem', lineHeight: 1 }}
              onClick={() => setQty(q => q + 1)}
            >
              +
            </button>
            <div style={{ flex: 1, display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
              {quickPresets.map(q => (
                <button
                  key={q}
                  className="btn-secondary"
                  style={{
                    padding: '3px 6px', fontSize: '0.75rem',
                    color: q === safeQty ? meta.chartColor : undefined,
                    borderColor: q === safeQty ? `${meta.chartHex}80` : undefined,
                  }}
                  onClick={() => setQty(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* VENDRE */}
          <button
            className="btn-primary"
            style={{
              width: '100%', padding: '11px 8px',
              background: canSell
                ? `linear-gradient(180deg, var(--danger), #8f2020)`
                : 'rgba(214,70,63,0.10)',
              borderColor: canSell ? 'var(--danger)' : 'rgba(214,70,63,0.25)',
              color: canSell ? 'var(--sell-ink, #ffd7d2)' : 'rgba(255,255,255,0.25)',
              boxShadow: canSell ? `0 0 16px var(--sell-glow, rgba(214,70,63,0.35))` : 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
            disabled={!canSell}
            onClick={() => onSell(effectiveSelected, safeSellQty)}
          >
            <span style={{ fontSize: '0.95rem', letterSpacing: '0.03em', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>
              Vendre {safeSellQty} {meta.icon}
            </span>
            {canSell && (
              <span style={{ fontSize: '0.82rem', opacity: 0.90, fontFamily: 'var(--font-num)', fontWeight: 600 }}>
                +{formatGold(sellPreview.goldEarned)} or
              </span>
            )}
          </button>

          {/* ACHETER */}
          <button
            className="btn-primary"
            style={{
              width: '100%', padding: '11px 8px',
              background: canBuy
                ? `linear-gradient(180deg, var(--success), #2a6e42)`
                : 'rgba(70,176,111,0.08)',
              borderColor: canBuy ? 'var(--success)' : 'rgba(70,176,111,0.25)',
              color: canBuy ? '#e8fef2' : 'rgba(255,255,255,0.25)',
              boxShadow: canBuy ? `0 0 16px var(--buy-glow, rgba(70,176,111,0.35))` : 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
            disabled={!canBuy}
            onClick={() => onBuy(effectiveSelected, safeBuyQty)}
          >
            <span style={{ fontSize: '0.95rem', letterSpacing: '0.03em', fontWeight: 600, fontFamily: 'var(--font-ui)' }}>
              Acheter {safeQty} {meta.icon}
            </span>
            {canBuy ? (
              <span style={{ fontSize: '0.82rem', opacity: 0.90, fontFamily: 'var(--font-num)', fontWeight: 600 }}>
                −{formatGold(buyPreview.cost)} or
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem', opacity: 0.45, fontFamily: 'var(--font-ui)' }}>
                {player.gold < mkt.currentPrice ? 'or insuffisant' : 'marché vide'}
              </span>
            )}
          </button>

          {/* Dump */}
          {playerQty >= meta.dumpThreshold && (
            <button
              className="btn-secondary"
              style={{
                width: '100%', fontSize: '0.80rem', padding: '5px 0',
                borderColor: 'rgba(214,70,63,0.35)', color: 'rgba(214,70,63,0.85)',
              }}
              onClick={() => onSell(effectiveSelected, playerQty)}
            >
              ⚡ Inonder ({playerQty} {meta.icon})
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* ── Phase 0 — Objectif 10 bois ── */}
      {!phase0Done && (
        <div style={{ borderTop: '1px solid var(--edge)', paddingTop: 13, flexShrink: 0 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '0.88rem', fontFamily: 'var(--font-ui)', marginBottom: 7, color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}>
            <span>🪵 Objectif Bûcheron</span>
            <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-num)', fontWeight: 600 }}>{playerWood} / {PHASE0_WOOD_GOAL}</span>
          </div>
          <div style={{ height: 5, background: 'var(--edge-soft)', borderRadius: 3, overflow: 'hidden', marginBottom: 9 }}>
            <div style={{
              height: '100%',
              width: `${Math.min(playerWood / PHASE0_WOOD_GOAL * 100, 100)}%`,
              background: 'linear-gradient(90deg, #5a9e6a, #3a6e4a)',
              borderRadius: 3, transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', textAlign: 'center', lineHeight: 1.4, fontStyle: 'italic' }}>
            Encore {PHASE0_WOOD_GOAL - playerWood} bois pour débloquer le Bûcheron
          </div>
        </div>
      )}

      {/* ── Phase 1 — acheter Bûcheron ── */}
      {phase0Done && !hasBucheron && (
        <div style={{ borderTop: '1px solid var(--edge)', paddingTop: 13, flexShrink: 0 }}>
          <div style={{ fontSize: '0.86rem', color: 'var(--accent)', fontFamily: 'var(--font-ui)', letterSpacing: '0.08em', marginBottom: 7 }}>
            ✦ Bûcheron débloqué
          </div>
          <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 9, lineHeight: 1.4 }}>
            Automatise ta production — +8 🪵/jour
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%', fontSize: '1rem', padding: '10px 0', opacity: playerWood >= 10 ? 1 : 0.55 }}
            disabled={playerWood < 10}
            onClick={() => onBuyBuilding('sawmill')}
          >
            🪵 Bûcheron — 10 🪵
            {playerWood < 10 && (
              <span style={{ fontSize: '0.82rem', marginLeft: 6, color: 'rgba(255,255,255,0.5)' }}>
                (manque {10 - playerWood})
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── Phase 1 active — filières ── */}
      {hasBucheron && (
        <div style={{ borderTop: '1px solid var(--edge)', paddingTop: 13, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.90rem', fontFamily: 'var(--font-ui)', color: 'var(--success)' }}>
            <span>🪵 Bûcheron T{bucheronLevel}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.86rem', fontFamily: 'var(--font-num)', fontWeight: 600 }}>+{bucheronProduction} 🪵/j</span>
          </div>

          {!hasMenuiserie && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)' }}>
                <span>🏭 Menuiserie</span>
                <span style={{ fontFamily: 'var(--font-num)' }}>{Math.min(playerWood, MENUISERIE_WOOD_COST)} / {MENUISERIE_WOOD_COST} 🪵</span>
              </div>
              <div style={{ height: 4, background: 'var(--edge-soft)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${menuiserieProgress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-dim))', borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
              {playerWood >= MENUISERIE_WOOD_COST && (
                <button className="btn-primary" style={{ width: '100%', fontSize: '0.95rem', padding: '9px 0' }} onClick={() => onBuyBuilding('menuiserie')}>
                  🏭 Menuiserie — {MENUISERIE_WOOD_COST} 🪵
                </button>
              )}
            </>
          )}
          {hasMenuiserie && (
            <div style={{ fontSize: '0.86rem', color: 'var(--success)', fontFamily: 'var(--font-ui)' }}>
              ✓ Menuiserie — 4🪵/j → 1🪑/j
            </div>
          )}

          {!hasOlivery && (
            <div style={{ fontSize: '0.86rem', color: 'var(--accent)', fontFamily: 'var(--font-ui)', letterSpacing: '0.04em' }}>
              ✦ Oliveraie disponible (Carte → Zone Champs)
            </div>
          )}

          {hasOlivery && !hasPress && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)' }}>
                <span>🫙 Presse</span>
                <span style={{ fontFamily: 'var(--font-num)' }}>{Math.min(playerOlive, PRESS_OLIVE_COST)} / {PRESS_OLIVE_COST} 🫒</span>
              </div>
              <div style={{ height: 4, background: 'var(--edge-soft)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pressProgress}%`, background: 'linear-gradient(90deg, #8bc34a, #5a8a28)', borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
              {playerOlive >= PRESS_OLIVE_COST && (
                <button className="btn-primary" style={{ width: '100%', fontSize: '0.95rem', padding: '9px 0' }} onClick={() => onBuyBuilding('press')}>
                  🫙 Presse — {PRESS_OLIVE_COST} 🫒
                </button>
              )}
            </>
          )}
          {hasPress && (
            <div style={{ fontSize: '0.86rem', color: 'var(--success)', fontFamily: 'var(--font-ui)' }}>
              ✓ Presse — 3🫒/j → 1🫙/j
            </div>
          )}
        </div>
      )}

    </div>
  )
}
