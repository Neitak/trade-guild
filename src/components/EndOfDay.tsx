import type { GameState, GameEvent } from '../engine/types'

interface Props {
  state: GameState
  onEndDay: () => void
}

export function EndOfDay({ state, onEndDay }: Props) {
  const lastDay = state.day
  const todayEvents = state.log.filter(e => e.day === lastDay && e.actor !== 'system')
  const newRumors = state.activeRumors.filter(r => r.day === lastDay)

  function describePlayerEvent(e: GameEvent): string | null {
    if (e.actor !== 'player') return null
    switch (e.type) {
      case 'PRODUCTION':
        return `Votre ${e.payload.buildingId === 'orchard' ? 'verger' : 'marché'} a produit ${e.payload.qty} ${e.payload.resource === 'apple' ? '🍎' : ''}`
      case 'REVENUE':
        return `Votre marché a généré ${e.payload.gold} or`
      case 'BUY_BUILDING':
        return `Vous avez construit un ${e.payload.defId === 'orchard' ? 'Verger' : 'Marché aux Fruits'}`
      case 'SELL':
        return `Vous avez vendu ${e.payload.qty} pommes → +${Math.floor(e.payload.gold as number)} or`
      case 'BUY':
        return `Vous avez acheté ${e.payload.qty} pommes`
      case 'BUY_SHARE': {
        const shares = e.payload.playerTotalShares as number
        const building = e.payload.defId === 'orchard' ? 'verger' : 'marché'
        const ctrl = shares >= 51 ? ' — CONTRÔLE ACQUIS !' : ''
        return `Vous détenez ${shares}% du ${building} de Tex (coût : ${e.payload.cost} or)${ctrl}`
      }
      case 'WONDER_PROGRESS':
        return `Vous avez apporté ${e.payload.contributed} pommes à la Tour de Magie (${e.payload.total}/${e.payload.required})`
      case 'WONDER_COMPLETE':
        return `✦ Vous avez érigé la Tour de Magie !`
      default:
        return null
    }
  }

  function describeTexEvent(e: GameEvent): string | null {
    if (e.actor !== 'tex') return null
    switch (e.type) {
      case 'SELL':
        return `Tex a vendu ${e.payload.qty} pommes sur le marché — prix en baisse`
      case 'BUY':
        return `Tex a acheté ${e.payload.qty} pommes — il accumule`
      case 'SELL_SHARE': {
        const building = e.payload.defId === 'orchard' ? 'verger' : 'marché'
        return `Tex a racheté ${e.payload.transferredShares}% de son ${building} — il contre-attaque`
      }
      case 'WONDER_PROGRESS':
        return `Tex a apporté ${e.payload.contributed} pommes à la Tour (${e.payload.total}/${e.payload.required}) !`
      case 'WONDER_COMPLETE':
        return `✦ Tex a érigé la Tour de Magie — vous avez perdu.`
      default:
        return null
    }
  }

  const playerEvents = todayEvents.map(describePlayerEvent).filter(Boolean) as string[]
  const texEvents = todayEvents.map(describeTexEvent).filter(Boolean) as string[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Scrollable log — capped so it never crushes the panels above */}
      {(playerEvents.length > 0 || texEvents.length > 0 || newRumors.length > 0) && (
        <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Day summary */}
          {(playerEvents.length > 0 || texEvents.length > 0) && (
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-title)', letterSpacing: '0.06em' }}>
                JOURNÉE {lastDay}
              </div>
              {playerEvents.map((text, i) => (
                <div key={`p${i}`} style={{ fontSize: '0.82rem', color: 'var(--text)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--accent-dim)' }}>›</span>
                  <span>{text}</span>
                </div>
              ))}
              {texEvents.map((text, i) => (
                <div key={`t${i}`} style={{ fontSize: '0.82rem', color: 'var(--tex-color)', display: 'flex', gap: 8 }}>
                  <span>⚔</span>
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
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-dim)', marginBottom: 4, fontFamily: 'var(--font-title)', letterSpacing: '0.06em' }}>
                NOUVELLES RUMEURS
              </div>
              {newRumors.map((r, i) => (
                <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  📜 {r.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* End day button — always visible */}
      <button
        className="btn-primary"
        style={{ width: '100%', padding: '14px', fontSize: '1rem', letterSpacing: '0.1em' }}
        onClick={onEndDay}
      >
        Terminer cette journée →
      </button>
    </div>
  )
}
