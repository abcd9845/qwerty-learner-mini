import { useEffect, useState } from 'react'
import { Home } from './pages/Home'
import { Stats } from './pages/Stats'
import { Mistakes } from './pages/Mistakes'
import { SettingsPage } from './pages/Settings'
import { ProfileGate } from './pages/ProfileGate'
import { Practice } from './modes/Practice'
import type { SessionSource } from './modes/useSession'
import { setSettings, useAppData, type ModeId } from './lib/storage'
import { useProfileStore } from './lib/profiles'
import { setSoundEnabled } from './lib/sound'
import { stopSpeak } from './lib/speech'

type Route =
  | { page: 'home' }
  | { page: 'practice'; mode: ModeId; source: SessionSource }
  | { page: 'mistakes' }
  | { page: 'stats' }
  | { page: 'settings' }

export default function App() {
  const data = useAppData()
  const { profiles, currentId } = useProfileStore()
  const [route, setRoute] = useState<Route>({ page: 'home' })

  useEffect(() => {
    setSoundEnabled(data.settings.keySound)
  }, [data.settings.keySound])

  // 离开练习页时停止朗读
  useEffect(() => {
    if (route.page !== 'practice') stopSpeak()
  }, [route])

  // 本地用户：没有任何用户（首次使用/全部删光）时先引导创建
  if (profiles.length === 0 || currentId === null) {
    return <ProfileGate />
  }

  const goHome = () => setRoute({ page: 'home' })

  const startPractice = (mode: ModeId, source: SessionSource) => {
    if (mode !== data.settings.lastMode) setSettings({ lastMode: mode })
    setRoute({ page: 'practice', mode, source })
  }

  switch (route.page) {
    case 'practice':
      return <Practice mode={route.mode} source={route.source} onExit={goHome} />
    case 'mistakes':
      return <Mistakes onBack={goHome} onPractice={() => startPractice(data.settings.lastMode, 'mistakes')} />
    case 'stats':
      return <Stats onBack={goHome} />
    case 'settings':
      return <SettingsPage onBack={goHome} />
    default:
      return <Home onStart={startPractice} goPage={(p) => setRoute({ page: p })} />
  }
}
