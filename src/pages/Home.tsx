import { useMemo, useState } from 'react'
import { ProfileManager } from '../components/ProfileManager'
import { computeStreak, dayKey } from '../lib/srs'
import { poolOf, todayInfo } from '../lib/pool'
import { useAppData, type ModeId } from '../lib/storage'
import { useProfileStore } from '../lib/profiles'
import { MODES, modeName } from '../modes'
import type { SessionSource } from '../modes/useSession'

interface HomeProps {
  onStart: (mode: ModeId, source: SessionSource) => void
  goPage: (p: 'mistakes' | 'stats' | 'settings') => void
}

export function Home({ onStart, goPage }: HomeProps) {
  const data = useAppData()
  const { profiles, currentId } = useProfileStore()
  const [mgrOpen, setMgrOpen] = useState(false)
  const currentName = profiles.find((p) => p.id === currentId)?.name ?? '同学'
  const pool = useMemo(() => poolOf(data.settings.units), [data.settings.units])
  const info = useMemo(() => todayInfo(data, pool), [data, pool])
  const mistakeCount = Object.keys(data.mistakes).length
  const todayStat = data.daily[dayKey(Date.now())]
  const streak = computeStreak(data.daily)

  return (
    <div className="page home">
      <header className="home-header">
        <button className="profile-chip" onClick={() => setMgrOpen(true)} aria-label="切换用户">
          👤 {currentName} <span className="dim">切换 ▾</span>
        </button>
        <h1>背词课</h1>
        <p>外研版七上 · 默写 / 听写 / 速刷 / 填空</p>
      </header>

      {mgrOpen && <ProfileManager onClose={() => setMgrOpen(false)} />}

      <button className="today-card" onClick={() => onStart(data.settings.lastMode, info.queue.length > 0 ? 'today' : 'free')}>
        <div className="today-info">
          <h2>今日复习</h2>
          {info.queue.length > 0 ? (
            <p>到期 {info.dueCount} 词 · 新词 {info.newCount} 词</p>
          ) : (
            <p>今日任务已完成 🎉 点这里自由练习</p>
          )}
        </div>
        <span className="today-go">开始 · {modeName(data.settings.lastMode)}</span>
      </button>

      <div className="home-stats">
        <span>今日 <b>{todayStat?.completed ?? 0}</b> 词</span>
        <span>连续 <b>{streak}</b> 天</span>
        <span>词库 <b>{pool.length}</b> 词</span>
      </div>

      <h2 className="section-title">练习模式</h2>
      <div className="mode-grid">
        {MODES.map((m) => (
          <button key={m.id} className="mode-card" onClick={() => onStart(m.id, info.queue.length > 0 ? 'today' : 'free')}>
            <span className="mode-icon">{m.icon}</span>
            <span className="mode-name">{m.name}</span>
            <span className="mode-desc">{m.desc}</span>
          </button>
        ))}
      </div>

      <div className="quick-row">
        <button className="quick-btn" onClick={() => goPage('mistakes')}>
          📕 错题本{mistakeCount > 0 && <em className="badge">{mistakeCount}</em>}
        </button>
        <button className="quick-btn" onClick={() => goPage('stats')}>📊 统计</button>
        <button className="quick-btn" onClick={() => goPage('settings')}>⚙️ 设置</button>
      </div>

      <p className="foot-note">数据只存在本机浏览器 · 多人可各建一个用户 · 到期词优先复习（Leitner 记忆盒）</p>
    </div>
  )
}
