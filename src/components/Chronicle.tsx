import type { ChronicleResult } from '../engine/chronicle'

interface Props {
  chronicle: ChronicleResult
  won: boolean
  days: number
  onNewGame: () => void
}

const ARCHETYPE_ICONS: Record<string, string> = {
  investor: '🏛️',
  trader: '⚖️',
  manipulator: '🗡️',
  mixed: '🎲',
}

const ARCHETYPE_LABELS: Record<string, string> = {
  investor: 'Investisseur',
  trader: 'Négociant',
  manipulator: 'Manipulateur',
  mixed: 'Polyvalent',
}

export function Chronicle({ chronicle, won, days, onNewGame }: Props) {
  const accentColor = won ? 'var(--accent)' : 'var(--tex-color)'
  const accentDim   = won ? 'var(--accent-dim)' : '#c96060'

  const worthDiff = chronicle.finalPlayerWorth - chronicle.finalTexWorth
  const worthDiffLabel = worthDiff > 0 ? `+${worthDiff}` : String(worthDiff)

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(10, 10, 24, 0.96)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      animation: 'fadeIn 0.5s ease',
    }}>
      <div style={{
        maxWidth: 560,
        width: '92%',
        background: 'var(--bg-panel)',
        border: `2px solid ${accentColor}`,
        borderRadius: 12,
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        boxShadow: won
          ? '0 0 80px rgba(201,168,76,0.18)'
          : '0 0 80px rgba(201,76,76,0.18)',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>

        {/* Result header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.8rem', marginBottom: 6 }}>{won ? '⚜️' : '💀'}</div>
          <div style={{
            fontFamily: 'var(--font-title)',
            fontSize: '0.7rem',
            color: accentDim,
            letterSpacing: '0.18em',
            marginBottom: 8,
          }}>
            {won ? 'VICTOIRE' : 'DÉFAITE'} — JOUR {days}
            {chronicle.completedWonder && (
              <span style={{ marginLeft: 12, opacity: 0.7 }}>
                · {chronicle.completedWonder}
              </span>
            )}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-title)',
            fontSize: '1.35rem',
            color: accentColor,
            lineHeight: 1.3,
          }}>
            {chronicle.title}
          </h1>
        </div>

        {/* Fortune finale */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 8,
            padding: '10px 14px',
            border: '1px solid var(--player-color)',
          }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--player-color)', fontFamily: 'var(--font-title)', letterSpacing: '0.08em', marginBottom: 4 }}>
              TOI — FORTUNE FINALE
            </div>
            <div style={{ fontSize: '1.4rem', fontFamily: 'var(--font-title)', color: 'var(--accent)', lineHeight: 1 }}>
              {chronicle.finalPlayerWorth}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
              or (valeur nette)
            </div>
          </div>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 8,
            padding: '10px 14px',
            border: '1px solid var(--tex-color)',
          }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--tex-color)', fontFamily: 'var(--font-title)', letterSpacing: '0.08em', marginBottom: 4 }}>
              TEX — FORTUNE FINALE
            </div>
            <div style={{ fontSize: '1.4rem', fontFamily: 'var(--font-title)', color: 'var(--tex-color)', lineHeight: 1 }}>
              {chronicle.finalTexWorth}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
              or (valeur nette) · écart : {worthDiffLabel}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* The bard speaks */}
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-title)', letterSpacing: '0.1em', marginBottom: 12 }}>
            LE BARDE RACONTE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chronicle.moments.map((moment, i) => (
              <p key={i} style={{
                fontSize: '0.86rem',
                color: 'var(--text-dim)',
                fontStyle: 'italic',
                lineHeight: 1.65,
                paddingLeft: 14,
                borderLeft: `2px solid ${i === 0 ? accentColor : 'var(--accent-dim)'}`,
                margin: 0,
                opacity: i === 0 ? 1 : 0.85,
              }}>
                {moment}
              </p>
            ))}
          </div>
        </div>

        {/* Advice */}
        <div style={{
          background: 'var(--accent-glow)',
          border: `1px solid ${accentColor}`,
          borderRadius: 8,
          padding: '12px 16px',
        }}>
          <div style={{ fontSize: '0.65rem', color: accentColor, fontFamily: 'var(--font-title)', letterSpacing: '0.1em', marginBottom: 6 }}>
            CONSEIL POUR LA PROCHAINE PARTIE
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>
            {chronicle.advice}
          </p>
        </div>

        {/* Archetype */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          background: 'var(--bg-card)',
          borderRadius: 8,
          fontSize: '0.8rem',
        }}>
          <span style={{ fontSize: '1.2rem' }}>{ARCHETYPE_ICONS[chronicle.archetype]}</span>
          <span style={{ color: 'var(--text-muted)' }}>Archétype joué :</span>
          <span style={{ color: 'var(--accent-dim)', fontFamily: 'var(--font-title)', fontWeight: 600 }}>
            {ARCHETYPE_LABELS[chronicle.archetype]}
          </span>
        </div>

        {/* New game */}
        <button
          className="btn-primary"
          style={{ width: '100%', padding: 14, fontSize: '1rem', letterSpacing: '0.1em' }}
          onClick={onNewGame}
        >
          Nouvelle Partie →
        </button>
      </div>
    </div>
  )
}
