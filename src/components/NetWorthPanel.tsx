import type { GameState, GuildId } from '../engine/types'

interface Props {
  state: GameState
}

function formatGold(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(1)}k`
  if (g >= 100)  return Math.round(g).toString()
  if (g >= 10)   return g.toFixed(1)
  return g.toFixed(2)
}

/**
 * V8 — Richesse nette, overlay flottant en haut à droite de la carte.
 * Extrait de l'ancien HUD ; conservé tel quel par décision de design.
 */
export function NetWorthPanel({ state }: Props) {
  const { player, rivals, rivalStrategies } = state

  const playerNW = player.netWorthHistory.at(-1)?.value ?? player.gold
  const allGuilds = [
    { id: 'player' as const, name: 'Toi', color: player.color, nw: playerNW },
    ...rivals.map(r => ({
      id: r.id as GuildId,
      name: r.name,
      color: r.color,
      nw: r.netWorthHistory.at(-1)?.value ?? r.gold,
    })),
  ].sort((a, b) => b.nw - a.nw)

  const topNW = Math.max(...allGuilds.map(g => g.nw), 1)

  return (
    <div
      style={{
        position: 'absolute', top: 'calc(var(--header-height) + 8px)', right: 8, zIndex: 30,
        display: 'flex', flexDirection: 'column', gap: 4,
        minWidth: 200, maxWidth: 240,
        padding: '8px 10px',
        background: 'rgba(8,16,26,0.78)',
        border: '1px solid var(--edge-soft)', borderRadius: 'var(--radius)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div style={{
        fontSize: '0.52rem', color: 'var(--accent-dim)', fontFamily: 'var(--font-ui)',
        letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 1,
      }}>
        Richesse nette
      </div>

      {allGuilds.slice(0, 4).map((g, i) => {
        const pct = Math.round((g.nw / topNW) * 100)
        const isPlayer = g.id === 'player'
        const isActive = isPlayer || !!rivalStrategies[g.id]
        const barColor = isActive ? g.color : 'rgba(70,96,125,0.4)'
        const nameColor = isActive ? g.color : 'var(--text-muted)'

        return (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.58rem', width: 13, textAlign: 'center' }}>{i === 0 ? '🏆' : ''}</span>
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '0.62rem', color: nameColor,
              minWidth: 28, fontWeight: isPlayer ? 600 : 400,
            }}>
              {isPlayer ? 'Toi' : g.name}
            </span>
            <div style={{ flex: 1, height: 5, background: 'var(--edge-soft)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3,
                opacity: isPlayer ? 1 : 0.8, transition: 'width 0.5s ease',
                boxShadow: isPlayer ? `0 0 8px ${g.color}50` : 'none',
              }} />
            </div>
            <span style={{
              fontFamily: 'var(--font-num)', fontSize: '0.6rem',
              color: isActive ? 'var(--text-dim)' : 'var(--text-muted)',
              minWidth: 36, textAlign: 'right',
            }}>
              {formatGold(g.nw)}g
            </span>
          </div>
        )
      })}
    </div>
  )
}
