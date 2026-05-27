import { useState, useEffect, useCallback } from 'react'
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
  const [showMarket, setShowMarket] = useState(false)

  const closeMarket = useCallback(() => setShowMarket(false), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMarket()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeMarket])

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

      {/* Main layout — WorldMap plein écran */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <WorldMap
          state={state}
          onBuyBuilding={handleBuyBuilding}
          onBuyShare={handleBuyShare}
        />

        {/* Floating market button — bottom left */}
        <button
          onClick={() => setShowMarket(true)}
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: 'rgba(10,10,26,0.92)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)',
            color: 'var(--accent)',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.85rem',
            letterSpacing: '0.06em',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 12px rgba(201,168,76,0.18)',
          }}
        >
          ⚖ Marché
        </button>

        {/* End of day button — bottom right */}
        <button
          className="btn-primary"
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            zIndex: 10,
            padding: '10px 24px',
            fontSize: '0.9rem',
            letterSpacing: '0.08em',
          }}
          onClick={handleEndDay}
        >
          Terminer cette journée →
        </button>
      </div>

      {/* SpotMarket modal overlay */}
      {showMarket && (
        <div
          onClick={closeMarket}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(900px, 96vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 20,
              position: 'relative',
            }}
          >
            <button
              onClick={closeMarket}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '2px 6px',
              }}
              aria-label="Fermer"
            >✕</button>
            <SpotMarket
              state={state}
              onSell={handleSell}
              onBuy={handleBuy}
              onContribute={handleContribute}
            />
          </div>
        </div>
      )}

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
