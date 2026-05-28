import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { GameState, ResourceId, WonderId, ResourceMarket, GuildId } from '../engine/types'
import { GUILD_COLORS } from '../engine/types'
import { previewSell, previewBuy } from '../engine/market'

// ─── Phase 0 goal ─────────────────────────────────────────────────────────────
const PHASE0_WOOD_GOAL = 10

// ─── Smart gold formatter ─────────────────────────────────────────────────────
function formatGold(g: number): string {
  if (g >= 100) return Math.round(g).toString()
  if (g >= 10)  return g.toFixed(1)
  return g.toFixed(2)
}

// ─── Resource meta ────────────────────────────────────────────────────────────
const RESOURCE_META: Record<ResourceId, {
  label: string
  icon: string
  chartHex: string
  chartColor: string
  gradientId: string
  wonderId: WonderId
  wonderName: string
  dumpThreshold: number
}> = {
  apple: {
    label: 'Pommes',
    icon: '🍎',
    chartHex: '#c9a84c',
    chartColor: 'var(--accent)',
    gradientId: 'priceGradientApple',
    wonderId: 'tower_of_magic',
    wonderName: 'Tour de Magie',
    dumpThreshold: 20,
  },
  wood: {
    label: 'Bois',
    icon: '🪵',
    chartHex: '#5a9e6a',
    chartColor: '#5a9e6a',
    gradientId: 'priceGradientWood',
    wonderId: 'grande_cathedrale',
    wonderName: 'Grande Cathédrale',
    dumpThreshold: 5,
  },
}

// ─── Rival marker keys ────────────────────────────────────────────────────────
const RIVAL_MARKER_KEYS: Array<{ key: string; id: GuildId; label: string }> = [
  { key: 'marker_player', id: 'player', label: 'Toi'   },
  { key: 'marker_brice',  id: 'brice',  label: 'Brice' },
  { key: 'marker_raph',   id: 'raph',   label: 'Raph'  },
  { key: 'marker_rita',   id: 'rita',   label: 'Rita'  },
]

// ─── Adaptive qty buttons ─────────────────────────────────────────────────────
function getAdaptiveQtys(max: number): number[] {
  if (max <= 0) return []
  if (max <= 4) return Array.from({ length: max }, (_, i) => i + 1)
  const steps = [5, 10, 25, 50].filter(q => q < max)
  return [...steps.slice(-3), max]
}

