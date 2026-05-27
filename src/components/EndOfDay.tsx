import type { GameEvent } from '../engine/types'

interface Props {
  completedDay: number
  nextDay: number
  events: GameEvent[]
  goldBefore: number
  goldAfter: number
  rumors: string[]
  onDismiss: () => void
}

const BUILDING_NAMES: Record<string, string> = {
  orchard: 'Verger', fruit_market: 'Marché aux Fruits',
  sawmill: 'Scierie', menuiserie: 'Menuiserie',
}
const RESOURCE_ICONS: Record<string, string> = { apple: '🍎', wood: '🪵' }

function describePlayer(e: GameEvent): string | null {
  if (e.actor !== 'player') return null
  switch (e.type) {
    case 'PRODUCTION': {
      const b = BUILDING_NAMES[e.payload.buildingId as string] ?? String(e.payload.buildingId)
      const icon = RESOURCE_ICONS[e.payload.resource as string] ?? ''
      return `${b} a produit ${e.payload.qty} ${icon}`
    }
    case 'REVENUE': {
      const b = BUILDING_NAMES[e.payload.buildingId as string] ?? String(e.payload.buildingId)
      return `${b} a généré ${e.payload.gold} or`
    }
    case 'BUY_BUILDING': {
      const b = BUILDING_NAMES[e.payload.defId as string] ?? String(e.payload.defId)
      return `Vous avez construit : ${b}`
    }
    case 'SELL': {
      const icon = RESOURCE_ICONS[e.payload.resourceId as string] ?? ''
      return `Vous avez vendu ${e.payload.qty} ${icon} → +${Math.floor(e.payload.gold as number)} or`
    }
    case 'BUY': {
      const icon = RESOURCE_ICONS[e.payload.resourceId as string] ?? ''
      return `Vous avez acheté ${e.payload.qty} ${icon}`
    }
    case 'BUY_SHARE': {
      const b = BUILDING_NAMES[e.payload.defId as string] ?? String(e.payload.defId)
      const ctrl = (e.payload.playerTotalShares as number) >= 51 ? ' — CONTRÔLE ACQUIS !' : ''
      return `Vous détenez ${e.payload.playerTotalShares}% de la ${b} de Tex${ctrl}`
    }
    case 'WONDER_PROGRESS': {
      const wName = e.payload.wonderId === 'grande_cathedrale' ? 'Grande Cathédrale' : 'Tour de Magie'
      const icon  = RESOURCE_ICONS[e.payload.resourceId as string] ?? ''
      return `Apport de ${e.payload.contributed} ${icon} à la ${wName} (${e.payload.total}/${e.payload.required})`
    }
    case 'WONDER_COMPLETE': {
      const wName = e.payload.wonderId === 'grande_cathedrale' ? 'Grande Cathédrale' : 'Tour de Magie'
      return `✦ Vous avez érigé la ${wName} !`
    }
    default: return null
  }
}

const RIVAL_NAMES: Record<string, string> = { tex: 'Tex', sam: 'Sam', rita: 'Rita' }

function describeRival(e: GameEvent): string | null {
  if (e.actor === 'player' || e.actor === 'system') return null
  const name = RIVAL_NAMES[e.actor] ?? e.actor
  switch (e.type) {
    case 'BUY': {
      const icon = RESOURCE_ICONS[e.payload.resourceId as string] ?? ''
      return `${name} achète ${e.payload.qty} ${icon} — il accumule`
    }
    case 'SELL': {
      const icon = RESOURCE_ICONS[e.payload.resourceId as string] ?? ''
      return `${name} vend ${e.payload.qty} ${icon} — prix en baisse`
    }
    case 'BUY_BUILDING': {
      const b = BUILDING_NAMES[e.payload.defId as string] ?? String(e.payload.defId)
      return `${name} construit une ${b}`
    }
    case 'SELL_SHARE': {
      const b = BUILDING_NAMES[e.payload.defId as string] ?? String(e.payload.defId)
      return `${name} rachète ${e.payload.transferredShares}% de sa ${b} — contre-attaque`
    }
    case 'WONDER_PROGRESS': {
      const wName = e.payload.wonderId === 'grande_cathedrale' ? 'Grande Cathédrale' : 'Tour de Magie'
      const icon  = RESOURCE_ICONS[e.payload.resourceId as string] ?? ''
      return `${name} apporte ${e.payload.contributed} ${icon} à la ${wName} (${e.payload.total}/${e.payload.required})`
    }
    case 'WONDER_COMPLETE': {
      const wName = e.payload.wonderId === 'grande_cathedrale' ? 'Grande Cathédrale' : 'Tour de Magie'
      return `✦ ${name} érige la ${wName}.`
    }
    default: return null
  }
}

