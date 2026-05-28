import type { GameState } from '../engine/types'

interface Props {
  state: GameState
}

function formatGold(g: number): string {
  if (g >= 100) return Math.round(g).toString()
  if (g >= 10)  return g.toFixed(1)
  return g.toFixed(2)
}

export function HUD({ state }: Props) {
  const { player, rivals, day, tickOfDay, wonders, market } = state
  const woodPrice  = market.resources.wood.currentPrice
  const playerWood   = player.inventory.wood  ?? 0

  const tower     = wonders.find(w => w.id === 'tower_of_magic')!
  const cathedrale = wonders.find(w => w.id === 'grande_cathedrale')!

  const towerReq     = tower.requiredResources.apple ?? 800
  const cathedReq    = cathedrale.requiredResources.wood ?? 400

  const playerTowerPct  = Math.round(((tower.playerContributed.apple    ?? 0) / towerReq)  * 100)
  const playerCathedPct = Math.round(((cathedrale.playerContributed.wood ?? 0) / cathedReq) * 100)
  // Best rival progress for wonder bars
  const bestTowerPct    = Math.round((Math.max(...rivals.map(r => tower.rivalContributed[r.id]?.apple ?? 0)) / towerReq) * 100)
  const bestCathedPct   = Math.round((Math.max(...rivals.map(r => cathedrale.rivalContributed[r.id]?.wood ?? 0)) / cathedReq) * 100)

  // Classement par valeur nette décroissante
  const allGuilds = [
    { id: player.id, name: 'Vous', color: player.color, worth: player.netWorthHistory.at(-1)?.value ?? player.gold, gold: player.gold },
    ...rivals.map(r => ({ id: r.id, name: r.name, color: r.color, worth: r.netWorthHistory.at(-1)?.value ?? r.gold, gold: r.gold })),
  ].sort((a, b) => b.worth - a.worth)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      padding: '8px 20px',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Day + tick progress */}
      <div style={{ fontFamily: 'var(--font-title)', fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
        JOUR <span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>{day}</span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 5, fontFamily: 'var(--font-mono)' }}>
          {tickOfDay ?? 0}/30
        </span>
      </div>

      <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

      {/* Gold */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: '1.8rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--accent)', lineHeight: 1 }}>
          {formatGold(player.gold)}
        </span>
        <span style={{ color: 'var(--accent-dim)', fontSize: '0.85rem' }}>or</span>
      </div>

      {/* Wood inventory */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: '1.3rem', fontFamily: 'var(--font-mono)', color: '#5a9e6a', fontWeight: 500 }}>{playerWood}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>🪵</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>({woodPrice.toFixed(2)})</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Wonder race — Tour de Magie */}
      <WonderBar
        label="TOUR DE MAGIE"
        playerPct={playerTowerPct}
        rivalPct={bestTowerPct}
        playerContrib={tower.playerContributed.apple ?? 0}
        required={towerReq}
        unit="🍎"
      />

      <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

      {/* Wonder race — Grande Cathédrale */}
      <WonderBar
        label="GRANDE CATHÉDRALE"
        playerPct={playerCathedPct}
        rivalPct={bestCathedPct}
        playerContrib={cathedrale.playerContributed.wood ?? 0}
        required={cathedReq}
        unit="🪵"
      />

      <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

      {/* Classement guildes */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {allGuilds.map((g, i) => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
            {i === 0 && <span style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>🏆</span>}
            <span style={{ color: g.color, fontWeight: g.id === 'player' ? 600 : 400 }}>{g.id === 'player' ? 'Toi' : g.name.split(' ')[0]}</span>
            <span style={{ color: 'var(--text-dim)' }}>{formatGold(g.gold)}g</span>
            {i < allGuilds.length - 1 && <span style={{ color: 'var(--border)', margin: '0 2px' }}>·</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Reusable wonder progress bar ────────────────────────────────────────────

interface WonderBarProps {
  label: string
  playerPct: number
  rivalPct: number
  playerContrib: number
  required: number
  unit: string
}

function WonderBar({ label, playerPct, rivalPct, playerContrib, required, unit }: WonderBarProps) {
  const playerLeads = playerPct > rivalPct + 10
  const texLeads    = rivalPct > playerPct + 10

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 220 }}>

      {/* Label + amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.62rem', color: 'var(--accent-dim)', letterSpacing: '0.07em' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
          {playerContrib}/{required} {unit}
        </span>
      </div>

      {/* Player bar */}
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${playerPct}%`,
            background: 'var(--player-color)',
            borderRadius: 4,
            transition: 'width 0.5s ease',
            boxShadow: playerLeads ? '0 0 8px rgba(76,138,201,0.7)' : undefined,
          }} />
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
          color: playerLeads ? 'var(--player-color)' : 'var(--text-muted)',
          width: 28, textAlign: 'right', fontWeight: playerLeads ? 500 : 400,
        }}>
          {playerPct}%
        </span>
      </div>

      {/* Best rival bar */}
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${rivalPct}%`,
            background: 'var(--tex-color)',
            borderRadius: 4,
            transition: 'width 0.5s ease',
            boxShadow: texLeads ? '0 0 8px rgba(201,76,76,0.7)' : undefined,
          }} />
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
          color: texLeads ? 'var(--tex-color)' : 'var(--text-muted)',
          width: 28, textAlign: 'right', fontWeight: texLeads ? 500 : 400,
        }}>
          {rivalPct}%
        </span>
      </div>

      {/* Player / Rivals label */}
      <div style={{ display: 'flex', fontSize: '0.58rem', color: 'var(--text-muted)', paddingRight: 35 }}>
        <span style={{ color: 'var(--player-color)', opacity: 0.7 }}>Toi</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: 'var(--tex-color)', opacity: 0.7 }}>Best rival</span>
      </div>

    </div>
  )
}