// ─── Moving average ───────────────────────────────────────────────────────────
function calcMovingAverage(data: { price: number }[], window: number) {
  return data.map((point, i) => {
    if (i < window - 1) return null
    const slice = data.slice(i - window + 1, i + 1)
    const avg = slice.reduce((s, p) => s + p.price, 0) / window
    return parseFloat(avg.toFixed(4))
  })
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const price   = payload.find((p: any) => p.dataKey === 'price')?.value
  const markers = RIVAL_MARKER_KEYS
    .filter(mk => payload.find((p: any) => p.dataKey === mk.key && p.value != null))
  return (
    <div style={{
      background: 'rgba(8,8,20,0.96)',
      border: '1px solid rgba(201,168,76,0.2)',
      borderRadius: 4,
      padding: '5px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.72rem',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <div>
        {label != null && <span style={{ color: 'var(--text-muted)' }}>#{label} </span>}
        {price != null && <span style={{ color: 'var(--accent)' }}>{price.toFixed(2)}</span>}
      </div>
      {markers.map(mk => (
        <div key={mk.key} style={{ color: GUILD_COLORS[mk.id], fontSize: '0.68rem' }}>
          ● {mk.label}
        </div>
      ))}
    </div>
  )
}

// ─── Per-resource card ────────────────────────────────────────────────────────
interface CardProps {
  resourceId: ResourceId
  resourceMarket: ResourceMarket
  state: GameState
  onSell: (qty: number) => void
  onBuy: (qty: number) => void
  onContribute: (qty: number) => void
}

function ResourceCard({ resourceId, resourceMarket, state, onSell, onBuy, onContribute: _onContribute }: CardProps) {
  const [timeframe, setTimeframe] = useState<'today' | 'all'>('today')

  // ── Live tick history (for "Aujourd'hui" chart) ──
  const [liveHistory, setLiveHistory] = useState<{ t: number; price: number }[]>(() => [
    { t: 0, price: resourceMarket.currentPrice },
  ])
  const prevPriceRef = useRef(resourceMarket.currentPrice)
  const tickCountRef = useRef(0)

  // ── Flash + live history update ──
  const [flashDir, setFlashDir] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    const diff = resourceMarket.currentPrice - prevPriceRef.current
    if (Math.abs(diff) > 0.001) {
      tickCountRef.current++
      setLiveHistory(prev => [
        ...prev.slice(-59),
        { t: tickCountRef.current, price: resourceMarket.currentPrice },
      ])
      setFlashDir(diff > 0 ? 'up' : 'down')
      prevPriceRef.current = resourceMarket.currentPrice
      const t = setTimeout(() => setFlashDir(null), 500)
      return () => clearTimeout(t)
    }
  }, [resourceMarket.currentPrice])

  const meta       = RESOURCE_META[resourceId]
  const { player } = state
  const fullHistory = resourceMarket.priceHistory
  const playerQty  = player.inventory[resourceId] ?? 0

  // ── Price delta vs last recorded trade ──
  const prevPrice  = fullHistory.length > 1 ? fullHistory[fullHistory.length - 2].price : null
  const priceDelta = prevPrice != null ? resourceMarket.currentPrice - prevPrice : 0
  const deltaColor = priceDelta > 0.01 ? 'var(--success)' : priceDelta < -0.01 ? 'var(--danger)' : 'var(--text-muted)'
  const deltaLabel = priceDelta > 0.01
    ? `↑ +${priceDelta.toFixed(2)}`
    : priceDelta < -0.01
    ? `↓ ${priceDelta.toFixed(2)}`
    : ''

  // ── Chart data ──
  // "today": live tick-by-tick history since page load
  // "all": full priceHistory (one point per trade) + live current price appended
  const todayChartData = liveHistory.map(p => ({
    x: p.t,
    price: parseFloat(p.price.toFixed(3)),
  }))

  const ma3Historical = useMemo(() => calcMovingAverage(fullHistory, 3), [fullHistory])
  const historyWithLive = useMemo(() => {
    const base = fullHistory.map((p, i) => ({
      x: i,
      price: parseFloat(p.price.toFixed(3)),
      marker_player: p.marker === 'player' ? p.price : undefined,
      marker_brice:  p.marker === 'brice'  ? p.price : undefined,
      marker_raph:   p.marker === 'raph'   ? p.price : undefined,
      marker_rita:   p.marker === 'rita'   ? p.price : undefined,
      ma3: ma3Historical[i],
    }))
    // append live current price as rightmost point
    const liveP = parseFloat(resourceMarket.currentPrice.toFixed(3))
    const lastP = base.length > 0 ? base[base.length - 1].price : liveP
    if (Math.abs(liveP - lastP) > 0.001) {
      base.push({ x: base.length, price: liveP, marker_player: undefined, marker_brice: undefined, marker_raph: undefined, marker_rita: undefined, ma3: null })
    }
    return base
  }, [fullHistory, resourceMarket.currentPrice, ma3Historical])

  const chartData   = timeframe === 'today' ? todayChartData : historyWithLive
  const ma3Today    = useMemo(() => calcMovingAverage(liveHistory, 3), [liveHistory])
  const todayWithMA = todayChartData.map((p, i) => ({ ...p, ma3: ma3Today[i] }))
  const finalChartData = timeframe === 'today' ? todayWithMA : historyWithLive

  // ── Adaptive qty buttons ──
  const sellQtys   = getAdaptiveQtys(playerQty)
  const [qtySell, setQtySell] = useState(1)
  const [qtyBuy,  setQtyBuy]  = useState(1)

  const safeSellQty = sellQtys.includes(qtySell) ? qtySell : (sellQtys[0] ?? 1)
  const maxBuyQty   = Math.floor(player.gold / Math.max(resourceMarket.currentPrice, 0.01))
  const buyQtys     = getAdaptiveQtys(Math.min(maxBuyQty, resourceMarket.volumeAvailable))
  const safeBuyQty  = buyQtys.includes(qtyBuy) ? qtyBuy : (buyQtys[0] ?? 1)

  const sellPreview = previewSell(state, resourceId, safeSellQty)
  const buyPreview  = previewBuy(state, resourceId, safeBuyQty)
  const canSell     = playerQty >= safeSellQty
  const canBuy      = player.gold >= buyPreview.cost && buyPreview.actualQty > 0

  // ── Intel panel ──
  const yesterday = state.day - 1
  type IntelEntry = { actor: GuildId; bought: number; sold: number; priceBuy: number; priceSell: number }
  const intelMap: Partial<Record<GuildId, IntelEntry>> = {}
  for (const ev of state.log) {
    if (ev.day !== yesterday) continue
    if (ev.actor === 'player' || ev.actor === 'system') continue
    if (ev.payload['resourceId'] !== resourceId) continue
    if (ev.type !== 'BUY' && ev.type !== 'SELL') continue
    const actor = ev.actor as GuildId
    if (!intelMap[actor]) intelMap[actor] = { actor, bought: 0, sold: 0, priceBuy: 0, priceSell: 0 }
    const entry = intelMap[actor]!
    if (ev.type === 'BUY') { entry.bought += ev.payload['qty'] as number; entry.priceBuy = ev.payload['price'] as number }
    else                   { entry.sold   += ev.payload['qty'] as number; entry.priceSell = ev.payload['price'] as number }
  }
  const intelEntries = Object.values(intelMap) as IntelEntry[]

  // ── Dump ──
  const showDump = playerQty >= meta.dumpThreshold

  // ── Flash colors ──
  const priceColor = flashDir === 'up' ? 'var(--success)' : flashDir === 'down' ? 'var(--danger)' : meta.chartColor
  const cardBg     = flashDir === 'up'
    ? 'rgba(76,175,106,0.05)'
    : flashDir === 'down'
    ? 'rgba(201,76,76,0.05)'
    : 'rgba(255,255,255,0.015)'

  return (
    <div style={{
      background: cardBg,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'background 0.4s ease',
    }}>

      {/* ── Header — price ticker ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '1rem', fontFamily: 'var(--font-ui)', color: meta.chartColor, letterSpacing: '0.03em' }}>
          {meta.icon} {meta.label}
        </span>
        <span style={{
          fontSize: '1.7rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: priceColor,
          marginLeft: 'auto',
          lineHeight: 1,
          transition: 'color 0.35s ease',
        }}>
          {resourceMarket.currentPrice.toFixed(2)}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1 }}>or</span>
        {deltaLabel && (
          <span style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: deltaColor,
            minWidth: 52,
            textAlign: 'right',
          }}>
            {deltaLabel}
          </span>
        )}
      </div>

      {/* ── Timeframe toggle ── */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['today', 'all'] as const).map(tf => (
          <button key={tf}
            onClick={() => setTimeframe(tf)}
            style={{
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              padding: '3px 10px',
              background: timeframe === tf ? 'rgba(201,168,76,0.1)' : 'transparent',
              border: 'none',
              borderBottom: timeframe === tf ? '2px solid var(--accent)' : '2px solid transparent',
              color: timeframe === tf ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tf === 'today' ? 'Aujourd\'hui' : 'Tout'}
          </button>
        ))}
      </div>

      {/* ── Chart ── */}
      <div style={{ height: 95, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={finalChartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id={meta.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={meta.chartHex} stopOpacity={0.28} />
                <stop offset="90%" stopColor={meta.chartHex} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="x"
              tick={{ fill: 'var(--text-muted)', fontSize: 8, fontFamily: 'var(--font-mono)' }}
              tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
              tickFormatter={(v) => timeframe === 'all' && v % 5 === 0 ? `${v}` : ''}
            />
            <YAxis
              domain={[
                (min: number) => Math.max(0.01, parseFloat((min - 0.08).toFixed(2))),
                (max: number) => parseFloat((max + 0.08).toFixed(2)),
              ]}
              tick={{ fill: 'var(--text-muted)', fontSize: 8, fontFamily: 'var(--font-mono)' }}
              tickLine={false} axisLine={false}
              tickFormatter={(v) => v.toFixed(1)}
              width={30}
            />
            <ReferenceLine
              y={resourceMarket.equilibriumPrice}
              stroke={meta.chartHex} strokeDasharray="6 4" strokeOpacity={0.22} strokeWidth={1}
            />
            <Tooltip content={<MiniTooltip />} />
            <Area
              type="monotone" dataKey="price"
              stroke="none" fill={`url(#${meta.gradientId})`} fillOpacity={1}
              isAnimationActive={false}
            />
            <Line
              type="monotone" dataKey="price"
              stroke={meta.chartColor} strokeWidth={2} dot={false}
              activeDot={{ r: 4, fill: meta.chartHex, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            {/* MA only in "all" mode where history is meaningful */}
            {timeframe === 'all' && (
              <Line
                type="monotone" dataKey="ma3"
                stroke="#6a9fd8" strokeWidth={1} strokeDasharray="3 2"
                dot={false} activeDot={false} connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {/* Rival markers in "all" mode only */}
            {timeframe === 'all' && RIVAL_MARKER_KEYS.map(mk => (
              <Line key={mk.key} type="monotone" dataKey={mk.key}
                strokeWidth={0}
                dot={{ r: 4, fill: GUILD_COLORS[mk.id], strokeWidth: 1.5, stroke: 'rgba(0,0,0,0.5)' }}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Stock info ── */}
      <div style={{
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        display: 'flex',
        gap: 16,
        alignItems: 'center',
      }}>
        <span>
          Stock{' '}
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{playerQty}</span>
          {' '}{meta.icon}
        </span>
        <span>
          Vol.{' '}
          <span style={{ color: 'var(--text-dim)' }}>{Math.round(resourceMarket.volumeAvailable)}</span>
        </span>
      </div>

      {/* ── Intel panel — yesterday's rival activity ── */}
      {state.day > 1 && (
        <div style={{
          background: 'rgba(255,255,255,0.012)',
          borderLeft: '2px solid rgba(201,168,76,0.25)',
          borderRadius: '0 4px 4px 0',
          padding: '6px 10px',
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{
            color: 'var(--accent-dim)',
            fontSize: '0.65rem',
            letterSpacing: '0.08em',
            marginBottom: 4,
            fontFamily: 'var(--font-ui)',
            textTransform: 'uppercase',
          }}>
            Hier (J{state.day - 1})
          </div>
          {intelEntries.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Aucune activité rivale</div>
          ) : intelEntries.map(e => (
            <div key={e.actor} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
              <span style={{ color: GUILD_COLORS[e.actor], minWidth: 36, fontWeight: 500 }}>
                {e.actor.charAt(0).toUpperCase() + e.actor.slice(1)}
              </span>
              {e.bought > 0 && (
                <span style={{ color: 'var(--success)' }}>
                  ↑{e.bought} {meta.icon}
                  <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>à {e.priceBuy.toFixed(2)}</span>
                </span>
              )}
              {e.sold > 0 && (
                <span style={{ color: 'var(--danger)', marginLeft: e.bought > 0 ? 6 : 0 }}>
                  ↓{e.sold} {meta.icon}
                  <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>à {e.priceSell.toFixed(2)}</span>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Trade actions ── */}
      <div style={{ display: 'flex', gap: 8 }}>

        {/* Sell */}
        <div style={{
          flex: 1,
          background: 'rgba(201,76,76,0.06)',
          border: '1px solid rgba(201,76,76,0.22)',
          borderRadius: 'var(--radius)',
          padding: 8,
        }}>
          <div style={{
            fontSize: '0.78rem',
            color: 'var(--danger)',
            marginBottom: 6,
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-ui)',
            fontWeight: 500,
          }}>
            Vendre
          </div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap' }}>
            {sellQtys.map(q => (
              <button key={q} className="btn-secondary"
                style={{
                  flex: 1, minWidth: 28, padding: '3px 0', fontSize: '0.75rem',
                  borderColor: q === safeSellQty ? 'var(--danger)' : undefined,
                  color: q === safeSellQty ? 'var(--danger)' : undefined,
                }}
                onClick={() => setQtySell(q)}>
                {q === playerQty && sellQtys.length > 1 ? 'Tout' : q}
              </button>
            ))}
          </div>
          <div style={{
            fontSize: '0.72rem',
            color: 'var(--text-dim)',
            marginBottom: 6,
            minHeight: 18,
            fontFamily: 'var(--font-mono)',
          }}>
            {canSell ? (
              <>
                <span style={{ color: 'var(--text-muted)' }}>{sellPreview.newPrice.toFixed(2)}</span>
                {' · '}
                <span className="gold-value">+{formatGold(sellPreview.goldEarned)} or</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Rien à vendre</span>
            )}
          </div>
          <button className="btn-primary"
            style={{
              width: '100%',
              background: 'linear-gradient(135deg,#c94c4c,#8f3030)',
              borderColor: '#c94c4c',
              color: '#fff',
              fontSize: '0.78rem',
              padding: '6px 0',
            }}
            disabled={!canSell}
            onClick={() => onSell(safeSellQty)}>
            Vendre {safeSellQty}
          </button>
        </div>

        {/* Buy */}
        <div style={{
          flex: 1,
          background: 'rgba(76,175,106,0.06)',
          border: '1px solid rgba(76,175,106,0.22)',
          borderRadius: 'var(--radius)',
          padding: 8,
        }}>
          <div style={{
            fontSize: '0.78rem',
            color: 'var(--success)',
            marginBottom: 6,
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-ui)',
            fontWeight: 500,
          }}>
            Acheter
          </div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap' }}>
            {buyQtys.map(q => (
              <button key={q} className="btn-secondary"
                style={{
                  flex: 1, minWidth: 28, padding: '3px 0', fontSize: '0.75rem',
                  borderColor: q === safeBuyQty ? 'var(--success)' : undefined,
                  color: q === safeBuyQty ? 'var(--success)' : undefined,
                }}
                onClick={() => setQtyBuy(q)}>
                {q === Math.min(maxBuyQty, resourceMarket.volumeAvailable) && buyQtys.length > 1 ? 'Max' : q}
              </button>
            ))}
          </div>
          <div style={{
            fontSize: '0.72rem',
            color: 'var(--text-dim)',
            marginBottom: 6,
            minHeight: 18,
            fontFamily: 'var(--font-mono)',
          }}>
            {canBuy ? (
              <>
                <span style={{ color: 'var(--text-muted)' }}>{buyPreview.newPrice.toFixed(2)}</span>
                {' · '}
                <span className="gold-value">{formatGold(buyPreview.cost)} or</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Or insuffisant</span>
            )}
          </div>
          <button className="btn-primary"
            style={{
              width: '100%',
              background: 'linear-gradient(135deg,#4caf6a,#2e7a47)',
              borderColor: '#4caf6a',
              color: '#fff',
              fontSize: '0.78rem',
              padding: '6px 0',
            }}
            disabled={!canBuy}
            onClick={() => onBuy(safeBuyQty)}>
            Acheter {safeBuyQty}
          </button>
        </div>
      </div>

      {/* ── Dump ── */}
      {showDump && (
        <div style={{
          background: 'rgba(180,60,60,0.07)',
          border: '1px solid rgba(180,60,60,0.32)',
          borderRadius: 'var(--radius)',
          padding: 8,
        }}>
          <div style={{
            fontSize: '0.75rem',
            color: '#c96060',
            marginBottom: 3,
            fontFamily: 'var(--font-ui)',
            letterSpacing: '0.04em',
          }}>
            Dump — Inonder le marché
          </div>
          {(() => {
            const impact   = resourceMarket.elasticityK * (playerQty / Math.max(resourceMarket.volumeAvailable, 1))
            const newPrice = Math.max(0.05, resourceMarket.currentPrice * (1 - impact))
            return (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                {playerQty} {meta.icon} · {resourceMarket.currentPrice.toFixed(2)} → <span style={{ color: '#c96060' }}>{newPrice.toFixed(2)}</span>
                {' · '}<span className="gold-value">+{formatGold(playerQty * resourceMarket.currentPrice)} or</span>
              </div>
            )
          })()}
          <button className="btn-secondary"
            style={{ width: '100%', borderColor: 'rgba(180,60,60,0.5)', color: '#c96060', fontSize: '0.75rem', padding: '4px 0' }}
            onClick={() => onSell(playerQty)}>
            Tout vendre — {playerQty} {meta.icon}
          </button>
        </div>
      )}

    </div>
  )
}

// ─── Main SpotMarket (sidebar panel) ─────────────────────────────────────────

interface Props {
  state: GameState
  onSell: (resourceId: ResourceId, qty: number) => void
  onBuy: (resourceId: ResourceId, qty: number) => void
  onContribute: (qty: number, wonderId: WonderId) => void
}

export function SpotMarket({ state, onSell, onBuy, onContribute }: Props) {
  const playerWood = state.player.inventory['wood'] ?? 0
  const phase0Done = playerWood >= PHASE0_WOOD_GOAL
  const woodProgress = Math.min(playerWood / PHASE0_WOOD_GOAL * 100, 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: 14, gap: 12, minHeight: '100%' }}>

      {/* ── Header ── */}
      <div style={{
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-ui)',
        letterSpacing: '0.1em',
        paddingBottom: 8,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{ color: 'var(--accent-dim)', textTransform: 'uppercase' }}>⚖ Spot Market</span>
        <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>J{state.day}</span>
      </div>

      {/* ── Active rumors ── */}
      {state.activeRumors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
          {state.activeRumors.slice(-3).map((r, i) => (
            <div key={i} style={{
              fontSize: '0.76rem',
              color: 'var(--text)',
              fontStyle: 'italic',
              background: 'rgba(201,168,76,0.05)',
              borderLeft: '2px solid var(--accent-dim)',
              borderRadius: '0 4px 4px 0',
              padding: '5px 9px',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.4,
            }}>
              {r.text}
            </div>
          ))}
        </div>
      )}

      {/* ── Wood market card (Phase 0 — only wood shown) ── */}
      <ResourceCard
        resourceId="wood"
        resourceMarket={state.market.resources['wood']}
        state={state}
        onSell={qty => onSell('wood', qty)}
        onBuy={qty => onBuy('wood', qty)}
        onContribute={qty => onContribute(qty, 'grande_cathedrale')}
      />

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── Phase 0 progression bar ── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          fontFamily: 'var(--font-mono)',
          marginBottom: 6,
          color: phase0Done ? 'var(--accent)' : 'var(--text-muted)',
        }}>
          <span>🪵 Bûcheron</span>
          <span style={{ color: phase0Done ? 'var(--success)' : 'var(--text-dim)' }}>
            {Math.min(playerWood, PHASE0_WOOD_GOAL)} / {PHASE0_WOOD_GOAL}
          </span>
        </div>
        <div style={{
          height: 5,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 8,
        }}>
          <div style={{
            height: '100%',
            width: `${woodProgress}%`,
            background: phase0Done
              ? 'linear-gradient(90deg, var(--success), #2e7a47)'
              : 'linear-gradient(90deg, #5a9e6a, #3a6e4a)',
            borderRadius: 3,
            transition: 'width 0.4s ease',
            boxShadow: phase0Done ? '0 0 8px rgba(76,175,106,0.5)' : undefined,
          }} />
        </div>
        {phase0Done ? (
          <button className="btn-primary" style={{ width: '100%', fontSize: '0.82rem', padding: '8px 0' }}>
            ✦ Construire un Bûcheron
          </button>
        ) : (
          <div style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)',
            textAlign: 'center',
            lineHeight: 1.4,
          }}>
            Accumule encore {PHASE0_WOOD_GOAL - Math.min(playerWood, PHASE0_WOOD_GOAL)} bois pour construire
          </div>
        )}
      </div>
    </div>
  )
}