export function EndOfDay({ completedDay, nextDay, events, goldBefore, goldAfter, rumors, onDismiss }: Props) {
  const goldDelta    = goldAfter - goldBefore
  const isPositive   = goldDelta >= 0
  const deltaColor   = goldDelta > 0.5 ? 'var(--success)' : goldDelta < -0.5 ? 'var(--danger)' : 'var(--text-muted)'

  const playerLines = events.map(describePlayer).filter(Boolean) as string[]
  const rivalLines  = events.map(describeRival).filter(Boolean) as string[]
  const hasWonderWin  = events.some(e => e.type === 'WONDER_COMPLETE' && e.actor === 'player')
  const hasWonderLoss = events.some(e => e.type === 'WONDER_COMPLETE' && e.actor !== 'player' && e.actor !== 'system')

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(4,4,14,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200,
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: 'var(--bg-panel)',
        border: `1px solid ${hasWonderWin ? 'var(--accent)' : hasWonderLoss ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '28px 32px',
        maxWidth: 500,
        width: '90%',
        maxHeight: '82vh',
        overflowY: 'auto',
        boxShadow: '0 8px 60px rgba(0,0,0,0.7)',
        animation: 'slideUp 0.25s ease',
      }} className="scrollable">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.14em', marginBottom: 6 }}>
            BILAN DE LA JOURNÉE
          </div>
          <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.6rem', color: 'var(--accent)', lineHeight: 1 }}>
            Jour {completedDay}
          </div>
        </div>

        {/* Gold delta */}
        <div style={{
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 20,
          border: `1px solid ${isPositive ? 'rgba(76,175,106,0.25)' : 'rgba(180,60,60,0.25)'}`,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.2rem', color: deltaColor, lineHeight: 1, marginBottom: 4 }}>
            {isPositive ? '+' : ''}{Math.floor(goldDelta)} or
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {Math.floor(goldBefore)} → {Math.floor(goldAfter)} or
          </div>
        </div>

        {/* Player events */}
        {playerLines.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>
              VOS ACTIONS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {playerLines.map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: '0.85rem', color: 'var(--text)' }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>›</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rival events */}
        {rivalLines.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>
              RIVAUX AUJOURD'HUI
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rivalLines.map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: '0.85rem', color: 'var(--tex-color)' }}>
                  <span style={{ flexShrink: 0 }}>⚔</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New rumors */}
        {rumors.length > 0 && (
          <div style={{
            background: 'rgba(201,168,76,0.06)',
            border: '1px solid var(--accent-dim)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
          }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.68rem', color: 'var(--accent-dim)', letterSpacing: '0.1em', marginBottom: 6 }}>
              NOUVELLES RUMEURS
            </div>
            {rumors.map((r, i) => (
              <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.5 }}>
                📜 {r}
              </div>
            ))}
          </div>
        )}

        {/* Empty day */}
        {playerLines.length === 0 && rivalLines.length === 0 && rumors.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic', marginBottom: 16 }}>
            Une journée calme.
          </div>
        )}

        {/* Next day button */}
        <button
          className="btn-primary"
          style={{ width: '100%', padding: '13px', fontSize: '1rem', letterSpacing: '0.08em', marginTop: 4 }}
          onClick={onDismiss}
        >
          Commencer le Jour {nextDay} →
        </button>
      </div>
    </div>
  )
}
