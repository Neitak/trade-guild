import type { GameState, GameEvent } from './types'

export interface ChronicleResult {
  title: string
  moments: [string, string] // exactly 2 key moments
  advice: string
  archetype: 'investor' | 'trader' | 'manipulator' | 'mixed'
}

// ─── Detect player archetype from event log ───────────────────────────────────

function detectArchetype(log: GameEvent[]): ChronicleResult['archetype'] {
  const playerEvents = log.filter(e => e.actor === 'player')
  const sells = playerEvents.filter(e => e.type === 'SELL').length
  const buys = playerEvents.filter(e => e.type === 'BUY').length
  const buildings = playerEvents.filter(e => e.type === 'BUY_BUILDING').length
  const shares = playerEvents.filter(e => e.type === 'BUY_SHARE').length
  const wonderContribs = playerEvents.filter(e => e.type === 'WONDER_PROGRESS').length

  if (buildings >= 3 && sells <= 5) return 'investor'
  if ((sells + buys) >= 10 && buildings <= 1) return 'trader'
  if (shares >= 2 || (sells >= 5 && buys >= 3)) return 'manipulator'
  return 'mixed'
}

// ─── Find the two most notable moments ───────────────────────────────────────

function findKeyMoments(state: GameState): [string, string] {
  const log = state.log.filter(e => e.actor === 'player')
  const moments: string[] = []

  // Best sell: highest gold in a single SELL
  const bestSell = log
    .filter(e => e.type === 'SELL')
    .sort((a, b) => (b.payload.gold as number) - (a.payload.gold as number))[0]
  if (bestSell) {
    moments.push(
      `Au jour ${bestSell.day}, le barde chante encore la vente de ${bestSell.payload.qty} pommes à ${Number(bestSell.payload.price).toFixed(2)} pièces — ${Math.round(bestSell.payload.gold as number)} pièces d'or en un instant.`
    )
  }

  // Price crash: biggest single-day price drop
  const priceHistory = state.market.resources['apple'].priceHistory
  let biggestDrop = 0
  let dropDay = 0
  for (let i = 1; i < priceHistory.length; i++) {
    const drop = priceHistory[i - 1].price - priceHistory[i].price
    if (drop > biggestDrop) {
      biggestDrop = drop
      dropDay = priceHistory[i].day
    }
  }
  if (biggestDrop > 0.2) {
    moments.push(
      `Le jour ${dropDay} restera dans les mémoires : le prix des pommes s'effondra de ${biggestDrop.toFixed(2)} pièce${biggestDrop >= 2 ? 's' : ''}.`
    )
  }

  // First building bought
  const firstBuilding = log.find(e => e.type === 'BUY_BUILDING')
  if (firstBuilding && moments.length < 2) {
    const names: Record<string, string> = { orchard: 'Verger', fruit_market: 'Marché aux Fruits', sawmill: 'Scierie', menuiserie: 'Menuiserie' }
    const name = names[firstBuilding.payload.defId as string] ?? String(firstBuilding.payload.defId)
    moments.push(`Dès le jour ${firstBuilding.day}, la construction du ${name} marqua le début de l'empire.`)
  }

  // Share acquisition
  const firstShare = log.find(e => e.type === 'BUY_SHARE')
  if (firstShare && moments.length < 2) {
    moments.push(
      `Au jour ${firstShare.day}, la première part du bâtiment de Tex fut acquise — le début d'une mainmise froide et calculée.`
    )
  }

  // Wonder completion (player)
  const wonderDone = log.find(e => e.type === 'WONDER_COMPLETE' && e.actor === 'player')
  if (wonderDone && moments.length < 2) {
    const wName = wonderDone.payload.wonderId === 'grande_cathedrale' ? 'Grande Cathédrale' : 'Tour de Magie'
    moments.push(`Au jour ${wonderDone.day}, la ${wName} s'éleva enfin — et la victoire fut consommée.`)
  }

  // Fallback
  while (moments.length < 2) {
    moments.push(`Les chroniques restent floues sur cette journée-là.`)
  }

  return [moments[0], moments[1]]
}

// ─── Advice by archetype ──────────────────────────────────────────────────────

const ADVICE: Record<ChronicleResult['archetype'], string[]> = {
  investor: [
    'Vos bâtiments ont prospéré — mais le marché aussi. La prochaine fois, vendez quand le prix monte pour financer votre expansion.',
    'Bonne stratégie de construction. Essayez d\'acquérir des parts chez Tex pour doubler vos revenus sans rien bâtir.',
  ],
  trader: [
    'Vous avez dominé le marché — mais sans bâtiments, la Tour reste hors de portée. Tradez pour financer, pas uniquement pour gagner.',
    'Vos réflexes de marché sont excellents. Utilisez-les pour assécher les pommes de Tex avant qu\'il ne construise son marché.',
  ],
  manipulator: [
    'Vous avez pressé Tex — bien joué. La prochaine fois, achetez ses parts plus tôt pour profiter de sa production dès le jour 10.',
    'Excellente pression sur Tex. Combinez le rachat hostile avec un dump massif pour le bloquer sur deux fronts simultanément.',
  ],
  mixed: [
    'Une partie équilibrée. Choisissez un cap plus tôt : investir dans les bâtiments, trader le marché, ou comprimer Tex. La polyvalence coûte du temps.',
    'Vous avez tout essayé — c\'est bien pour apprendre. La prochaine fois, forcez un archétype dès le jour 5.',
  ],
}

function getAdvice(archetype: ChronicleResult['archetype'], won: boolean): string {
  const pool = ADVICE[archetype]
  const idx = won ? 0 : 1
  return pool[idx] ?? pool[0]
}

// ─── Titles ───────────────────────────────────────────────────────────────────

const TITLES_WON: Record<ChronicleResult['archetype'], string[]> = {
  investor: ['L\'Architecte de l\'Abondance', 'Le Bâtisseur Silencieux'],
  trader: ['Le Maître du Marché', 'Le Roi des Pommes'],
  manipulator: ['L\'Ombre du Commerce', 'Le Fossoyeur de Tex'],
  mixed: ['Le Stratège Imprévisible', 'L\'Opportuniste Couronné'],
}
const TITLES_LOST: Record<ChronicleResult['archetype'], string[]> = {
  investor: ['Le Rêveur de Pierres', 'Trop de Tours, Pas Assez d\'Or'],
  trader: ['Le Marchand Sans Tour', 'Riche en Pommes, Pauvre en Gloire'],
  manipulator: ['Le Complot Déjoué', 'Tex a Bien Ri'],
  mixed: ['La Bonne Idée du Mauvais Moment', 'Courageux Mais Confus'],
}

function getTitle(archetype: ChronicleResult['archetype'], won: boolean): string {
  const pool = won ? TITLES_WON[archetype] : TITLES_LOST[archetype]
  return pool[Math.floor(Math.random() * pool.length)]
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateChronicle(state: GameState): ChronicleResult {
  const archetype = detectArchetype(state.log)
  const completedWonder = state.wonders.find(w => w.complete)
  const won = completedWonder?.completedBy === 'player'
  const title = getTitle(archetype, won)
  const moments = findKeyMoments(state)
  const advice = getAdvice(archetype, won)

  return { title, moments, advice, archetype }
}
