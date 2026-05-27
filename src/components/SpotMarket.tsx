import { useState, useMemo } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { GameState, ResourceId, WonderId, ResourceMarket, GuildId } from '../engine/types'
import { GUILD_COLORS } from '../engine/types'
import { previewSell, previewBuy } from '../engine/market'

interface Props {
  state: GameState
  onSell: (resourceId: ResourceId, qty: number) => void
  onBuy: (resourceId: ResourceId, qty: number) => void
  onContribute: (qty: number, wonderId: WonderId) => void
}

const SELL_QTYS = [10, 25, 50, 100]
const BUY_QTYS  = [10, 25, 50]

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
    dumpThreshold: 10,
  },
}

function calcMovingAverage(data: { day: number; price: number }[], window: number) {
  return data.map((point, i) => {
    if (i < window - 1) return { day: point.day, ma: null }
    const slice = data.slice(i - window + 1, i + 1)
    const avg = slice.reduce((s, p) => s + p.price, 0) / window
    return { day: point.day, ma: parseFloat(avg.toFixed(4)) }
  })
}

const RIVAL_MARKER_KEYS: Array<{ key: string; id: GuildId; label: string }> = [
  { key: 'marker_player', id: 'player', label: 'Toi'  },
  { key: 'marker_tex',    id: 'tex',    label: 'Tex'  },
  { key: 'marker_sam',    id: 'sam',    label: 'Sam'  },
  { key: 'marker_rita',   id: 'rita',   label: 'Rita' },
]

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
      padding: '4px 8px',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <div>
        <span style={{ color: 'var(--text-muted)' }}>J{label} </span>
        {price != null && <span style={{ color: 'var(--accent)' }}>{price.toFixed(2)}</span>}
      </div>
      {markers.map(mk => (
        <div key={mk.key} style={{ color: GUILD_COLORS[mk.id], fontSize: 9 }}>
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

function ResourceCard({ resourceId, resourceMarket, state, onSell, onBuy, onContribute }: CardProps) {
  const [qtySell, setQtySell] = useState(25)
  const [qtyBuy, setQtyBuy]   = useState(25)

  const meta = RESOURCE_META[resourceId]
  const { player, wonders } = state
  const priceHistory = resourceMarket.priceHistory
  const playerQty    = player.inventory[resourceId] ?? 0

  const prevPrice  = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2].price : null
  const priceDelta = prevPrice != null ? resourceMarket.currentPrice - prevPrice : 0
  const deltaColor = priceDelta > 0.004 ? 'var(--success)' : priceDelta < -0.004 ? 'var(--danger)' : 'var(--text-muted)'
  const deltaLabel = priceDelta > 0.004
    ? `↑ +${priceDelta.toFixed(2)}`
    : priceDelta < -0.004
    ? `↓ ${priceDelta.toFixed(2)}`
    : '—'

  const ma3 = useMemo(() => calcMovingAverage(priceHistory, 3), [priceHistory])
  const chartData = priceHistory.map((p, i) => ({
    day: p.day,
    price: parseFloat(p.price.toFixed(3)),
    marker_player: p.marker === 'player' ? p.price : undefined,
    marker_tex:    p.marker === 'tex'    ? p.price : undefined,
    marker_sam:    p.marker === 'sam'    ? p.price : undefined,
    marker_rita:   p.marker === 'rita'   ? p.price : undefined,
    ma3: ma3[i]?.ma,
  }))

  // Intel panel — yesterday's rival trades on this resource
  const yesterday = state.day - 1
  type IntelEntry = { actor: GuildId; bought: number; sold: number; priceBuy: number; priceSell: number; count: number }
  const intelMap: Partial<Record<GuildId, IntelEntry>> = {}
  for (const ev of state.log) {
    if (ev.day !== yesterday) continue
    if (ev.actor === 'player' || ev.actor === 'system') continue
    if (ev.payload['resourceId'] !== resourceId) continue
    if (ev.type !== 'BUY' && ev.type !== 'SELL') continue
    const actor = ev.actor as GuildId
    if (!intelMap[actor]) intelMap[actor] = { actor, bought: 0, sold: 0, priceBuy: 0, priceSell: 0, count: 0 }
    const entry = intelMap[actor]!
    if (ev.type === 'BUY') {
      entry.bought += ev.payload['qty'] as number
      entry.priceBuy = ev.payload['price'] as number
    } else {
      entry.sold += ev.payload['qty'] as number
      entry.priceSell = ev.payload['price'] as number
    }
    entry.count++
  }
  const intelEntries = Object.values(intelMap) as IntelEntry[]

  const sellPreview = previewSell(state, resourceId, qtySell)
  const buyPreview  = previewBuy(state, resourceId, qtyBuy)
  const canSell = playerQty >= qtySell
  const canBuy  = player.gold >= buyPreview.cost && buyPreview.actualQty > 0

  const wonder = wonders.find(w => w.id === meta.wonderId)!
  const wonderRequired = wonder.requiredResources[resourceId] ?? 0
  const wonderContrib  = wonder.playerContributed[resourceId] ?? 0
  const maxContribute  = Math.min(playerQty, wonderRequired - wonderContrib)

  const showDump = playerQty >= meta.dumpThreshold

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: '1rem', fontFamily: 'var(--font-ui)', color: meta.chartColor }}>
          {meta.icon} {meta.label}
        </span>
        <span style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: meta.chartColor, marginLeft: 'auto' }}>
          {resourceMarket.currentPrice.toFixed(2)}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>or</span>
        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: deltaColor }}>{deltaLabel}</span>
      </div>

      {/* Mini chart */}
      <div style={{ height: 100, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id={meta.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={meta.chartHex} stopOpacity={0.25} />
                <stop offset="90%" stopColor={meta.chartHex} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 8, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} />
            <YAxis
              domain={[
                (min: number) => Math.max(0.01, parseFloat((min - 0.05).toFixed(2))),
                (max: number) => parseFloat((max + 0.05).toFixed(2)),
              ]}
              tick={{ fill: 'var(--text-muted)', fontSize: 8, fontFamily: 'var(--font-mono)' }}
              tickLine={false} axisLine={false}
              tickFormatter={(v) => v.toFixed(1)}
              width={34}
            />
            <ReferenceLine y={resourceMarket.equilibriumPrice} stroke={meta.chartHex} strokeDasharray="6 4" strokeOpacity={0.25} strokeWidth={1} />
            <Tooltip content={<MiniTooltip />} />
            <Area type="monotone" dataKey="price" stroke="none" fill={`url(#${meta.gradientId})`} fillOpacity={1} />
            <Line type="monotone" dataKey="price" stroke={meta.chartColor} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: meta.chartHex, strokeWidth: 0 }} />
            <Line type="monotone" dataKey="ma3" stroke="#6a9fd8" strokeWidth={1} strokeDasharray="3 2" dot={false} activeDot={false} connectNulls={false} />
            {RIVAL_MARKER_KEYS.map(mk => (
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

      {/* Stock info */}
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 12 }}>
        <span>Stock <span style={{ color: 'var(--text-dim)' }}>{playerQty}</span> {meta.icon}</span>
        <span>Vol. <span style={{ color: 'var(--text-dim)' }}>{Math.round(resourceMarket.volumeAvailable)}</span></span>
      </div>

      {/* Intel panel — yesterday's rival activity */}
      {state.day > 1 && (
        <div style={{
          background: 'rgba(255,255,255,0.015)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 'var(--radius)',
          padding: '6px 8px',
          fontSize: '0.68rem',
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.63rem', letterSpacing: '0.07em', marginBottom: 4, fontFamily: 'var(--font-ui)' }}>
            ◈ HIER (J{state.day - 1})
          </div>
          {intelEntries.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>Aucune activité rivale</div>
          ) : (
            intelEntries.map(e => (
              <div key={e.actor} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                <span style={{ color: GUILD_COLORS[e.actor], minWidth: 28 }}>{e.actor.charAt(0).toUpperCase() + e.actor.slice(1)}</span>
                {e.bought > 0 && (
                  <span style={{ color: 'var(--success)' }}>
                    ↑ {e.bought} {meta.icon}
                    <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>à {e.priceBuy.toFixed(2)}</span>
                  </span>
                )}
                {e.sold > 0 && (
                  <span style={{ color: 'var(--danger)', marginLeft: e.bought > 0 ? 6 : 0 }}>
                    ↓ {e.sold} {meta.icon}
                    <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>à {e.priceSell.toFixed(2)}</span>
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}


      {/* Trade actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Sell */}
        <div style={{ flex: 1, background: 'rgba(201,76,76,0.06)', border: '1px solid rgba(201,76,76,0.2)', borderRadius: 'var(--radius)', padding: 8 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--danger)', marginBottom: 6, letterSpacing: '0.04em', fontFamily: 'var(--font-ui)' }}>Vendre</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {SELL_QTYS.map(q => (
              <button key={q} className="btn-secondary"
                style={{ flex: 1, padding: '2px 0', fontSize: '0.7rem', borderColor: q === qtySell ? 'var(--danger)' : undefined, color: q === qtySell ? 'var(--danger)' : undefined }}
                onClick={() => setQtySell(q)}>{q}</button>
            ))}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: 6, minHeight: 20, fontFamily: 'var(--font-mono)' }}>
            {canSell
              ? <><span style={{ color: 'var(--text-muted)' }}>{sellPreview.newPrice.toFixed(2)}</span> · <span className="gold-value">+{Math.floor(sellPreview.goldEarned)} or</span></>
              : <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Stock insuffisant ({playerQty})</span>
            }
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%', background: 'linear-gradient(135deg,#c94c4c,#8f3030)', borderColor: '#c94c4c', color: '#fff', fontSize: '0.75rem', padding: '5px 0' }}
            disabled={!canSell}
            onClick={() => onSell(qtySell)}
          >
            Vendre {qtySell}
          </button>
        </div>

        {/* Buy */}
        <div style={{ flex: 1, background: 'rgba(76,175,106,0.06)', border: '1px solid rgba(76,175,106,0.2)', borderRadius: 'var(--radius)', padding: 8 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--success)', marginBottom: 6, letterSpacing: '0.04em', fontFamily: 'var(--font-ui)' }}>Acheter</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {BUY_QTYS.map(q => (
              <button key={q} className="btn-secondary"
                style={{ flex: 1, padding: '2px 0', fontSize: '0.7rem', borderColor: q === qtyBuy ? 'var(--success)' : undefined, color: q === qtyBuy ? 'var(--success)' : undefined }}
                onClick={() => setQtyBuy(q)}>{q}</button>
            ))}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: 6, minHeight: 20, fontFamily: 'var(--font-mono)' }}>
            {canBuy
              ? <><span style={{ color: 'var(--text-muted)' }}>{buyPreview.newPrice.toFixed(2)}</span> · <span className="gold-value">{Math.floor(buyPreview.cost)} or</span></>
              : <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Or insuffisant</span>
            }
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%', background: 'linear-gradient(135deg,#4caf6a,#2e7a47)', borderColor: '#4caf6a', color: '#fff', fontSize: '0.75rem', padding: '5px 0' }}
            disabled={!canBuy}
            onClick={() => onBuy(qtyBuy)}
          >
            Acheter {qtyBuy}
          </button>
        </div>
      </div>

      {/* Dump */}
      {showDump && (
        <div style={{ background: 'rgba(180,60,60,0.07)', border: '1px solid rgba(180,60,60,0.35)', borderRadius: 'var(--radius)', padding: 8 }}>
          <div style={{ fontSize: '0.68rem', color: '#c96060', marginBottom: 4, fontFamily: 'var(--font-ui)', letterSpacing: '0.04em' }}>
            Dump — Inonder le marché
          </div>
          {(() => {
            const impact   = resourceMarket.elasticityK * (playerQty / Math.max(resourceMarket.volumeAvailable, 1))
            const newPrice = Math.max(0.05, resourceMarket.currentPrice * (1 - impact))
            return (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                {playerQty} {meta.icon} · {resourceMarket.currentPrice.toFixed(2)} → <span style={{ color: '#c96060' }}>{newPrice.toFixed(2)}</span>
                {' · '}<span className="gold-value">+{Math.floor(playerQty * resourceMarket.currentPrice)} or</span>
              </div>
            )
          })()}
          <button className="btn-secondary" style={{ width: '100%', borderColor: 'rgba(180,60,60,0.5)', color: '#c96060', fontSize: '0.72rem', padding: '4px 0' }}
            onClick={() => onSell(playerQty)}>
            Tout vendre — {playerQty} {meta.icon}
          </button>
        </div>
      )}

      {/* Wonder contribution */}
      {maxContribute > 0 && !wonder.complete && (
        <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: 8 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent)', marginBottom: 5, fontFamily: 'var(--font-ui)' }}>
            ✦ {meta.wonderName} — {wonderContrib}/{wonderRequired} {meta.icon}
          </div>
          <button className="btn-primary" style={{ fontSize: '0.72rem', padding: '5px 0', width: '100%' }}
            onClick={() => onContribute(maxContribute)}>
            Apporter {maxContribute} {meta.icon}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SpotMarket({ state, onSell, onBuy, onContribute }: Props) {
  const resources: ResourceId[] = ['apple', 'wood']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', letterSpacing: '0.08em', paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
        ⚖ SPOT MARKET — Jour {state.day}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {resources.map(rid => (
          <ResourceCard
            key={rid}
            resourceId={rid}
            resourceMarket={state.market.resources[rid]}
            state={state}
            onSell={qty => onSell(rid, qty)}
            onBuy={qty => onBuy(rid, qty)}
            onContribute={qty => onContribute(qty, RESOURCE_META[rid].wonderId)}
          />
        ))}
      </div>
    </div>
  )
}
