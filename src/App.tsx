import { useState, useEffect } from 'react'
import type { GameState, ResourceId, BuildingId, WonderId } from './engine/types'
import { initGame } from './engine/init'
import { contributeToWonder } from './engine/day'
import { resolveTick } from './engine/tick'
import { sellToMarket, buyFromMarket } from './engine/market'
import { buyBuilding } from './engine/buildings'
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

  // ─── Real-time tick engine (3s interval) ────────────────────────────────────
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
    }, 3000)
    return () => clearInterval(id)
  }, [state.phase])

  // ─── Dev tools ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (window as any).__GAME_STATE__ = state
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
          />
        </div>
      </div>

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
