import { useMemo } from 'react'
import { PageHeader } from '../components/PageHeader'
import { WORDS } from '../data/words'
import { removeMistake, useAppData, wordKey } from '../lib/storage'

interface MistakesProps {
  onBack: () => void
  /** 用上次的练习模式开始错题专项练习 */
  onPractice: () => void
}

export function Mistakes({ onBack, onPractice }: MistakesProps) {
  const data = useAppData()
  const words = useMemo(
    () =>
      WORDS.filter((w) => data.mistakes[wordKey(w.word)] !== undefined).sort(
        (a, b) => data.mistakes[wordKey(b.word)] - data.mistakes[wordKey(a.word)],
      ),
    [data.mistakes],
  )

  return (
    <div className="page">
      <PageHeader title={`错题本 · ${words.length}`} onBack={onBack} />

      {words.length === 0 ? (
        <section className="card empty">
          <p className="empty-icon">🌤️</p>
          <p>错题本还是空的。任何模式里答错的词都会自动收进来。</p>
        </section>
      ) : (
        <>
          <section className="card">
            <p className="dim">练习中答对即移出错题本；答错会保留。</p>
            <button className="primary big" onClick={onPractice}>练习这 {words.length} 个错词</button>
          </section>
          <ul className="word-list">
            {words.map((w) => (
              <li key={w.word} className="word-row">
                <div className="word-info">
                  <b>{w.word}</b>
                  <span className="dim">
                    <span className="unit-tag">{w.unit}</span> {w.meaning}
                  </span>
                </div>
                <button className="icon-btn" aria-label={`移除 ${w.word}`} onClick={() => removeMistake(w.word)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
