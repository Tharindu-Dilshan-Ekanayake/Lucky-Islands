import { useGame } from '../store/game'
import { u } from './format'
import { Button, Fancy } from './kit'
import { BackpackPanel, CaseOpening, CasesPanel } from './panels/Cosmetics'
import { DailyPanel, LeaderboardsPanel, QuestsPanel, ShopPanel } from './panels/Progress'
import { BotsPanel, SettingsPanel } from './panels/Options'
import { t } from './i18n'

/**
 * The lobby's panels (cases, backpack, shop, daily reward, leaderboards, settings) and
 * the case-opening reel. Their own chunk: loaded after the game is on screen.
 */
export default function Panels() {
  const panel = useGame((s) => s.panel)
  const caseOpen = useGame((s) => s.caseOpen)
  return (
    <>
      {panel && !caseOpen && <PanelBody panel={panel} />}
      {caseOpen && <CaseOpening result={caseOpen} />}
    </>
  )
}

function PanelBody({ panel }) {
  const close = useGame((s) => s.closePanel)
  const titles = { bots: 'PLAY WITH BOTS', cases: 'CASES', backpack: 'BACKPACK', shop: 'SHOP', daily: 'DAILY REWARD', quests: 'LEVEL & QUESTS', leaderboards: 'TOP PLAYERS', settings: 'SETTINGS' }
  const Body = { bots: BotsPanel, cases: CasesPanel, backpack: BackpackPanel, shop: ShopPanel, daily: DailyPanel, quests: QuestsPanel, leaderboards: LeaderboardsPanel, settings: SettingsPanel }[panel]
  if (!Body) return null
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="mc-panel pop-in relative flex flex-col text-white" style={{ width: `min(94vw, ${u(820)})`, maxHeight: '88vh', padding: u(18), gap: u(12) }}>
        <div className="flex items-center justify-between">
          <Fancy size={32} from="#ffffff" to="#ffd23b">
            {t(titles[panel])}
          </Fancy>
          <Button color="#d8443a" style={{ width: u(46), height: u(46), fontSize: u(24) }} onClick={close}>
            ✕
          </Button>
        </div>
        <div className="overflow-y-auto" style={{ paddingRight: u(4) }}>
          <Body />
        </div>
      </div>
    </div>
  )
}
