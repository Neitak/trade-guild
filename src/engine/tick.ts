import type { GameState, ResourceId, ActiveMarketEvent, PendingMarketEvent } from './types'
import { resolveEndOfDay } from './day'
import { TICKS_PER_DAY } from './init'

// ─── Main tick resolver — called every 3 seconds ──────────────────────────────

export function resolveTick(state: GameState): GameState {
  if (state.phase !== 'playing') return state

  const newTickOfDay = state.tickOfDay + 1
  let s: GameState = { ...state, tick: state.tick + 1, tickOfDay: newTickOfDay }

  // 1. Intra-day price noise (small, every tick)
  s = applyIntraDayNoise(s)

  // 2. Apply active market events (price spikes)
  s = resolveActiveEvents(s)

  // 3. Check if pending events should fire or reveal rumor
  s = processPendingEvents(s)

  // 4. End of day — every TICKS_PER_DAY ticks
  if (newTickOfDay >= TICKS_PER_DAY) {
    s = { ...s, tickOfDay: 0 }
    s = resolveEndOfDay(s)          // increments s.day, runs AI, recovers prices
    s = maybeScheduleShortage(s)    // 15% chance to schedule next pénurie
  }

  return s
}

// ─── Intra-day price noise ────────────────────────────────────────────────────
// Small random walk applied every tick. Does NOT record a priceHistory entry
// (that's handled by recordDailyPriceSnapshot at end-of-day).
// Also does NOT run the full recovery toward equilibrium (that's daily too).

function applyIntraDayNoise(state: GameState): GameState {
  const resources = { ...state.market.resources }

  for (const id of Object.keys(resources) as ResourceId[]) {
    const r = resources[id]

    // Phase 0 (day ≤ 3): tighter noise so the tutorial curve stays readable
    const tickVolatility = state.day <= 3 ? 0.015 : 0.025
    // Slight upward bias in Phase 0
    const biasFactor = state.day <= 3 ? 0.44 : 0.49
    const noise = (Math.random() - biasFactor) * tickVolatility

    const newPrice = Math.max(
      r.baseEquilibriumPrice * 0.30,
      Math.min(r.baseEquilibriumPrice * 2.50, r.currentPrice * (1 + noise))
    )

    resources[id] = { ...r, currentPrice: Math.max(0.05, newPrice) }
  }

  return { ...state, market: { resources } }
}

// ─── Active market events (e.g. price spikes from pénuries) ──────────────────

function resolveActiveEvents(state: GameState): GameState {
  if (state.activeMarketEvents.length === 0) return state

  const resources = { ...state.market.resources }
  const stillActive: ActiveMarketEvent[] = []

  for (const ev of state.activeMarketEvents) {
    const r = resources[ev.resourceId]
    if (!r) continue

    // Apply per-tick magnitude boost
    const boosted = r.currentPrice * (1 + ev.magnitudePerTick)
    resources[ev.resourceId] = {
      ...r,
      currentPrice: Math.min(r.baseEquilibriumPrice * 2.50, boosted),
    }

    const remaining = ev.remainingTicks - 1
    if (remaining > 0) stillActive.push({ ...ev, remainingTicks: remaining })
    // If remaining === 0: event expires naturally
  }

  return {
    ...state,
    market: { resources },
    activeMarketEvents: stillActive,
  }
}

// ─── Pending events: reveal rumors + fire events ─────────────────────────────

