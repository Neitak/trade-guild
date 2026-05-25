import { useState, useEffect } from 'react'
import type { GameState, ResourceId, BuildingId, WonderId } from './engine/types'
import { initGame } from './engine/init'
import { resolveEndOfDay, contributeToWonder } from './engine/day'
import { sellToMarket, buyFromMarket } from './engine/market'
import { buyBuilding } from './engine/buildings'
import { buyShare } from './engine/shares'
import { generateChronicle } from './engine/chronicle'
import type { ChronicleResult } from './engine/chronicle'
import { HUD } from './components/HUD'
import { SpotMarket } from './components/SpotMarket'
import { WorldMap } from './components/WorldMap'
import { EndOfDay } from './components/EndOfDay'
import { Chronicle } from './components/Chronicle'

export default function App() {
  const [state, setState] = useState<GameState>(() => initGame())
  const [chronicle, setChronicle] = useState<ChronicleResult | null>(null)

  useEffect(() => {
    (window as any).__GAME_STATE__ = state
  }, [state])

  // Actions
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

  function handleEndDay() {
    setState(prev => {
      if (prev.phase !== 'playing') return prev
      const next = resolveEndOfDay(prev)
      if (next.phase !== 'playing') {
        setChronicle(generateChronicle(next))
      }
      return next
    })
  }

  function handleNewGame() {
    setChronicle(null)
    setState(initGame())
  }

  const won = state.phase === 'won'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Scenario intro (day 0 only) */}
      {state.day === 0 && (
        <div style={{
          background: 'rgba(201,168,76,0.08)',
          borderBottom: '1px solid var(--border)',
          padding: '6px 20px',
          fontSize: '0.8rem',
          color: 'var(--text-dim)',
          fontStyle: 'italic',
          flexShrink: 0,
        }}>
          {state.scenario}
        </div>
      )}

      {/* HUD */}
      <HUD state={state} />

      {/* Main layout */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr auto',
        gap: 8,
        padding: 8,
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Spot Market */}
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <SpotMarket
            state={state}
            onSell={handleSell}
            onBuy={handleBuy}
            onContribute={handleContribute}
          />
        </div>

        {/* World Map */}
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <WorldMap
            state={state}
            onBuyBuilding={handleBuyBuilding}
            onBuyShare={handleBuyShare}
          />
        </div>

        {/* End of Day — spans full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <EndOfDay state={state} onEndDay={handleEndDay} />
        </div>
      </div>

      {/* Chronicle overlay */}
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
