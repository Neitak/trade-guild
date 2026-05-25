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

interface DayRevealData {
  completedDay: number
  nextDay: number
  events: GameState['log']
  goldBefore: number
  goldAfter: number
  rumors: string[]
}

export default function App() {
  const [state, setState] = useState<GameState>(() => initGame())
  const [chronicle, setChronicle] = useState<ChronicleResult | null>(null)
  const [dayReveal, setDayReveal] = useState<DayRevealData | null>(null)

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
      const goldBefore   = prev.player.gold
      const completedDay = prev.day
      const next         = resolveEndOfDay(prev)
      const dayEvents    = next.log.filter(e => e.day === completedDay && e.actor !== 'system')
      const dayRumors    = next.activeRumors.filter(r => r.day === completedDay).map(r => r.text)
      setDayReveal({ completedDay, nextDay: next.day, events: dayEvents, goldBefore, goldAfter: next.player.gold, rumors: dayRumors })
      if (next.phase !== 'playing') {
        setChronicle(generateChronicle(next))
      }
      return next
    })
  }

  function handleDismissReveal() {
    setDayReveal(null)
  }

  function handleNewGame() {
    setChronicle(null)
    setDayReveal(null)
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

        {/* End of Day button — spans full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <button
            className="btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '1rem', letterSpacing: '0.08em' }}
            onClick={handleEndDay}
          >
            Terminer cette journée →
          </button>
        </div>
      </div>

      {/* Day reveal overlay */}
      {dayReveal && !chronicle && (
        <EndOfDay
          completedDay={dayReveal.completedDay}
          nextDay={dayReveal.nextDay}
          events={dayReveal.events}
          goldBefore={dayReveal.goldBefore}
          goldAfter={dayReveal.goldAfter}
          rumors={dayReveal.rumors}
          onDismiss={handleDismissReveal}
        />
      )}

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
