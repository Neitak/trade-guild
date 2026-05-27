import type { GameState, GameEvent } from './types'
import { getTex } from './types'

export interface ChronicleResult {
  title: string
  moments: string[] // 2–4 key moments narrated by the bard
  advice: string
  archetype: 'investor' | 'trader' | 'manipulator' | 'mixed'
  finalPlayerWorth: number
  finalTexWorth: number
  completedWonder?: string // name of the wonder that ended the game
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

// ─── Find 2–4 notable moments ─────────────────────────────────────────────────

function findKeyMoments(state: GameState): string[] {
  const log = state.log.filter(e => e.actor === 'player')
  const moments: string[] = []

  const buildingNames: Record<string, string> = {
    orchard: 'Verger', fruit_market: 'Marché aux Fruits', sawmill: 'Scierie', menuiserie: 'Menuiserie',
  }
  const resourceLabels: Record<string, string> = { apple: 'pommes', wood: 'bois' }

  // 1. Best single sell (by gold earned)
  const bestSell = log
    .filter(e => e.type === 'SELL')
    .sort((a, b) => (b.payload.gold as number) - (a.payload.gold as number))[0]
  if (bestSell) {
    const res = resourceLabels[bestSell.payload.resourceId as string] ?? 'marchandises'
    const gold = Math.round(bestSell.payload.gold as number)
    const price = Number(bestSell.payload.price).toFixed(2)
    moments.push(
      `Au jour ${bestSell.day}, le barde chante encore la vente de ${bestSell.payload.qty} ${res} à ${price} pièces — ${gold} or engrangé en un seul geste.`
    )
  }

  // 2. Biggest price crash in any resource
  let biggestDrop = 0, dropDay = 0, dropResource = 'pommes'
  for (const [resId, market] of Object.entries(state.market.resources)) {
    const hist = market.priceHistory
    for (let i = 1; i < hist.length; i++) {
      const drop = hist[i - 1].price - hist[i].price
      if (drop > biggestDrop) {
        biggestDrop = drop
        dropDay = hist[i].day
        dropResource = resourceLabels[resId] ?? resId
      }
    }
  }
  if (biggestDrop > 0.15) {
    moments.push(
      `Le jour ${dropDay} restera dans les mémoires : le prix du ${dropResource} s'effondra de ${biggestDrop.toFixed(2)} pièce${biggestDrop >= 2 ? 's' : ''} — le marché avait tremblé.`
    )
  }

  // 3. First building — pivotal moment
  const firstBuilding = log.find(e => e.type === 'BUY_BUILDING')
  if (firstBuilding) {
    const name = buildingNames[firstBuilding.payload.defId as string] ?? String(firstBuilding.payload.defId)
    moments.push(`Dès le jour ${firstBuilding.day}, la construction du ${name} marqua le début de l'empire. L'or s'était mis à travailler.`)
  }

  // 4. Hostile takeover (share acquisition)
  const maxShareEvent = log
    .filter(e => e.type === 'BUY_SHARE')
    .sort((a, b) => (b.payload.playerTotalShares as number) - (a.payload.playerTotalShares as number))[0]
  if (maxShareEvent && moments.length < 4) {
    const shares = maxShareEvent.payload.playerTotalShares as number
    const bName = buildingNames[maxShareEvent.payload.defId as string] ?? 'bâtiment'
    if (shares >= 51) {
      moments.push(`Au jour ${maxShareEvent.day}, le contrôle du ${bName} de Tex bascula — ${shares}% des parts acquises. Le vertige du pouvoir.`)
    } else {
      moments.push(`Au jour ${maxShareEvent.day}, la première part du ${bName} de Tex fut acquise — le début d'une mainmise froide et calculée.`)
    }
  }

  // 5. Wonder completion
  const wonderDone = log.find(e => e.type === 'WONDER_COMPLETE')
  if (wonderDone && moments.length < 4) {
    const wName = wonderDone.payload.wonderId === 'grande_cathedrale' ? 'Grande Cathédrale' : 'Tour de Magie'
    moments.push(`Au jour ${wonderDone.day}, la ${wName} s'éleva enfin — la victoire fut consommée dans la pierre et l'or.`)
  }

  // Fallback
  if (moments.length === 0) {
    moments.push(`Les chroniques restent floues sur cette partie. Mais les pièces d'or, elles, ne mentent pas.`)
  }

  return moments.slice(0, 4) // max 4 moments
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

  const tex = getTex(state)
  const finalPlayerWorth = state.player.netWorthHistory.at(-1)?.value ?? Math.floor(state.player.gold)
  const finalTexWorth    = tex.netWorthHistory.at(-1)?.value ?? Math.floor(tex.gold)

  return {
    title,
    moments,
    advice,
    archetype,
    finalPlayerWorth,
    finalTexWorth,
    completedWonder: completedWonder?.name,
  }
}
