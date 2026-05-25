import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
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

  // Wonder contribution (depends on active resource)
  const isAppleTab = activeResource === 'apple'
  const wonderId: WonderId = isAppleTab ? 'tower_of_magic' : 'grande_cathedrale'
  const wonder = wonders.find(w => w.id === wonderId)!
  const resourceKey = isAppleTab ? 'apple' : 'wood'
  const wonderRequired = wonder.requiredResources[resourceKey] ?? 0
  const wonderContrib  = wonder.playerContributed[resourceKey] ?? 0
  const wonderNeeded   = wonderRequired - wonderContrib
  const maxContribute  = Math.min(playerQty, wonderNeeded)

  // Dump — all-in sell
  const dumpThreshold = isAppleTab ? 20 : 10
  const showDump = playerQty >= dumpThreshold

  const resourceLabel = isAppleTab ? 'pommes' : 'bois'
  const resourceIcon  = isAppleTab ? '🍎' : '🪵'
  const wonderName    = isAppleTab ? 'Tour de Magie' : 'Grande Cathédrale'

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Header + resource tab */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn-secondary"
            style={{
              padding: '4px 14px',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-ui)',
              letterSpacing: '0.04em',
              borderColor: activeResource === 'apple' ? 'var(--accent)' : undefined,
              color: activeResource === 'apple' ? 'var(--accent)' : undefined,
            }}
            onClick={() => setActiveResource('apple')}
          >🍎 POMMES</button>
          <button
            className="btn-secondary"
            style={{
              padding: '4px 14px',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-ui)',
              letterSpacing: '0.04em',
              borderColor: activeResource === 'wood' ? '#8a9' : undefined,
              color: activeResource === 'wood' ? '#8ab' : undefined,
            }}
            onClick={() => setActiveResource('wood')}
          >🪵 BOIS</button>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className="btn-secondary"
            style={{ padding: '3px 10px', fontSize: '0.7rem', opacity: showMA3 ? 1 : 0.4 }}
            onClick={() => setShowMA3(v => !v)}
          >MM 3j</button>
          <button
            className="btn-secondary"
            style={{ padding: '3px 10px', fontSize: '0.7rem', opacity: showMA7 ? 1 : 0.4 }}
            onClick={() => setShowMA7(v => !v)}
          >MM 7j</button>
        </div>
      </div>

      {/* Current price */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
        <span style={{ fontSize: '1.5rem', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
          {resourceMarket.currentPrice.toFixed(2)}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          or / {resourceIcon}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Volume : {Math.round(resourceMarket.volumeAvailable)} disponibles
        </span>
      </div>

      {/* Price chart */}
      <div style={{ flex: 1, minHeight: 140, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="day"
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
            />
            <YAxis
              domain={[
                (dataMin: number) => Math.max(0.01, parseFloat((dataMin - 0.1).toFixed(2))),
                (dataMax: number) => parseFloat((dataMax + 0.1).toFixed(2)),
              ]}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.toFixed(2)}
            />
            <Tooltip
              contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: 'var(--text-dim)' }}
              itemStyle={{ color: 'var(--accent)' }}
              formatter={(v: number) => [v.toFixed(3), '']}
              labelFormatter={(v) => `Jour ${v}`}
            />
            <Line type="monotone" dataKey="price" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--accent)' }} name="Prix" />
            <Line type="monotone" dataKey="texMarker" stroke="var(--tex-color)" strokeWidth={0} dot={{ r: 4, fill: 'var(--tex-color)', strokeWidth: 0 }} activeDot={false} name="Tex" connectNulls={false} />
            {showMA3 && <Line type="monotone" dataKey="ma3" stroke="#6a9fd8" strokeWidth={1} strokeDasharray="4 2" dot={false} activeDot={false} name="MM 3j" connectNulls={false} />}
            {showMA7 && <Line type="monotone" dataKey="ma7" stroke="#9d6ac9" strokeWidth={1} strokeDasharray="6 3" dot={false} activeDot={false} name="MM 7j" connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trade actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Sell */}
        <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 10 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 7, fontFamily: 'var(--font-title)', letterSpacing: '0.05em' }}>
            VENDRE
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
            {SELL_QTYS.map(q => (
              <button key={q} className="btn-secondary"
                style={{ flex: 1, padding: '3px 0', fontSize: '0.75rem', borderColor: q === activeQtySell ? 'var(--accent)' : undefined }}
                onClick={() => setActiveQtySell(q)}>{q}</button>
            ))}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 7, minHeight: 28 }}>
            {canSell
              ? <>Vendre {sellPreview.actualQty} {resourceIcon} → <span style={{ color: 'var(--accent-dim)' }}>{sellPreview.newPrice.toFixed(2)}</span>. <span className="gold-value">+{Math.floor(sellPreview.goldEarned)} or</span></>
              : <span style={{ color: 'var(--danger)' }}>Pas assez de {resourceLabel} ({playerQty} disponibles)</span>
            }
          </div>
          <button className="btn-primary" style={{ width: '100%' }} disabled={!canSell} onClick={() => onSell(activeResource, activeQtySell)}>
            Vendre {activeQtySell} {resourceIcon}
          </button>
        </div>

        {/* Buy */}
        <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 10 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 7, fontFamily: 'var(--font-title)', letterSpacing: '0.05em' }}>
            ACHETER
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
            {BUY_QTYS.map(q => (
              <button key={q} className="btn-secondary"
                style={{ flex: 1, padding: '3px 0', fontSize: '0.75rem', borderColor: q === activeQtyBuy ? 'var(--accent)' : undefined }}
                onClick={() => setActiveQtyBuy(q)}>{q}</button>
            ))}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 7, minHeight: 28 }}>
            {canBuy
              ? <>Acheter {buyPreview.actualQty} {resourceIcon} → <span style={{ color: 'var(--accent-dim)' }}>{buyPreview.newPrice.toFixed(2)}</span>. <span className="gold-value">{Math.floor(buyPreview.cost)} or</span></>
              : <span style={{ color: 'var(--danger)' }}>Or insuffisant ou marché vide</span>
            }
          </div>
          <button className="btn-primary" style={{ width: '100%' }} disabled={!canBuy} onClick={() => onBuy(activeResource, activeQtyBuy)}>
            Acheter {activeQtyBuy} {resourceIcon}
          </button>
        </div>
      </div>

      {/* Dump action */}
      {showDump && (
        <div style={{ background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.4)', borderRadius: 'var(--radius)', padding: 10 }}>
          <div style={{ fontSize: '0.75rem', color: '#c96060', marginBottom: 5, fontFamily: 'var(--font-title)', letterSpacing: '0.05em' }}>
            DUMP — INONDER LE MARCHÉ
          </div>
          {(() => {
            const r = resourceMarket
            const impact = r.elasticityK * (playerQty / Math.max(r.volumeAvailable, 1))
            const newPrice = Math.max(0.05, r.currentPrice * (1 - impact))
            const goldEarned = playerQty * r.currentPrice
            const priceDrop = r.currentPrice - newPrice
            return (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 7 }}>
                Vendre {playerQty} {resourceIcon} d'un coup → prix {r.currentPrice.toFixed(2)} → <span style={{ color: '#c96060' }}>{newPrice.toFixed(2)}</span> (−{priceDrop.toFixed(2)}). <span className="gold-value">+{Math.floor(goldEarned)} or</span>
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
          <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: 5 }}>
            ✦ Contribuer — {wonderName} ({wonderContrib}/{wonderRequired} {resourceIcon})
          </div>
          <button className="btn-primary" onClick={() => onContribute(maxContribute, wonderId)}>
            Apporter {maxContribute} {resourceIcon} à la {wonderName}
          </button>
        </div>
      )}
    </div>
  )
}
