import type { GameState, GameEvent, PendingRumor, ActiveRumor } from './types'

// ─── Generate rumors from Brice's actions ──────────────────────────────────────

type TemplateVariants = ((payload: Record<string, unknown>) => string)[]

const RUMOR_VARIANTS: Record<string, TemplateVariants> = {
  BUY: [
    ({ qty, resourceId }) => resourceId === 'wood'
      ? `Des bûcherons affirment avoir vendu ${qty} stères de bois à Brice avant l'aube.`
      : `Des marchands murmurent que Brice accumule des pommes — ${qty} unités aperçues ce matin.`,
    ({ resourceId }) => resourceId === 'wood'
      ? `On voit des charrettes chargées de bois partir vers l'entrepôt de Brice.`
      : `On voit des chariots chargés de pommes quitter le marché en direction de Brice.`,
    () => `"Brice amasse des réserves", chuchote un colporteur au coin du marché.`,
    () => `Un vendeur confie avoir écoulé tout son stock à Brice en une seule transaction.`,
  ],
  SELL: [
    ({ qty, resourceId }) => resourceId === 'wood'
      ? `Brice aurait bradé ${qty} pièces de bois — il cherche à renflouer ses caisses.`
      : `On dit que Brice a bradé ${qty} pommes ce matin — il cherche à liquider ses stocks.`,
    ({ resourceId }) => resourceId === 'wood'
      ? `Des rumeurs d'une grande vente de bois par Brice circulent en ville.`
      : `Des rumeurs d'une grande vente de pommes par Brice circulent en ville.`,
    () => `"Brice liquide", grommelle un concurrent jaloux.`,
  ],
  BUY_BUILDING: [
    ({ defId }) => {
      if (defId === 'orchard') return `Il paraît que Brice a jeté son dévolu sur un verger au nord de la ville.`
      if (defId === 'sawmill') return `Des ouvriers auraient commencé à défricher un terrain pour une scierie de Brice.`
      if (defId === 'fruit_market') return `"Brice a ouvert un marché aux fruits !" Un concurrent de moins à surveiller... ou de plus.`
      if (defId === 'menuiserie') return `Une enseigne "Menuiserie" vient d'apparaître sur un bâtiment de Brice en ville.`
      return `Brice semble s'intéresser à de nouveaux bâtiments. Les habitants s'interrogent.`
    },
    ({ defId }) => defId === 'sawmill'
      ? `"Brice fait couper du bois !" Un homme en manteau observe les travaux depuis la colline.`
      : `Brice semble s'intéresser à de nouveaux bâtiments. Les habitants s'interrogent.`,
  ],
  WONDER_PROGRESS: [
    ({ wonderId }) => wonderId === 'grande_cathedrale'
      ? `Des pierres et des poutres convergent vers l'emplacement de la Cathédrale... pour Brice ?`
      : `Des ouvriers aperçus du côté de la Tour de Magie... travaillent-ils pour Brice ?`,
    ({ wonderId }) => wonderId === 'grande_cathedrale'
      ? `"La Cathédrale prend forme vite", dit un passant. "Quelqu'un finance discrètement les travaux."`
      : `"La Tour avance vite", dit un passant. "Quelqu'un finance discrètement les travaux."`,
    () => `Un maçon ivre lâche : "Brice paye bien pour la merveille. Très bien même."`,
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
  // Flavor text rumors only generated for Brice (the primary named rival)
  const todayBriceEvents = state.log.filter(e => e.actor === 'brice' && e.day === state.day)

  // One rumor per event type per day — no duplicates
  const seenTypes = new Set<string>()
  const newPending: PendingRumor[] = []

  for (const event of todayBriceEvents) {
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
