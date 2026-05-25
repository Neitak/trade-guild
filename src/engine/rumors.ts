import type { GameState, GameEvent, PendingRumor, ActiveRumor } from './types'

// ─── Generate rumors from Tex's actions ──────────────────────────────────────

type TemplateVariants = ((payload: Record<string, unknown>) => string)[]

const RUMOR_VARIANTS: Record<string, TemplateVariants> = {
  BUY: [
    ({ qty }) => `Des marchands murmurent que Tex accumule des pommes — ${qty} unités aperçues ce matin.`,
    () => `On voit des chariots chargés de pommes quitter le marché en direction de Tex.`,
    () => `"Tex amasse des réserves", chuchote un colporteur au coin du marché.`,
    () => `Un vendeur confie avoir écoulé tout son stock de pommes à Tex en une seule transaction.`,
  ],
  SELL: [
    ({ qty }) => `On dit que Tex a bradé ${qty} pommes ce matin — il cherche à liquider ses stocks.`,
    () => `Des rumeurs d'une grande vente de pommes par Tex circulent en ville.`,
    () => `"Tex se débarrasse de ses pommes", grommelle un concurrent jaloux.`,
  ],
  BUY_BUILDING: [
    ({ defId }) => defId === 'orchard'
      ? `Il paraît que Tex a jeté son dévolu sur un verger au nord de la ville.`
      : `Des rumeurs parlent d'un nouveau marché ouvert par Tex — les affaires semblent prospères.`,
    ({ defId }) => defId === 'fruit_market'
      ? `"Tex a ouvert un marché aux fruits !" Un concurrent de moins à surveiller... ou de plus.`
      : `Tex semble s'intéresser à de nouveaux bâtiments. Les habitants s'interrogent.`,
  ],
  WONDER_PROGRESS: [
    () => `Des ouvriers aperçus du côté de la Tour de Magie... travaillent-ils pour Tex ?`,
    () => `"La Tour avance vite", dit un passant. "Quelqu'un finance discrètement les travaux."`,
    () => `Un maçon ivre lâche : "Tex paye bien pour la Tour. Très bien même."`,
  ],
}

function pickVariant(variants: TemplateVariants, payload: Record<string, unknown>): string {
  const fn = variants[Math.floor(Math.random() * variants.length)]
  return fn(payload)
}

function buildRumor(event: GameEvent, revealOnDay: number): PendingRumor | null {
  const variants = RUMOR_VARIANTS[event.type]
  if (!variants) return null
  if (event.type === 'SELL' && (event.payload.qty as number) < 15) return null
  if (event.type === 'BUY' && (event.payload.qty as number) < 8) return null

  return {
    revealOnDay,
    text: pickVariant(variants, event.payload),
  }
}

// ─── Called at end of day to queue new rumors ─────────────────────────────────

export function generateRumors(state: GameState): GameState {
  const todayTexEvents = state.log.filter(e => e.actor === 'tex' && e.day === state.day)

  // One rumor per event type per day — no duplicates
  const seenTypes = new Set<string>()
  const newPending: PendingRumor[] = []

  for (const event of todayTexEvents) {
    if (seenTypes.has(event.type)) continue
    seenTypes.add(event.type)

    const delay = Math.random() < 0.5 ? 1 : 2
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
