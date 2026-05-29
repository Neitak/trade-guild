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

  // ─── Passive income from all buildings (Menuiserie, Auberge…) ───────────────
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

  // ─── Net worth (gold + inventory at market price, per history snapshot) ────
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

  // ─── Non-zero inventory to display ──────────────────────────────────────────
  const inventorySlots = [
    { id: 'wood',   icon: '🪵', qty: player.inventory.wood   ?? 0, price: market.resources.wood.currentPrice,   color: '#5a9e6a' },
    { id: 'olive',  icon: '🫒', qty: player.inventory.olive  ?? 0, price: market.resources.olive.currentPrice,  color: '#8bc34a' },
    { id: 'meuble', icon: '🪑', qty: player.inventory.meuble ?? 0, price: market.resources.meuble.currentPrice, color: '#b07ec8' },
    { id: 'huile',  icon: '🫙', qty: player.inventory.huile  ?? 0, price: market.resources.huile.currentPrice,  color: '#c9a84c' },
  ].filter(e => e.qty > 0)

  const tickPct = ((tickOfDay ?? 0) / 30) * 100

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      gap:            14,
      padding:        '6px 18px',
      background:     'var(--bg-panel)',
      borderBottom:   '1px solid var(--border)',
      flexShrink:     0,
      minHeight:      52,
    }}>

      {/* ── Day + tick progress ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Jour
        </span>
        <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', color: 'var(--accent)', lineHeight: 1.1 }}>
          {day}
        </span>
        <div style={{ height: 2, width: 36, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${tickPct}%`,
            background: 'var(--accent)', borderRadius: 1,
            transition: 'width 0.2s linear',
          }} />
        </div>
      </div>

      <div style={{ width: 1, height: 36, background: 'var(--border)' }} />

      {/* ── Gold + passive income ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: '1.65rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--accent)', lineHeight: 1 }}>
            {formatGold(player.gold)}
          </span>
          <span style={{ color: 'var(--accent-dim)', fontSize: '0.75rem' }}>or</span>
        </div>
        {passiveIncome > 0 ? (
          <div style={{ fontSize: '0.62rem', color: 'var(--success)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            +{passiveIncome}/j
          </div>
        ) : (
          <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {tickOfDay ?? 0}/30
          </div>
        )}
      </div>

      {/* ── Inventory chips (non-zero only) ── */}
      {inventorySlots.length > 0 && (
        <>
          <div style={{ width: 1, height: 36, background: 'var(--border)' }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {inventorySlots.map(e => (
              <div key={e.id} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '3px 7px',
                background: 'rgba(255,255,255,0.025)',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <span style={{ fontSize: '0.85rem', lineHeight: 1.3 }}>{e.icon}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: e.color, fontWeight: 500, lineHeight: 1 }}>
                  {e.qty}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--text-muted)', lineHeight: 1 }}>
                  {e.price.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* ── Richesse nette — classement visuel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 210 }}>
        <div style={{
          fontSize: '0.55rem', color: 'var(--accent-dim)',
          fontFamily: 'var(--font-ui)', letterSpacing: '0.12em',
          textTransform: 'uppercase', marginBottom: 1,
        }}>
          Richesse nette
        </div>

        {allGuilds.slice(0, 4).map((g, i) => {
          const pct      = Math.round((g.nw / topNW) * 100)
          const isPlayer = g.id === 'player'
          const isActive = isPlayer || !!rivalStrategies[g.id]
          const barColor = isActive ? g.color : 'rgba(90,80,110,0.4)'
          const nameColor= isActive ? g.color : 'var(--text-muted)'

          return (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {i === 0
                ? <span style={{ fontSize: '0.58rem', width: 14, textAlign: 'center' }}>🏆</span>
                : <span style={{ width: 14 }} />
              }
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.63rem',
                color: nameColor, minWidth: 30,
                fontWeight: isPlayer ? 600 : 400,
              }}>
                {g.id === 'player' ? 'Toi' : g.name}
              </span>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: barColor, borderRadius: 2,
                  opacity: isPlayer ? 1 : 0.75,
                  transition: 'width 0.5s ease',
                  boxShadow: isPlayer ? `0 0 6px ${g.color}60` : 'none',
                }} />
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.60rem',
                color: isActive ? 'var(--text-dim)' : 'var(--text-muted)',
                minWidth: 36, textAlign: 'right',
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
