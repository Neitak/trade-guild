import type { GameState } from '../engine/types'
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

/**
 * V8 — Header permanent flottant (largeur mobile).
 * Remplace l'ancien titre "SPOT MARKET". Contenu minimal : OR (principal) + Jour + barre du jour.
 * Reste visible même quand la modale Spot Market est ouverte en dessous.
 */
export function GameHeader({ state }: Props) {
  const { player, day, tickOfDay } = state

  const passiveIncome = Math.round(
    player.buildings.reduce((sum, b) => {
      const def = (buildingDefs as any[]).find(d => d.id === b.defId)
      if (!def?.revenuePerDay) return sum
      const level = b.level ?? 1
      const rev = def.upgradeRevenues
        ? (def.upgradeRevenues[String(level)] ?? def.revenuePerDay)
        : def.revenuePerDay
      return sum + rev * (b.shares / 100)
    }, 0)
  )

  const tickPct = ((tickOfDay ?? 0) / 30) * 100

  return (
    <header
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40,
        height: 'var(--header-height)',
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 16px',
        background: 'linear-gradient(180deg, rgba(14,27,44,0.92) 0%, rgba(8,16,26,0.78) 100%)',
        borderBottom: '1px solid var(--edge-soft)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      {/* ── OR (valeur principale) ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontFamily: 'var(--font-num)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
          {formatGold(player.gold)}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--accent-dim)' }}>or</span>
        {passiveIncome > 0 && (
          <span style={{ fontFamily: 'var(--font-num)', fontSize: '0.62rem', color: 'var(--success)', marginLeft: 2 }}>
            +{passiveIncome}/j
          </span>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* ── Jour (valeur secondaire) ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Jour
        </span>
        <span style={{ fontFamily: 'var(--font-num)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-dim)', lineHeight: 1 }}>
          {day}
        </span>
      </div>

      {/* ── Barre de progression du jour (existe déjà côté moteur : tickOfDay/30) ── */}
      <div style={{ width: 120, height: 5, background: 'var(--edge-soft)', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%', width: `${tickPct}%`,
            background: 'linear-gradient(90deg, var(--blue), var(--accent))',
            borderRadius: 3, transition: 'width 0.2s linear',
          }}
        />
      </div>
    </header>
  )
}