function processPendingEvents(state: GameState): GameState {
  if (state.pendingMarketEvents.length === 0) return state

  let s = state
  const stillPending: PendingMarketEvent[] = []

  for (const ev of s.pendingMarketEvents) {
    // Reveal rumor at the right tick
    if (!ev.fired && s.tick >= ev.rumorRevealedOnTick) {
      const rumorText = buildShortageRumor(ev)
      const alreadyRevealed = s.activeRumors.some(r => r.text === rumorText)
      if (!alreadyRevealed) {
        s = {
          ...s,
          activeRumors: [
            ...s.activeRumors,
            { day: s.day, text: rumorText },
          ],
        }
      }
    }

    // Fire event (or not) based on probability
    if (!ev.fired && s.tick >= ev.firesOnTick) {
      const fired = { ...ev, fired: true }
      if (Math.random() < ev.probability) {
        // Event fires! Create active spike
        const magnitudePerTick = ev.magnitude / ev.duration
        const newActive: ActiveMarketEvent = {
          id: ev.id,
          resourceId: ev.resourceId,
          magnitudePerTick,
          remainingTicks: ev.duration,
        }
        s = { ...s, activeMarketEvents: [...s.activeMarketEvents, newActive] }

        // Confirmation rumor
        s = {
          ...s,
          activeRumors: [
            ...s.activeRumors,
            {
              day: s.day,
              text: buildShortageConfirmation(ev),
            },
          ],
        }
      } else {
        // False alarm — optional "nothing happened" rumor
        s = {
          ...s,
          activeRumors: [
            ...s.activeRumors,
            {
              day: s.day,
              text: `Les marchés se calment — la rumeur n'était qu'une fausse alerte.`,
            },
          ],
        }
      }
      stillPending.push(fired)
    } else {
      stillPending.push(ev)
    }
  }

  // Clean up fully processed events
  const cleanPending = stillPending.filter(ev => !ev.fired || s.tick < ev.firesOnTick + 5)

  return { ...s, pendingMarketEvents: cleanPending }
}

// ─── Schedule a future pénurie (called at end-of-day, 15% chance) ─────────────

function maybeScheduleShortage(state: GameState): GameState {
  if (Math.random() > 0.15) return state

  // Only schedule if no other shortage already pending
  const alreadyPending = state.pendingMarketEvents.some(
    e => e.resourceId === 'wood' && !e.fired
  )
  if (alreadyPending) return state

  const probability  = 0.4 + Math.random() * 0.5       // 40–90%
  const magnitude    = 0.2 + Math.random() * 0.6        // 20–80% total spike
  const fireDelay    = 10 + Math.floor(Math.random() * 11) // 10–20 ticks
  const rumorDelay   = Math.floor(fireDelay * 0.5)       // reveal halfway

  const event: PendingMarketEvent = {
    id: `shortage_t${state.tick}`,
    resourceId: 'wood',
    type: 'shortage',
    probability,
    magnitude,
    duration: 8 + Math.floor(Math.random() * 8),         // 8–15 ticks
    firesOnTick: state.tick + fireDelay,
    rumorRevealedOnTick: state.tick + rumorDelay,
    fired: false,
  }

  return {
    ...state,
    pendingMarketEvents: [...state.pendingMarketEvents, event],
  }
}

// ─── Rumor text generators ────────────────────────────────────────────────────

function buildShortageRumor(ev: PendingMarketEvent): string {
  if (ev.probability < 0.55) {
    const variants = [
      `Des nuages inhabituels s'accumulent au-dessus des forêts... (signal faible)`,
      `Un bûcheron murmure avoir vu des éclairs au loin. Difficile d'y croire.`,
      `Quelques marchands évoquent un ralentissement des coupes. Rumeur ou réalité ?`,
    ]
    return variants[Math.floor(Math.random() * variants.length)]
  } else if (ev.probability < 0.78) {
    const variants = [
      `Les bûcherons semblent nerveux ce matin. Quelque chose se prépare dans les forêts.`,
      `Les prix du bois frémissent. Des rumeurs de tempête circulent en ville.`,
      `Un fournisseur de bois a annulé ses livraisons de demain. Sans explication.`,
    ]
    return variants[Math.floor(Math.random() * variants.length)]
  } else {
    const variants = [
      `⚠ Tempête imminente sur les forêts. Les marchands de bois stockent en urgence.`,
      `⚠ La route forestière principale est bloquée. Pénurie de bois attendue.`,
      `⚠ Les scieries ferment par précaution. Le marché du bois va s'emballer.`,
    ]
    return variants[Math.floor(Math.random() * variants.length)]
  }
}

function buildShortageConfirmation(ev: PendingMarketEvent): string {
  const intensity = ev.magnitude > 0.5 ? 'violemment' : 'sensiblement'
  const variants = [
    `La tempête est là. Le prix du bois monte ${intensity}.`,
    `Les routes forestières sont coupées. Le bois se fait rare.`,
    `Les scieries ont fermé. L'approvisionnement en bois est bloqué.`,
  ]
  return variants[Math.floor(Math.random() * variants.length)]
}
