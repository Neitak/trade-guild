export type FooterTab = 'market' | 'map' | 'menu'

interface Props {
  /** Vue active (modale ouverte = market, fermée = map). */
  view: 'market' | 'map'
  /** Le drawer Menu est-il ouvert ? */
  menuOpen: boolean
  onSelect: (tab: FooterTab) => void
}

const TABS: { id: FooterTab; label: string; glyph: string }[] = [
  { id: 'market', label: 'Market', glyph: '⚖' },
  { id: 'map',    label: 'Map',    glyph: '❖' },
  { id: 'menu',   label: 'Menu',   glyph: '☰' },
]

/**
 * V8 — Footer de navigation mobile-first.
 * Market = ouvre la modale Spot Market · Map = ferme la modale (carte seule) · Menu = drawer guides/réglages.
 */
export function Footer({ view, menuOpen, onSelect }: Props) {
  return (
    <nav
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
        height: 'var(--footer-height)',
        display: 'flex',
        background: 'linear-gradient(0deg, rgba(8,16,26,0.96) 0%, rgba(14,27,44,0.86) 100%)',
        borderTop: '1px solid var(--edge)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {TABS.map(tab => {
        const active = tab.id === 'menu' ? menuOpen : (!menuOpen && view === tab.id)
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              background: active ? 'rgba(232,192,105,0.08)' : 'transparent',
              border: 'none',
              borderTop: active ? '2px solid var(--accent)' : '2px solid transparent',
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              transition: 'color 0.15s ease, background 0.15s ease',
            }}
          >
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{tab.glyph}</span>
            <span style={{ fontSize: '0.62rem', letterSpacing: '0.08em' }}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
