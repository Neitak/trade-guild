import { useState, useMemo } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { GameState, ResourceId, WonderId } from '../engine/types'
import { previewSell, previewBuy } from '../engine/market'

interface Props {
  state: GameState
  onSell: (resourceId: ResourceId, qty: number) => void
  onBuy: (resourceId: ResourceId, qty: number) => void
  onContribute: (qty: number, wonderId: WonderId) => void
}

const SELL_QTYS = [10, 25, 50, 100]
const BUY_QTYS  = [10, 25, 50]

function calcMovingAverage(data: { day: number; price: number }[], window: number) {
  return data.map((point, i) => {
    if (i < window - 1) return { day: point.day, ma: null }
    const slice = data.slice(i - window + 1, i + 1)
    const avg = slice.reduce((s, p) => s + p.price, 0) / window
    return { day: point.day, ma: parseFloat(avg.toFixed(4)) }
  })
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const price     = payload.find((p: any) => p.dataKey === 'price')?.value
  const ma3v      = payload.find((p: any) => p.dataKey === 'ma3')?.value
  const ma7v      = payload.find((p: any) => p.dataKey === 'ma7')?.value
  const texMarker = payload.find((p: any) => p.dataKey === 'texMarker')?.value
  return (
    <div style={{
      background: 'rgba(8,8,20,0.96)',
      border: '1px solid rgba(201,168,76,0.25)',
      borderRadius: 6,
      padding: '7px 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      lineHeight: 1.7,
      minWidth: 110,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 3, fontSize: 10, letterSpacing: '0.06em' }}>
        JOUR {label}
      </div>
      {price != null && (
        <div style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 500 }}>
          {price.toFixed(3)} or
        </div>
      )}
      {ma3v != null && (
        <div style={{ color: '#6a9fd8', fontSize: 10 }}>MM3 {ma3v.toFixed(3)}</div>
      )}
      {ma7v != null && (
        <div style={{ color: '#9d6ac9', fontSize: 10 }}>MM7 {ma7v.toFixed(3)}</div>
      )}
      {texMarker != null && (
        <div style={{ color: 'var(--tex-color)', fontSize: 10, marginTop: 2 }}>⚔ Tex</div>
      )}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SpotMarket({ state, onSell, onBuy, onContribute }: Props) {
  const [activeResource, setActiveResource] = useState<ResourceId>('apple')
  const [showMA3, setShowMA3] = useState(true)
  const [showMA7, setShowMA7] = useState(true)
  const [activeQtySell, setActiveQtySell] = useState(25)
  const [activeQtyBuy, setActiveQtyBuy]   = useState(25)

  const { market, player, wonders } = state
  const resourceMarket = market.resources[activeResource]
  const priceHistory   = resourceMarket.priceHistory
  const playerQty      = player.inventory[activeResource] ?? 0

  // Chart colors — gold for apples, forest green for wood
  const isAppleTab   = activeResource === 'apple'
  const chartHex     = isAppleTab ? '#c9a84c' : '#5a9e6a'
  const chartColor   = isAppleTab ? 'var(--accent)' : '#5a9e6a'
  const gradientId   = isAppleTab ? 'priceGradientApple' : 'priceGradientWood'

  // Price delta vs previous day
  const prevPrice  = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2].price : null
  const priceDelta = prevPrice != null ? resourceMarket.currentPrice - prevPrice : 0
  const deltaColor = priceDelta > 0.004 ? 'var(--success)' : priceDelta < -0.004 ? 'var(--danger)' : 'var(--text-muted)'
  const deltaLabel = priceDelta > 0.004 ? `↑ +${priceDelta.toFixed(3)}` : priceDelta < -0.004 ? `↓ ${priceDelta.toFixed(3)}` : '— stable'

  // Chart data
  const ma3 = useMemo(() => calcMovingAverage(priceHistory, 3), [priceHistory])
  const ma7 = useMemo(() => calcMovingAverage(priceHistory, 7), [priceHistory])

  const chartData = priceHistory.map((p, i) => ({
    day: p.day,
    price: parseFloat(p.price.toFixed(3)),
    texMarker: p.texMarker ? p.price : undefined,
    ma3: ma3[i]?.ma,
    ma7: ma7[i]?.ma,
  }))

  // Action previews
  const sellPreview = previewSell(state, activeResource, activeQtySell)
  const buyPreview  = previewBuy(state, activeResource, activeQtyBuy)

  const canSell = playerQty >= activeQtySell
  const canBuy  = player.gold >= buyPreview.cost && buyPreview.actualQty > 0

  // Wonder contribution
  const wonderId: WonderId = isAppleTab ? 'tower_of_magic' : 'grande_cathedrale'
  const wonder = wonders.find(w => w.id === wonderId)!
  const resourceKey    = isAppleTab ? 'apple' : 'wood'
  const wonderRequired = wonder.requiredResources[resourceKey] ?? 0
  const wonderContrib  = wonder.playerContributed[resourceKey] ?? 0
  const wonderNeeded   = wonderRequired - wonderContrib
  const maxContribute  = Math.min(playerQty, wonderNeeded)

  // Dump
  const dumpThreshold = isAppleTab ? 20 : 10
  const showDump      = playerQty >= dumpThreshold

  const resourceLabel = isAppleTab ? 'pommes' : 'bois'
  const resourceIcon  = isAppleTab ? '🍎' : '🪵'
  const wonderName    = isAppleTab ? 'Tour de Magie' : 'Grande Cathédrale'

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>

      {/* Resource tabs + MA toggles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn-secondary"
            style={{
              padding: '4px 14px', fontSize: '0.75rem',
              borderColor: !isAppleTab ? undefined : 'var(--accent)',
              color:       !isAppleTab ? undefined : 'var(--accent)',
            }}
            onClick={() => setActiveResource('apple')}
          >🍎 Pommes</button>
          <button
            className="btn-secondary"
            style={{
              padding: '4px 14px', fontSize: '0.75rem',
              borderColor: isAppleTab ? undefined : '#5a9e6a',
              color:       isAppleTab ? undefined : '#5a9e6a',
            }}
            onClick={() => setActiveResource('wood')}
          >🪵 Bois</button>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn-secondary"
            style={{ padding: '3px 10px', fontSize: '0.7rem', opacity: showMA3 ? 1 : 0.35 }}
            onClick={() => setShowMA3(v => !v)}>MM 3j</button>
          <button className="btn-secondary"
            style={{ padding: '3px 10px', fontSize: '0.7rem', opacity: showMA7 ? 1 : 0.35 }}
            onClick={() => setShowMA7(v => !v)}>MM 7j</button>
        </div>
      </div>

      {/* Current price + delta */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: '1.6rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: chartColor, lineHeight: 1 }}>
          {resourceMarket.currentPrice.toFixed(2)}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>or / {resourceIcon}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: deltaColor }}>{deltaLabel}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          vol. {Math.round(resourceMarket.volumeAvailable)}
        </span>
      </div>

      {/* Price chart */}
      <div style={{ flex: 1, minHeight: 140, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={chartHex} stopOpacity={0.28} />
                <stop offset="90%" stopColor={chartHex} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="day"
              tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            />
            <YAxis
              domain={[
                (min: number) => Math.max(0.01, parseFloat((min - 0.08).toFixed(2))),
                (max: number) => parseFloat((max + 0.08).toFixed(2)),
              ]}
              tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.toFixed(2)}
              width={38}
            />

            {/* Equilibrium reference line */}
            <ReferenceLine
              y={resourceMarket.equilibriumPrice}
              stroke={chartHex}
              strokeDasharray="8 5"
              strokeOpacity={0.3}
              strokeWidth={1}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Gradient area fill */}
            <Area
              type="monotone"
              dataKey="price"
              stroke="none"
              fill={`url(#${gradientId})`}
              fillOpacity={1}
            />

            {/* Price line */}
            <Line
              type="monotone"
              dataKey="price"
              stroke={chartColor}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: chartHex, strokeWidth: 0 }}
              name="Prix"
            />

            {/* Tex action markers */}
            <Line
              type="monotone"
              dataKey="texMarker"
              stroke="var(--tex-color)"
              strokeWidth={0}
              dot={{ r: 4, fill: 'var(--tex-color)', strokeWidth: 1.5, stroke: 'rgba(0,0,0,0.4)' }}
              activeDot={false}
              name="Tex"
              connectNulls={false}
            />

            {/* Moving averages */}
            {showMA3 && (
              <Line type="monotone" dataKey="ma3" stroke="#6a9fd8" strokeWidth={1}
                strokeDasharray="4 2" dot={false} activeDot={false} name="MM 3j" connectNulls={false} />
            )}
            {showMA7 && (
              <Line type="monotone" dataKey="ma7" stroke="#9d6ac9" strokeWidth={1}
                strokeDasharray="6 3" dot={false} activeDot={false} name="MM 7j" connectNulls={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Trade actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Sell */}
        <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 10 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 7, fontFamily: 'var(--font-ui)', letterSpacing: '0.04em' }}>
            Vendre
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
            {SELL_QTYS.map(q => (
              <button key={q} className="btn-secondary"
                style={{ flex: 1, padding: '3px 0', fontSize: '0.75rem', borderColor: q === activeQtySell ? 'var(--accent)' : undefined }}
                onClick={() => setActiveQtySell(q)}>{q}</button>
            ))}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 7, minHeight: 28, fontFamily: 'var(--font-mono)' }}>
            {canSell
              ? <>→ <span style={{ color: 'var(--accent-dim)' }}>{sellPreview.newPrice.toFixed(2)}</span> · <span className="gold-value">+{Math.floor(sellPreview.goldEarned)} or</span></>
              : <span style={{ color: 'var(--danger)' }}>Stock insuffisant ({playerQty})</span>
            }
          </div>
          <button className="btn-primary" style={{ width: '100%' }} disabled={!canSell} onClick={() => onSell(activeResource, activeQtySell)}>
            Vendre {activeQtySell} {resourceIcon}
          </button>
        </div>

        {/* Buy */}
        <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 10 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 7, fontFamily: 'var(--font-ui)', letterSpacing: '0.04em' }}>
            Acheter
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
            {BUY_QTYS.map(q => (
              <button key={q} className="btn-secondary"
                style={{ flex: 1, padding: '3px 0', fontSize: '0.75rem', borderColor: q === activeQtyBuy ? 'var(--accent)' : undefined }}
                onClick={() => setActiveQtyBuy(q)}>{q}</button>
            ))}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 7, minHeight: 28, fontFamily: 'var(--font-mono)' }}>
            {canBuy
              ? <>→ <span style={{ color: 'var(--accent-dim)' }}>{buyPreview.newPrice.toFixed(2)}</span> · <span className="gold-value">{Math.floor(buyPreview.cost)} or</span></>
              : <span style={{ color: 'var(--danger)' }}>Or insuffisant ou marché vide</span>
            }
          </div>
          <button className="btn-primary" style={{ width: '100%' }} disabled={!canBuy} onClick={() => onBuy(activeResource, activeQtyBuy)}>
            Acheter {activeQtyBuy} {resourceIcon}
          </button>
        </div>
      </div>

      {/* Dump */}
      {showDump && (
        <div style={{ background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.4)', borderRadius: 'var(--radius)', padding: 10 }}>
          <div style={{ fontSize: '0.72rem', color: '#c96060', marginBottom: 5, fontFamily: 'var(--font-ui)', letterSpacing: '0.04em' }}>
            Dump — Inonder le marché
          </div>
          {(() => {
            const r = resourceMarket
            const impact   = r.elasticityK * (playerQty / Math.max(r.volumeAvailable, 1))
            const newPrice = Math.max(0.05, r.currentPrice * (1 - impact))
            const goldEarned = playerQty * r.currentPrice
            return (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 7, fontFamily: 'var(--font-mono)' }}>
                {playerQty} {resourceIcon} · prix {r.currentPrice.toFixed(2)} → <span style={{ color: '#c96060' }}>{newPrice.toFixed(2)}</span> · <span className="gold-value">+{Math.floor(goldEarned)} or</span>
              </div>
            )
          })()}
          <button className="btn-secondary" style={{ width: '100%', borderColor: 'rgba(180,60,60,0.5)', color: '#c96060' }} onClick={() => onSell(activeResource, playerQty)}>
            Tout vendre — {playerQty} {resourceIcon}
          </button>
        </div>
      )}

      {/* Wonder contribution */}
      {maxContribute > 0 && !wonder.complete && (
        <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: 10 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: 5, fontFamily: 'var(--font-ui)' }}>
            ✦ {wonderName} — {wonderContrib}/{wonderRequired} {resourceIcon}
          </div>
          <button className="btn-primary" onClick={() => onContribute(maxContribute, wonderId)}>
            Apporter {maxContribute} {resourceIcon} à la {wonderName}
          </button>
        </div>
      )}
    </div>
  )
}
