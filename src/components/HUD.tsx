import type { GameState } from '../engine/types'

interface Props {
  state: GameState
}

export function HUD({ state }: Props) {
  const { player, tex, day, wonders, market } = state
  const applePrice = market.resources.apple.currentPrice
  const woodPrice  = market.resources.wood.currentPrice
  const playerApples = player.inventory.apple ?? 0
  const playerWood   = player.inventory.wood  ?? 0
  const texApples = tex.inventory.apple ?? 0
  const texWood   = tex.inventory.wood  ?? 0

  const tower     = wonders.find(w => w.id === 'tower_of_magic')!
  const cathedrale = wonders.find(w => w.id === 'grande_cathedrale')!

  const towerReq     = tower.requiredResources.apple ?? 800
  const cathedReq    = cathedrale.requiredResources.wood ?? 400

  const playerTowerPct  = Math.round(((tower.playerContributed.apple    ?? 0) / towerReq)  * 100)
  const texTowerPct     = Math.round(((tower.texContributed.apple       ?? 0) / towerReq)  * 100)
  const playerCathedPct = Math.round(((cathedrale.playerContributed.wood ?? 0) / cathedReq) * 100)
  const texCathedPct    = Math.round(((cathedrale.texContributed.wood    ?? 0) / cathedReq) * 100)

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
      {/* Day */}
      <div style={{ fontFamily: 'var(--font-title)', fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
        JOUR <span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>{day}</span>
      </div>

      <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

      {/* Gold */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: '1.8rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--accent)', lineHeight: 1 }}>
          {Math.floor(player.gold)}
        </span>
        <span style={{ color: 'var(--accent-dim)', fontSize: '0.85rem' }}>or</span>
      </div>

      {/* Apple inventory */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: '1.05rem', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{playerApples}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>🍎</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>({applePrice.toFixed(2)})</span>
      </div>

      {/* Wood inventory */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: '1.05rem', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{playerWood}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>🪵</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>({woodPrice.toFixed(2)})</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Wonder race — Tour de Magie */}
      <WonderBar
        label="TOUR DE MAGIE"
        playerPct={playerTowerPct}
        texPct={texTowerPct}
        playerContrib={tower.playerContributed.apple ?? 0}
        texContrib={tower.texContributed.apple ?? 0}
        required={towerReq}
        unit="🍎"
      />

      <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

      {/* Wonder race — Grande Cathédrale */}
      <WonderBar
        label="GRANDE CATHÉDRALE"
        playerPct={playerCathedPct}
        texPct={texCathedPct}
        playerContrib={cathedrale.playerContributed.wood ?? 0}
        texContrib={cathedrale.texContributed.wood ?? 0}
        required={cathedReq}
        unit="🪵"
      />

      <div style={{ width: 1, height: 32, background: 'var(--border)' }} />

      {/* Tex status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        <span>Tex : <span style={{ color: 'var(--tex-color)', fontFamily: 'var(--font-mono)' }}>{Math.floor(tex.gold)} or</span></span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>{texApples} 🍎  {texWood} 🪵</span>
      </div>
    </div>
  )
}

// ─── Reusable wonder progress bar ────────────────────────────────────────────

interface WonderBarProps {
  label: string
  playerPct: number
  texPct: number
  playerContrib: number
  texContrib: number
  required: number
  unit: string
}

function WonderBar({ label, playerPct, texPct, playerContrib, texContrib, required, unit }: WonderBarProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: '0.6rem', color: 'var(--accent-dim)', letterSpacing: '0.08em', textAlign: 'center' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--player-color)', width: 22, textAlign: 'right' }}>{playerPct}%</span>
        <div style={{ flex: 1, height: 5, background: 'var(--bg-card)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${playerPct}%`, background: 'var(--player-color)', borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ flex: 1, height: 5, background: 'var(--bg-card)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${texPct}%`, background: 'var(--tex-color)', borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
        <span style={{ fontSize: '0.65rem', color: 'var(--tex-color)', width: 22 }}>{texPct}%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
        <span>Toi</span>
        <span>{playerContrib}/{required} {unit}</span>
        <span>Tex</span>
      </div>
    </div>
  )
}
