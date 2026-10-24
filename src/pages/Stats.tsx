import { useMemo } from 'react'
import { PageHeader } from '../components/PageHeader'
import { MasteryBar } from '../components/MasteryBar'
import { computeStreak, dayKey, DAY_MS, isDue, masteryOf } from '../lib/srs'
import { poolOf } from '../lib/pool'
import { ALL_UNITS, useAppData, wordKey } from '../lib/storage'

export function Stats({ onBack }: { onBack: () => void }) {
  const data = useAppData()
  const pool = useMemo(() => poolOf(data.settings.units), [data.settings.units])

  const totals = useMemo(() => {
    let correct = 0
    let wrong = 0
    for (const p of Object.values(data.progress)) {
      correct += p.correct
      wrong += p.wrong
    }
    return { correct, wrong }
  }, [data.progress])
  const answered = totals.correct + totals.wrong
  const accuracy = answered > 0 ? Math.round((totals.correct / answered) * 100) : 0
  const todayStat = data.daily[dayKey(Date.now())]
  const streak = computeStreak(data.daily)
  const learned = pool.filter((w) => data.progress[wordKey(w.word)]).length
  const now = Date.now()
  const dueCount = pool.filter((w) => isDue(data.progress[wordKey(w.word)], now)).length

  const groups = ALL_UNITS.map((u) => ({ unit: u, words: pool.filter((w) => w.unit === u) })).filter((g) => g.words.length > 0)

  return (
    <div className="page">
      <PageHeader title="学习统计" onBack={onBack} />
      <div className="stat-cards">
        <div className="stat-card"><b>{todayStat?.completed ?? 0}</b><span>今日完成</span></div>
        <div className="stat-card"><b>{streak}</b><span>连续打卡</span></div>
        <div className="stat-card"><b>{accuracy}%</b><span>总正确率</span></div>
        <div className="stat-card"><b>{learned}/{pool.length}</b><span>已学/词库</span></div>
      </div>
      <p className="dim-line">待复习 {dueCount} 词（含答错后当天到期的盒 1 词）</p>

      {groups.map((g) => (
        <section key={g.unit} className="unit-group">
          <h2 className="unit-title">{g.unit} · {g.words.length} 词</h2>
          <ul className="word-list">
            {g.words.map((w) => {
              const p = data.progress[wordKey(w.word)]
              const status = !p ? '新词' : isDue(p, now) ? '今天' : `${Math.max(1, Math.ceil((p.dueAt - now) / DAY_MS))}天后`
              return (
                <li key={w.word} className="word-row">
                  <div className="word-info">
                    <b>{w.word}</b>
                    <span className="dim">{w.meaning}</span>
                  </div>
                  <div className="word-side">
                    <MasteryBar level={masteryOf(p)} />
                    <span className={`due-label ${!p ? 'new' : isDue(p, now) ? 'due' : ''}`}>{status}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
