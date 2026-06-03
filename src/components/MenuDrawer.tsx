import type { CSSProperties } from 'react'
import type { GameState } from '../engine/types'
import { casesOwnedBy } from '../engine/types'
import buildingDefs from '../data/buildings.json'

interface Props {
  state: GameState
  onClose: () => void
}

const BUILDING_NAMES: Record<string, string> = {
  sawmill: 'Bûcheron', olivery: 'Oliveraie', menuiserie: 'Menuiserie', press: 'Presse', auberge: 'Auberge',
}
const RESOURCE_ICONS: Record<string, string> = {
  wood: '🪵', olive: '🫒', meuble: '🪑', huile: '🫙', pierre: '🗿',
}

/**
 * V8 — Drawer "Menu" (footer). Accueille :
 *  - le résumé de production (déplacé de l'ancien panneau bas-gauche, pour libérer le bas mobile)
 *  - une section Guides/Règles en langage simple (toute mécanique à règle cachée y est expliquée)
 *  - réglages (placeholder)
 */
export function MenuDrawer({ state, onClose }: Props) {
  const { player } = state

  const productionLines = player.buildings.map(b => {
    const def = (buildingDefs as any[]).find(d => d.id === b.defId)
    const name = BUILDING_NAMES[b.defId] ?? b.defId
    const level = b.level ?? 1
    if (!def) return { key: b.instanceId, text: name }

    if (def.revenuePerDay) {
      const rev = def.upgradeRevenues ? (def.upgradeRevenues[String(level)] ?? def.revenuePerDay) : def.revenuePerDay
      return { key: b.instanceId, text: `${name} T${level}`, flow: `+${Math.round(rev * (casesOwnedBy(b, 'player') / 4))} or/j` }
    }
    const out = Math.round((def.productionPerDay ?? 0) * (casesOwnedBy(b, 'player') / 4))
    const outIcon = RESOURCE_ICONS[def.produces] ?? ''
    if (def.autoConsumeInput) {
      const inIcon = RESOURCE_ICONS[def.autoConsumeInput] ?? ''
      return { key: b.instanceId, text: `${name}`, flow: `${def.autoConsumeQty ?? 1}${inIcon} → ${out}${outIcon}/j` }
    }
    return { key: b.instanceId, text: `${name} T${level}`, flow: `+${out}${outIcon}/j` }
  })

  const RULES: { title: string; body: string }[] = [
    { title: 'Acheter beaucoup fait monter le prix',
      body: "Plus ton ordre est gros, plus il pousse le cours contre toi. Fractionne et choisis ton moment." },
    { title: 'Ce que tu produis est gratuit',
      body: "Le « Coût moyen » d'une carte = le prix moyen auquel TU as acquis ton stock. Ce que tes bâtiments produisent compte comme gratuit : toute vente est de la marge." },
    { title: 'Le triangle = la tendance de fond',
      body: "▲ le cours est au-dessus de sa moyenne longue, ▼ en dessous. Il filtre le bruit du tick à tick." },
  ]

  return (
    <div
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(3,7,12,0.55)', backdropFilter: 'blur(2px)' }}
    >
      <aside
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 'min(340px, 86vw)',
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(180deg, #112135 0%, #0c1827 100%)',
          borderLeft: '1px solid var(--edge)',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.5)',
          animation: 'drawerIn 0.22s ease',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--edge-soft)' }}>
          <span style={{ fontFamily: 'var(--font-title)', fontSize: '0.95rem', color: 'var(--accent)' }}>Menu</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        </div>

        {/* ── Résumé de production ── */}
        <section style={{ padding: '12px 16px' }}>
          <h3 style={sectionTitle}>Ta production</h3>
          {productionLines.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Aucun bâtiment encore. Construis-en sur la carte.
            </p>
          ) : (
            productionLines.map(l => (
              <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid var(--edge-soft)' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>{l.text}</span>
                {l.flow && <span style={{ fontFamily: 'var(--font-num)', fontSize: '0.74rem', color: 'var(--success)' }}>{l.flow}</span>}
              </div>
            ))
          )}
        </section>

        {/* ── Guides / Règles ── */}
        <section style={{ padding: '12px 16px' }}>
          <h3 style={sectionTitle}>Comment ça marche</h3>
          {RULES.map(r => (
            <div key={r.title} style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.76rem', color: 'var(--accent)', marginBottom: 2 }}>{r.title}</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>{r.body}</div>
            </div>
          ))}
        </section>
      </aside>
    </div>
  )
}

const sectionTitle: CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: '0.56rem', color: 'var(--accent-dim)',
  letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8,
}
