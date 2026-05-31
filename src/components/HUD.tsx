import type { GameState, GuildId } from '../engine/types'
import buildingDefs from '../data/buildings.json'

interface Props {
  state: GameState
}

function formatGold(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)}k`
  if (g >= 100)  return Math.round(g).toString()
  if (g >= 10)   return g.toFixed(1)
  return g.toFixed(2)
}

export function HUD({ state }: Props) {
  const { player, rivals, day, tickOfDay, market, rivalStrategies } = state

  const passiveIncome = Math.round(
    player.buildings.reduce((sum, b) => {
      const def = (buildingDefs as any[]).find(d => d.id === b.defId)
      if (!def?.revenuePerDay) return sum
      const level = b.level ?? 1
      const rev   = def.upgradeRevenues
        ? (def.upgradeRevenues[String(level)] ?? def.revenuePerDay)
        : def.revenuePerDay
      return sum + rev * (b.shares / 100)
    }, 0)
  )

  const playerNW = player.netWorthHistory.at(-1)?.value ?? player.gold
  const allGuilds = [
    { id: 'player' as const, name: 'Toi', color: player.color, nw: playerNW, gold: player.gold },
    ...rivals.map(r => ({
      id: r.id as GuildId,
      name: r.name,
      color: r.color,
      nw:   r.netWorthHistory.at(-1)?.value ?? r.gold,
      gold: r.gold,
    })),
  ].sort((a, b) => b.nw - a.nw)

  const topNW = Math.max(...allGuilds.map(g => g.nw), 1)

  const inventorySlots = [
    { id: 'wood',   icon: '🪵', qty: player.inventory.wood   ?? 0, price: market.resources.wood.currentPrice,   color: '#5a9e6a' },
    { id: 'olive',  icon: '🫒', qty: player.inventory.olive  ?? 0, price: market.resources.olive.currentPrice,  color: '#8bc34a' },
    { id: 'meuble', icon: '🪑', qty: player.inventory.meuble ?? 0, price: market.resources.meuble.currentPrice, color: '#b07ec8' },
    { id: 'huile',  icon: '🫙', qty: player.inventory.huile  ?? 0, price: market.resources.huile.currentPrice,  color: '#e8c069' },
  ].filter(e => e.qty > 0)

  const tickPct = ((tickOfDay ?? 0) / 30) * 100

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          14,
      padding:      '8px 20px',
      background:   'linear-gradient(180deg, #112135 0%, #0c1827 100%)',
      borderBottom: '1px solid var(--edge)',
      flexShrink:   0,
      minHeight:    'var(--hud-height)',
    }}>

      {/* ── Day + tick ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 50 }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '0.52rem', color: 'var(--text-muted)',
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>
          Jour
        </span>
        <span style={{ fontFamily: 'var(--font-num)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--accent)', lineHeight: 1.1 }}>
          {day}
        </span>
        <div style={{ height: 2, width: 40, background: 'var(--edge-soft)', borderRadius: 1, overflow: 'hidden', marginTop: 2 }}>
          <div style={{
            height: '100%', width: `${tickPct}%`,
            background: 'linear-gradient(90deg, var(--blue), var(--accent))',
            borderRadius: 1, transition: 'width 0.2s linear',
          }} />
        </div>
      </div>

      <div style={{ width: 1, height: 40, background: 'var(--edge)' }} />

      {/* ── Gold ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: '1.7rem', fontFamily: 'var(--font-num)', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
            {formatGold(player.gold)}
          </span>
          <span style={{ color: 'var(--accent-dim)', fontSize: '0.75rem', fontFamily: 'var(--font-ui)' }}>or</span>
        </div>
        {passiveIncome > 0 ? (
          <div style={{ fontSize: '0.60rem', color: 'var(--success)', fontFamily: 'var(--font-num)', letterSpacing: '0.02em' }}>
            +{passiveIncome}/j
          </div>
        ) : (
          <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'var(--font-num)' }}>
            {tickOfDay ?? 0}/30
          </div>
        )}
      </div>

      {/* ── Inventory chips ── */}
      {inventorySlots.length > 0 && (
        <>
          <div style={{ width: 1, height: 40, background: 'var(--edge)' }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {inventorySlots.map(e => (
              <div key={e.id} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '4px 8px',
                background: 'var(--bg-card)',
                borderRadius: 7,
                border: '1px solid var(--edge-soft)',
              }}>
                <span style={{ fontSize: '0.85rem', lineHeight: 1.3 }}>{e.icon}</span>
                <span style={{ fontFamily: 'var(--font-num)', fontSize: '0.72rem', color: e.color, fontWeight: 600, lineHeight: 1 }}>
                  {e.qty}
                </span>
                <span style={{ fontFamily: 'var(--font-num)', fontSize: '0.52rem', color: 'var(--text-muted)', lineHeight: 1 }}>
                  {e.price.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* ── Richesse nette ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
        <div style={{
          fontSize: '0.52rem', color: 'var(--accent-dim)',
          fontFamily: 'var(--font-ui)', letterSpacing: '0.18em',
          textTransform: 'uppercase', marginBottom: 1,
        }}>
          Richesse nette
        </div>

        {allGuilds.slice(0, 4).map((g, i) => {
          const pct      = Math.round((g.nw / topNW) * 100)
          const isPlayer = g.id === 'player'
          const isActive = isPlayer || !!rivalStrategies[g.id]
          const barColor = isActive ? g.color : 'rgba(70,96,125,0.4)'
          const nameColor= isActive ? g.color : 'var(--text-muted)'

          return (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i === 0
                ? <span style={{ fontSize: '0.58rem', width: 14, textAlign: 'center' }}>🏆</span>
                : <span style={{ width: 14 }} />
              }
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '0.62rem',
                color: nameColor, minWidth: 30,
                fontWeight: isPlayer ? 600 : 400,
              }}>
                {g.id === 'player' ? 'Toi' : g.name}
              </span>
              <div style={{ flex: 1, height: 5, background: 'var(--edge-soft)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: barColor, borderRadius: 3,
                  opacity: isPlayer ? 1 : 0.80,
                  transition: 'width 0.5s ease',
                  boxShadow: isPlayer ? `0 0 8px ${g.color}50` : 'none',
                }} />
              </div>
              <span style={{
                fontFamily: 'var(--font-num)', fontSize: '0.60rem',
                color: isActive ? 'var(--text-dim)' : 'var(--text-muted)',
                minWidth: 38, textAlign: 'right',
              }}>
                {formatGold(g.nw)}g
              </span>
            </div>
          )
        })}
      </div>

    </div>
  )
}
