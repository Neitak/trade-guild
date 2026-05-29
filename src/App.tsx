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
import { HUD } from './components/HUD'
import { SpotMarket } from './components/SpotMarket'
import { WorldMap } from './components/WorldMap'
import { Chronicle } from './components/Chronicle'

export default function App() {
  const [state, setState] = useState<GameState>(() => initGame())
  const [chronicle, setChronicle] = useState<ChronicleResult | null>(null)

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
      // Skip Phase 0: give player 10 wood so Phase 0 is done and sawmill is unlockable
      skipToPhase1: () => setState(prev => ({
        ...prev,
        player: {
          ...prev.player,
          inventory: { ...prev.player.inventory, wood: 10 },
        },
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

  function handleSell(resourceId: ResourceId, qty: number) {
    dispatch(s => sellToMarket(s, resourceId, qty))
  }

  function handleBuy(resourceId: ResourceId, qty: number) {
    dispatch(s => buyFromMarket(s, resourceId, qty))
  }

  function handleContribute(qty: number, wonderId: WonderId) {
    dispatch(s => contributeToWonder(s, qty, wonderId))
  }

  function handleBuyBuilding(defId: BuildingId) {
    dispatch(s => buyBuilding(s, defId))
  }

  function handleUpgradeBuilding(instanceId: string) {
    dispatch(s => upgradeBuilding(s, instanceId))
  }

  function handleBuyShare(instanceId: string) {
    dispatch(s => buyShare(s, instanceId))
  }

  function handleNewGame() {
    setChronicle(null)
    setState(initGame())
  }

  const won = state.phase === 'won'

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* ── LEFT SIDEBAR — Spot Market (permanent, always visible) ── */}
      <aside style={{
        width: 300,
        flexShrink: 0,
        overflowY: 'auto',
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <SpotMarket
          state={state}
          onSell={handleSell}
          onBuy={handleBuy}
          onContribute={handleContribute}
          onBuyBuilding={handleBuyBuilding}
        />
      </aside>

      {/* ── RIGHT COLUMN — HUD + Map ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        overflow: 'hidden',
      }}>
        {/* HUD top bar */}
        <HUD state={state} />

        {/* World map fills remaining space */}
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <WorldMap
            state={state}
            onBuyBuilding={handleBuyBuilding}
            onBuyShare={handleBuyShare}
            onUpgradeBuilding={handleUpgradeBuilding}
          />
        </div>
      </div>

      {/* ── DEV PANEL — bottom-right overlay ── */}
      {import.meta.env.DEV && (
        <div style={{
          position: 'fixed', bottom: 12, right: 12, zIndex: 9999,
          background: 'rgba(10,10,20,0.92)', border: '1px solid #c9a84c44',
          borderRadius: 6, padding: '6px 10px',
          display: 'flex', gap: 8, alignItems: 'center',
          fontFamily: 'Fira Code, monospace', fontSize: '0.68rem', color: '#c9a84c88',
        }}>
          <span>DEV</span>
          <button
            onClick={() => dispatch(s => ({
              ...s,
              player: { ...s.player, inventory: { ...s.player.inventory, wood: 10 } },
            }))}
            style={{
              background: 'none', border: '1px solid #c9a84c66', borderRadius: 4,
              color: '#c9a84c', padding: '2px 8px', cursor: 'pointer',
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
