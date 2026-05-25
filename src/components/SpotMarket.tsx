import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, Legend,
} from 'recharts'
import type { GameState, ResourceId } from '../engine/types'
import { previewSell, previewBuy } from '../engine/market'

interface Props {
  state: GameState
  onSell: (resourceId: ResourceId, qty: number) => void
  onBuy: (resourceId: ResourceId, qty: number) => void
  onContribute: (qty: number) => void
}

const SELL_QTYS = [10, 25, 50, 100]
const BUY_QTYS = [10, 25, 50]

function calcDumpPreview(state: import('../engine/types').GameState, qty: number) {
  const r = state.market.resources.apple
  const impact = r.elasticityK * (qty / Math.max(r.volumeAvailable, 1))
  const newPrice = Math.max(0.05, r.currentPrice * (1 - impact))
  return { goldEarned: qty * r.currentPrice, newPrice, priceDrop: r.currentPrice - newPrice }
}

function calcMovingAverage(data: { day: number; price: number }[], window: number) {
  return data.map((point, i) => {
    if (i < window - 1) return { day: point.day, ma: null }
    const slice = data.slice(i - window + 1, i + 1)
    const avg = slice.reduce((s, p) => s + p.price, 0) / window
    return { day: point.day, ma: parseFloat(avg.toFixed(4)) }
  })
}

