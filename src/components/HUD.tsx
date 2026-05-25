import type { GameState } from '../engine/types'

interface Props {
  state: GameState
}

export function HUD({ state }: Props) {
  const { player, tex, day, wonder, market } = state
  const applePrice = market.resources.apple.currentPrice
  const playerApples = player.inventory.apple ?? 0
  const texApples = tex.inventory.apple ?? 0

  const playerContrib = wonder.playerContributed.apple ?? 0
  const texContrib = wonder.texContributed.apple ?? 0
  const required = wonder.requiredResources.apple ?? 800
  const playerPct = Math.round((playerContrib / required) * 100)
  const texPct = Math.round((texContrib / required) * 100)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      padding: '8px 20px',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Day counter */}
      <div style={{ fontFamily: 'var(--font-title)', fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
        JOUR <span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>{day}</span>
      </div>

      <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

      {/* Gold — biggest element */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: '1.8rem', fontFamily: 'var(--font-title)', fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>
          {Math.floor(player.gold)}
        </span>
        <span style={{ color: 'var(--accent-dim)', fontSize: '0.85rem' }}>or</span>
      </div>

      {/* Apple inventory */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: '1.1rem', fontFamily: 'var(--font-title)', color: 'var(--text)' }}>
          {playerApples}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>🍎</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({applePrice.toFixed(2)} or)</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Wonder race */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: '0.65rem', color: 'var(--accent-dim)', letterSpacing: '0.08em', textAlign: 'center' }}>
          TOUR DE MAGIE
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Player bar */}
          <span style={{ fontSize: '0.7rem', color: 'var(--player-color)', width: 20, textAlign: 'right' }}>{playerPct}%</span>
          <div style={{ flex: 1, height: 6, background: 'var(--bg-card)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${playerPct}%`,
              background: 'var(--player-color)',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ flex: 1, height: 6, background: 'var(--bg-card)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${texPct}%`,
              background: 'var(--tex-color)',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--tex-color)', width: 20 }}>{texPct}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          <span>Toi</span>
          <span>{playerContrib}/{required} pommes</span>
          <span>Tex</span>
        </div>
      </div>

      <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

      {/* Tex status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        <span>Tex : <span style={{ color: 'var(--tex-color)' }}>{Math.floor(tex.gold)} or</span></span>
        <span style={{ color: 'var(--text-muted)' }}>{texApples} 🍎</span>
      </div>
    </div>
  )
}
