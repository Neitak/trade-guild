import type { GameState, GameEvent, PendingRumor, ActiveRumor } from './types'

// ─── Generate rumors from Tex's actions ──────────────────────────────────────

const RUMOR_TEMPLATES: Record<string, (payload: Record<string, unknown>) => string> = {
  BUY: ({ resourceId, qty }) =>
    `Des marchands murmurent que Tex accumule des ${resourceId === 'apple' ? 'pommes' : String(resourceId)}.`,
  SELL: ({ resourceId }) =>
    `On dit que Tex cherche à se débarrasser de ses ${resourceId === 'apple' ? 'pommes' : String(resourceId)}.`,
  BUY_BUILDING: ({ defId }) => {
    if (defId === 'orchard') return `Il paraît que Tex a jeté son dévolu sur un verger.`
    if (defId === 'fruit_market') return `Des rumeurs parlent d'un nouveau marché ouvert par Tex.`
    return `Tex semble s'intéresser à de nouveaux bâtiments.`
  },
  WONDER_PROGRESS: () =>
    `Des ouvriers aperçus du côté de la Tour de Magie... travaillent-ils pour Tex ?`,
}

function buildRumor(event: GameEvent, revealOnDay: number): PendingRumor | null {
  const template = RUMOR_TEMPLATES[event.type]
  if (!template) return null
  // Only generate rumors for significant Tex actions
  if (event.type === 'SELL' && (event.payload.qty as number) < 20) return null
  if (event.type === 'BUY' && (event.payload.qty as number) < 10) return null

  return {
    revealOnDay,
    text: template(event.payload),
  }
}

// ─── Called at end of day to queue new rumors ─────────────────────────────────

export function generateRumors(state: GameState): GameState {
  // Look at Tex events from this day
  const todayTexEvents = state.log.filter(
    e => e.actor === 'tex' && e.day === state.day
  )

  const newPending: PendingRumor[] = []
  for (const event of todayTexEvents) {
    const delay = Math.random() < 0.5 ? 1 : 2 // J+1 or J+2
    const rumor = buildRumor(event, state.day + delay)
    if (rumor) newPending.push(rumor)
  }

  return {
    ...state,
    pendingRumors: [...state.pendingRumors, ...newPending],
  }
}

// ─── Called at start of each day to reveal due rumors ─────────────────────────

export function revealDueRumors(state: GameState): GameState {
  const due = state.pendingRumors.filter(r => r.revealOnDay <= state.day)
  const remaining = state.pendingRumors.filter(r => r.revealOnDay > state.day)

  if (due.length === 0) return state

  const newActive: ActiveRumor[] = due.map(r => ({
    day: state.day,
    text: r.text,
    nodeId: r.nodeId,
  }))

  return {
    ...state,
    pendingRumors: remaining,
    activeRumors: [...state.activeRumors, ...newActive],
  }
}
