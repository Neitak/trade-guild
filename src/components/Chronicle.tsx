import type { ChronicleResult } from '../engine/chronicle'

interface Props {
  chronicle: ChronicleResult
  won: boolean
  days: number
  onNewGame: () => void
}

export function Chronicle({ chronicle, won, days, onNewGame }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(10, 10, 24, 0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      animation: 'fadeIn 0.5s ease',
    }}>
      <div style={{
        maxWidth: 520,
        width: '90%',
        background: 'var(--bg-panel)',
        border: `2px solid ${won ? 'var(--accent)' : 'var(--tex-color)'}`,
        borderRadius: 12,
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        boxShadow: won
          ? '0 0 60px rgba(201,168,76,0.2)'
          : '0 0 60px rgba(201,76,76,0.2)',
      }}>
        {/* Result */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{won ? '⚜️' : '💀'}</div>
          <div style={{
            fontFamily: 'var(--font-title)',
            fontSize: '0.75rem',
            color: won ? 'var(--accent-dim)' : 'var(--tex-color)',
            letterSpacing: '0.15em',
            marginBottom: 8,
          }}>
            {won ? 'VICTOIRE' : 'DÉFAITE'} — JOUR {days}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-title)',
            fontSize: '1.4rem',
            color: won ? 'var(--accent)' : 'var(--text)',
            lineHeight: 1.3,
          }}>
            {chronicle.title}
          </h1>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* The bard speaks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-title)', letterSpacing: '0.08em' }}>
            LE BARDE RACONTE
          </div>
          {chronicle.moments.map((moment, i) => (
            <p key={i} style={{
              fontSize: '0.88rem',
              color: 'var(--text-dim)',
              fontStyle: 'italic',
              lineHeight: 1.6,
              paddingLeft: 12,
              borderLeft: '2px solid var(--accent-dim)',
            }}>
              {moment}
            </p>
          ))}
        </div>

        {/* Advice */}
        <div style={{
          background: 'var(--accent-glow)',
          border: '1px solid var(--accent)',
          borderRadius: 8,
          padding: '12px 16px',
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontFamily: 'var(--font-title)', letterSpacing: '0.08em', marginBottom: 6 }}>
            CONSEIL POUR LA PROCHAINE PARTIE
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.6 }}>
            {chronicle.advice}
          </p>
        </div>

        {/* Archetype */}
        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Archétype joué : <span style={{ color: 'var(--accent-dim)', fontFamily: 'var(--font-title)' }}>
            {{ investor: 'Investisseur', trader: 'Négociant', manipulator: 'Manipulateur', mixed: 'Polyvalent' }[chronicle.archetype]}
          </span>
        </div>

        {/* New game */}
        <button className="btn-primary" style={{ width: '100%', padding: 14 }} onClick={onNewGame}>
          Nouvelle Partie
        </button>
      </div>
    </div>
  )
}
