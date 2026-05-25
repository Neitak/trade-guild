import type { GameState, GameEvent } from '../engine/types'

interface Props {
  state: GameState
  onEndDay: () => void
}

export function EndOfDay({ state, onEndDay }: Props) {
  // Events from the last completed day
  const lastDay = state.day
  const todayEvents = state.log.filter(e => e.day === lastDay && e.actor !== 'system')
  const newRumors = state.activeRumors.filter(r => r.day === lastDay)

  function describeEvent(e: GameEvent): string | null {
    switch (e.type) {
      case 'PRODUCTION':
        return `Votre ${e.payload.buildingId === 'orchard' ? 'verger' : 'marché'} a produit ${e.payload.qty} ${e.payload.resource === 'apple' ? '🍎' : ''}`
      case 'REVENUE':
        return `Votre marché a généré ${e.payload.gold} or`
      case 'BUY_BUILDING':
        if (e.actor === 'tex') return null // On garde ça pour les rumeurs
        return `Vous avez construit un ${e.payload.defId === 'orchard' ? 'Verger' : 'Marché aux Fruits'}`
      case 'WONDER_PROGRESS':
        if (e.actor === 'player') return `Vous avez apporté ${e.payload.contributed} pommes à la Tour de Magie (${e.payload.total}/${e.payload.required})`
        return null
      case 'WONDER_COMPLETE':
        if (e.actor === 'player') return `✦ Vous avez érigé la Tour de Magie !`
        return null
      default:
        return null
    }
  }

  const displayEvents = todayEvents.map(describeEvent).filter(Boolean) as string[]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Day summary */}
      {displayEvents.length > 0 && (
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-title)', letterSpacing: '0.06em' }}>
            JOURNÉE {lastDay}
          </div>
          {displayEvents.map((text, i) => (
            <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text)', display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--accent-dim)' }}>›</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      )}

      {/* New rumors */}
      {newRumors.length > 0 && (
        <div style={{
          background: 'rgba(201,168,76,0.06)',
          border: '1px solid var(--accent-dim)',
          borderRadius: 'var(--radius)',
          padding: '8px 12px',
          animation: 'fadeIn 0.4s ease',
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-dim)', marginBottom: 6, fontFamily: 'var(--font-title)', letterSpacing: '0.06em' }}>
            NOUVELLES RUMEURS
          </div>
          {newRumors.map((r, i) => (
            <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
              📜 {r.text}
            </div>
          ))}
        </div>
      )}

      {/* End day button */}
      <button
        className="btn-primary"
        style={{
          width: '100%',
          padding: '14px',
          fontSize: '1rem',
          letterSpacing: '0.1em',
        }}
        onClick={onEndDay}
      >
        Terminer cette journée →
      </button>
    </div>
  )
}
