import { useState, useEffect } from 'react'
import type { GameState, ResourceId, BuildingId, WonderId } from './engine/types'
import { initGame } from './engine/init'
import { contributeToWonder } from './engine/day'
import { resolveTick } from './engine/tick'
import { sellToMarket, buyFromMarket } from './engine/market'
import { buyBuilding, upgradeBuilding } from './engine/buildings'
import { buyShare } from './engine/shares'
import { generateChronicle } from './engine/chronicle'
import type { ChronicleResult } from './engine/chronicle'
import { GameHeader } from './components/GameHeader'
import { NetWorthPanel } from './components/NetWorthPanel'
import { Footer, type FooterTab } from './components/Footer'
import { MenuDrawer } from './components/MenuDrawer'
import { SpotMarket } from './components/SpotMarket'
import { WorldMap } from './components/WorldMap'
import { Chronicle } from './components/Chronicle'

export default function App() {
  const [state, setState] = useState<GameState>(() => initGame())
  const [chronicle, setChronicle] = useState<ChronicleResult | null>(null)
  // V8 shell — la modale Spot Market est OUVERTE par défaut (view='market').
  const [view, setView] = useState<'market' | 'map'>('market')
  const [menuOpen, setMenuOpen] = useState(false)

  // ─── Real-time tick engine (1s interval) ────────────────────────────────────
  useEffect(() => {
    if (state.phase !== 'playing') return
    const id = setInterval(() => {
      setState(prev => {
        if (prev.phase !== 'playing') return prev
        const next = resolveTick(prev)
        if (next.phase !== 'playing') {
          setChronicle(generateChronicle(next))
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [state.phase])

  // ─── Dev tools ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (window as any).__GAME_STATE__ = state
    ;(window as any).__DEV__ = {
      skipToPhase1: () => setState(prev => ({
        ...prev,
        player: { ...prev.player, inventory: { ...prev.player.inventory, wood: 10 } },
      })),
    }
  }, [state])

  // ─── Player actions ──────────────────────────────────────────────────────────
  function dispatch(updater: (s: GameState) => GameState) {
    setState(prev => {
      if (prev.phase !== 'playing') return prev
      return updater(prev)
    })
  }

  const handleSell = (resourceId: ResourceId, qty: number) => dispatch(s => sellToMarket(s, resourceId, qty))
  const handleBuy = (resourceId: ResourceId, qty: number) => dispatch(s => buyFromMarket(s, resourceId, qty))
  const handleContribute = (qty: number, wonderId: WonderId) => dispatch(s => contributeToWonder(s, qty, wonderId))
  const handleBuyBuilding = (defId: BuildingId) => dispatch(s => buyBuilding(s, defId))
  const handleUpgradeBuilding = (instanceId: string) => dispatch(s => upgradeBuilding(s, instanceId))
  const handleBuyShare = (instanceId: string) => dispatch(s => buyShare(s, instanceId))

  function handleNewGame() {
    setChronicle(null)
    setState(initGame())
  }

  function handleFooterSelect(tab: FooterTab) {
    if (tab === 'menu') { setMenuOpen(o => !o); return }
    setMenuOpen(false)
    setView(tab)
  }

  const won = state.phase === 'won'

  return (
    <div style={{
      position: 'relative',
      height: '100vh',
      overflow: 'hidden',
      background: 'radial-gradient(125% 120% at 50% -8%, #12243c 0%, #0c1828 46%, #060c15 100%), var(--bg)',
    }}>
      {/* ── World map — fond plein écran (entre header et footer) ── */}
      <div style={{
        position: 'absolute',
        top: 'var(--header-height)', bottom: 'var(--footer-height)', left: 0, right: 0,
        overflow: 'hidden',
      }}>
        <WorldMap
          state={state}
          onBuyBuilding={handleBuyBuilding}
          onBuyShare={handleBuyShare}
          onUpgradeBuilding={handleUpgradeBuilding}
        />
      </div>

      {/* ── Header permanent flottant ── */}
      <GameHeader state={state} />

      {/* ── Richesse nette — overlay haut-droite ── */}
      <NetWorthPanel state={state} />

      {/* ── Modale Spot Market — flottante à gauche, ouverte par défaut ── */}
      {view === 'market' && (
        <div
          key="spot-modal"
          style={{
            position: 'absolute', zIndex: 35,
            top: 'calc(var(--header-height) + var(--modal-margin))',
            bottom: 'calc(var(--footer-height) + var(--modal-margin))',
            left: 'var(--modal-margin)',
            width: 'min(var(--panel-width), calc(100% - 2 * var(--modal-margin)))',
            display: 'flex', flexDirection: 'column',
            background: 'linear-gradient(180deg, #112135 0%, #0c1827 100%)',
            border: '1px solid var(--edge)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
            overflowY: 'auto',
            animation: 'modalIn 0.2s ease',
          }}
        >
          <SpotMarket
            state={state}
            onSell={handleSell}
            onBuy={handleBuy}
            onContribute={handleContribute}
            onBuyBuilding={handleBuyBuilding}
          />
        </div>
      )}

      {/* ── Footer nav ── */}
      <Footer view={view} menuOpen={menuOpen} onSelect={handleFooterSelect} />

      {/* ── Drawer Menu ── */}
      {menuOpen && <MenuDrawer state={state} onClose={() => setMenuOpen(false)} />}

      {/* ── DEV PANEL — bottom-right overlay ── */}
      {import.meta.env.DEV && (
        <div style={{
          position: 'fixed', bottom: 'calc(var(--footer-height) + 8px)', right: 12, zIndex: 9999,
          background: 'rgba(7,13,22,0.95)', border: '1px solid rgba(96,160,224,0.20)',
          borderRadius: 6, padding: '6px 10px',
          display: 'flex', gap: 8, alignItems: 'center',
          fontFamily: 'Fira Code, monospace', fontSize: '0.68rem', color: 'rgba(96,160,224,0.5)',
        }}>
          <span>DEV</span>
          <button
            onClick={() => dispatch(s => ({
              ...s,
              player: { ...s.player, inventory: { ...s.player.inventory, wood: 10 } },
            }))}
            style={{
              background: 'none', border: '1px solid rgba(96,160,224,0.3)', borderRadius: 4,
              color: 'var(--blue)', padding: '2px 8px', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 'inherit',
            }}
          >
            ⏩ Phase 1
          </button>
        </div>
      )}

      {/* Chronicle overlay (end-game screen) */}
      {chronicle && (
        <Chronicle
          chronicle={chronicle}
          won={won}
          days={state.day}
          onNewGame={handleNewGame}
        />
      )}
    </div>
  )
}