export function SpotMarket({ state, onSell, onBuy, onContribute }: Props) {
  const [showMA3, setShowMA3] = useState(true)
  const [showMA7, setShowMA7] = useState(true)
  const [activeQtySell, setActiveQtySell] = useState(25)
  const [activeQtyBuy, setActiveQtyBuy] = useState(25)

  const { market, player } = state
  const appleMarket = market.resources.apple
  const priceHistory = appleMarket.priceHistory
  const playerApples = player.inventory.apple ?? 0

  // Merge price history with MAs
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
  const sellPreview = previewSell(state, 'apple', activeQtySell)
  const buyPreview = previewBuy(state, 'apple', activeQtyBuy)

  const canSell = playerApples >= activeQtySell
  const canBuy = player.gold >= buyPreview.cost && buyPreview.actualQty > 0

  // Wonder contribution
  const wonderNeeded = (state.wonder.requiredResources.apple ?? 0) - (state.wonder.playerContributed.apple ?? 0)
  const maxContribute = Math.min(playerApples, wonderNeeded)

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '0.9rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>
          MARCHÉ AUX POMMES
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Afficher :</span>
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
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
        <span style={{ fontSize: '1.6rem', fontFamily: 'var(--font-title)', color: 'var(--accent)' }}>
          {appleMarket.currentPrice.toFixed(2)}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>or / pomme</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Volume : {Math.round(appleMarket.volumeAvailable)} disponibles
        </span>
      </div>

      {/* Price chart */}
      <div style={{ flex: 1, minHeight: 160, minWidth: 0 }}>
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
                (dataMin: number) => Math.max(0.01, parseFloat((dataMin - 0.05).toFixed(2))),
                (dataMax: number) => parseFloat((dataMax + 0.05).toFixed(2)),
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
            {/* Main price line */}
            <Line
              type="monotone"
              dataKey="price"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--accent)' }}
              name="Prix"
            />
            {/* Tex transaction markers */}
            <Line
              type="monotone"
              dataKey="texMarker"
              stroke="var(--tex-color)"
              strokeWidth={0}
              dot={{ r: 4, fill: 'var(--tex-color)', strokeWidth: 0 }}
              activeDot={false}
              name="Tex"
              connectNulls={false}
            />
            {/* Moving averages */}
            {showMA3 && (
              <Line
                type="monotone"
                dataKey="ma3"
                stroke="#6a9fd8"
                strokeWidth={1}
                strokeDasharray="4 2"
                dot={false}
                activeDot={false}
                name="MM 3j"
                connectNulls={false}
              />
            )}
            {showMA7 && (
              <Line
                type="monotone"
                dataKey="ma7"
                stroke="#9d6ac9"
                strokeWidth={1}
                strokeDasharray="6 3"
                dot={false}
                activeDot={false}
                name="MM 7j"
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trade actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Sell */}
        <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 10 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 8, fontFamily: 'var(--font-title)', letterSpacing: '0.05em' }}>
            VENDRE
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {SELL_QTYS.map(q => (
              <button
                key={q}
                className="btn-secondary"
                style={{ flex: 1, padding: '4px 0', fontSize: '0.8rem', borderColor: q === activeQtySell ? 'var(--accent)' : undefined }}
                onClick={() => setActiveQtySell(q)}
              >{q}</button>
            ))}
          </div>
          {/* Preview */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 8, minHeight: 32 }}>
            {canSell
              ? <>Vendre {sellPreview.actualQty} pommes → prix {sellPreview.currentPrice.toFixed(2)} → <span style={{ color: 'var(--accent-dim)' }}>{sellPreview.newPrice.toFixed(2)}</span>. Gain : <span className="gold-value">+{Math.floor(sellPreview.goldEarned)} or</span></>
              : <span style={{ color: 'var(--danger)' }}>Pas assez de pommes ({playerApples} disponibles)</span>
            }
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            disabled={!canSell}
            onClick={() => onSell('apple', activeQtySell)}
          >
            Vendre {activeQtySell} pommes
          </button>
        </div>

        {/* Buy */}
        <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 10 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 8, fontFamily: 'var(--font-title)', letterSpacing: '0.05em' }}>
            ACHETER
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {BUY_QTYS.map(q => (
              <button
                key={q}
                className="btn-secondary"
                style={{ flex: 1, padding: '4px 0', fontSize: '0.8rem', borderColor: q === activeQtyBuy ? 'var(--accent)' : undefined }}
                onClick={() => setActiveQtyBuy(q)}
              >{q}</button>
            ))}
          </div>
          {/* Preview */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 8, minHeight: 32 }}>
            {canBuy
              ? <>Acheter {buyPreview.actualQty} pommes → prix {buyPreview.currentPrice.toFixed(2)} → <span style={{ color: 'var(--accent-dim)' }}>{buyPreview.newPrice.toFixed(2)}</span>. Coût : <span className="gold-value">{Math.floor(buyPreview.cost)} or</span></>
              : <span style={{ color: 'var(--danger)' }}>Or insuffisant ou marché vide</span>
            }
          </div>
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            disabled={!canBuy}
            onClick={() => onBuy('apple', activeQtyBuy)}
          >
            Acheter {activeQtyBuy} pommes
          </button>
        </div>
      </div>

      {/* Dump action */}
      {playerApples >= 20 && (
        <div style={{ background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.4)', borderRadius: 'var(--radius)', padding: 10 }}>
          <div style={{ fontSize: '0.75rem', color: '#c96060', marginBottom: 6, fontFamily: 'var(--font-title)', letterSpacing: '0.05em' }}>
            DUMP — INONDER LE MARCHÉ
          </div>
          {(() => {
            const { goldEarned, newPrice, priceDrop } = calcDumpPreview(state, playerApples)
            return (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 8 }}>
                Vendre {playerApples} pommes d'un coup → prix {appleMarket.currentPrice.toFixed(2)} → <span style={{ color: '#c96060' }}>{newPrice.toFixed(2)}</span> (−{priceDrop.toFixed(2)}). Gain : <span className="gold-value">+{Math.floor(goldEarned)} or</span>
              </div>
            )
          })()}
          <button
            className="btn-secondary"
            style={{ width: '100%', borderColor: 'rgba(180,60,60,0.5)', color: '#c96060' }}
            onClick={() => onSell('apple', playerApples)}
          >
            Tout vendre — {playerApples} pommes
          </button>
        </div>
      )}

      {/* Wonder contribution */}
      {maxContribute > 0 && (
        <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: 10 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: 6 }}>
            ✦ Contribuer à la Tour de Magie — {maxContribute} pommes disponibles
          </div>
          <button
            className="btn-primary"
            onClick={() => onContribute(maxContribute)}
          >
            Apporter {maxContribute} pommes à la Tour
          </button>
        </div>
      )}
    </div>
  )
}
