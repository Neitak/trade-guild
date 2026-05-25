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
    const buildingNames: Record<string, string> = { orchard: 'Verger', fruit_market: 'Marché aux Fruits', sawmill: 'Scierie', menuiserie: 'Menuiserie' }
    const resourceIcons: Record<string, string> = { apple: '🍎', wood: '🪵' }
    switch (e.type) {
      case 'PRODUCTION': {
        const bName = buildingNames[e.payload.buildingId as string] ?? String(e.payload.buildingId)
        const icon  = resourceIcons[e.payload.resource as string] ?? ''
        return `Votre ${bName} a produit ${e.payload.qty} ${icon}`
      }
      case 'REVENUE': {
        const bName = buildingNames[e.payload.buildingId as string] ?? String(e.payload.buildingId)
        return `Votre ${bName} a généré ${e.payload.gold} or`
      }
      case 'BUY_BUILDING': {
        const bName = buildingNames[e.payload.defId as string] ?? String(e.payload.defId)
        return `Vous avez construit : ${bName}`
      }
      case 'SELL': {
        const icon = resourceIcons[e.payload.resourceId as string] ?? ''
        return `Vous avez vendu ${e.payload.qty} ${icon} → +${Math.floor(e.payload.gold as number)} or`
      }
      case 'BUY': {
        const icon = resourceIcons[e.payload.resourceId as string] ?? ''
        return `Vous avez acheté ${e.payload.qty} ${icon}`
      }
      case 'BUY_SHARE': {
        const shares = e.payload.playerTotalShares as number
        const bName  = buildingNames[e.payload.defId as string] ?? String(e.payload.defId)
        const ctrl   = shares >= 51 ? ' — CONTRÔLE ACQUIS !' : ''
        return `Vous détenez ${shares}% de la ${bName} de Tex (coût : ${e.payload.cost} or)${ctrl}`
      }
      case 'WONDER_PROGRESS': {
        const wName = e.payload.wonderId === 'grande_cathedrale' ? 'Grande Cathédrale' : 'Tour de Magie'
        const icon  = resourceIcons[e.payload.resourceId as string] ?? ''
        return `Vous avez apporté ${e.payload.contributed} ${icon} à la ${wName} (${e.payload.total}/${e.payload.required})`
      }
      case 'WONDER_COMPLETE': {
        const wName = e.payload.wonderId === 'grande_cathedrale' ? 'Grande Cathédrale' : 'Tour de Magie'
        return `✦ Vous avez érigé la ${wName} !`
      }
      default:
        return null
    }
  }

  function describeTexEvent(e: GameEvent): string | null {
    if (e.actor !== 'tex') return null
    switch (e.type) {
      case 'SELL': {
        const icon = e.payload.resourceId === 'wood' ? '🪵' : '🍎'
        return `Tex a vendu ${e.payload.qty} ${icon} sur le marché — prix en baisse`
      }
      case 'BUY': {
        const icon = e.payload.resourceId === 'wood' ? '🪵' : '🍎'
        return `Tex a acheté ${e.payload.qty} ${icon} — il accumule`
      }
      case 'SELL_SHARE': {
        const buildingNames: Record<string, string> = { orchard: 'Verger', fruit_market: 'Marché aux Fruits', sawmill: 'Scierie', menuiserie: 'Menuiserie' }
        const bName = buildingNames[e.payload.defId as string] ?? String(e.payload.defId)
        return `Tex a racheté ${e.payload.transferredShares}% de sa ${bName} — il contre-attaque`
      }
      case 'WONDER_PROGRESS': {
        const wName = e.payload.wonderId === 'grande_cathedrale' ? 'Grande Cathédrale' : 'Tour de Magie'
        const icon  = e.payload.resourceId === 'wood' ? '🪵' : '🍎'
        return `Tex a apporté ${e.payload.contributed} ${icon} à la ${wName} (${e.payload.total}/${e.payload.required}) !`
      }
      case 'WONDER_COMPLETE': {
        const wName = e.payload.wonderId === 'grande_cathedrale' ? 'Grande Cathédrale' : 'Tour de Magie'
        return `✦ Tex a érigé la ${wName} — vous avez perdu.`
      }
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
