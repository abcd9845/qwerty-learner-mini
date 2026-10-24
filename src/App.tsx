import { useEffect, useMemo, useRef, useState } from 'react'
import { UNITS, WORDS, Unit } from './words'
import { useTyping } from './useTyping'

type UnitFilter = 'all' | Unit

const UNIT_STORAGE_KEY = 'qwerty-learner-mini:unit'

function loadUnit(): UnitFilter {
  try {
    const saved = localStorage.getItem(UNIT_STORAGE_KEY)
    if (saved && UNITS.some((u) => u.id === saved)) return saved as UnitFilter
  } catch {
    /* localStorage 不可用时忽略 */
  }
  return 'all'
}

function WordView({ word, typed, wrongKey }: { word: string; typed: number; wrongKey: string | null }) {
  return (
    <div className="word" aria-label={word}>
      {word.split('').map((ch, i) => {
        const state = i < typed ? 'done' : i === typed ? (wrongKey ? 'wrong' : 'current') : 'todo'
        return (
          <span key={i} className={`letter ${state}`}>
            {state === 'wrong' ? (
              <>
                <span className="bad">{wrongKey}</span>
                <span className="hint-letter">{ch}</span>
              </>
            ) : (
              ch
            )}
          </span>
        )
      })}
    </div>
  )
}

export default function App() {
  const [unit, setUnit] = useState<UnitFilter>(loadUnit)
  const pool = useMemo(() => (unit === 'all' ? WORDS : WORDS.filter((w) => w.unit === unit)), [unit])
  const { list, state, strict, orderMode, accuracy, wpm, restart, toggleStrict } = useTyping(pool)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(UNIT_STORAGE_KEY, unit)
    } catch {
      /* 忽略写入失败 */
    }
  }, [unit])

  // 移动端：点击任意处唤起软键盘（隐藏 input 仅用于调起键盘，真正的按键走全局 keydown）
  useEffect(() => {
    const focus = () => inputRef.current?.focus()
    focus()
    window.addEventListener('pointerdown', focus)
    return () => window.removeEventListener('pointerdown', focus)
  }, [])

  const current = list[Math.min(state.wordIndex, list.length - 1)]

  return (
    <div className="app">
      <input
        ref={inputRef}
        className="hidden-input"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />

      <header className="header">
        <h1>Qwerty Learner Mini</h1>
        <p>外研版七上 · 看释义打单词/短语</p>
      </header>

      <nav className="chips" aria-label="选择练习单元">
        {UNITS.map((u) => (
          <button key={u.id} className={`chip ${unit === u.id ? 'on' : ''}`} onClick={() => setUnit(u.id)}>
            {u.label}
          </button>
        ))}
      </nav>
      <p className="pool-info">当前词库：{pool.length} 词</p>

      {state.finished ? (
        <section className="card finished">
          <h2>🎉 全部完成！</h2>
          <div className="stats">
            <div className="stat">
              <b>{state.correct}</b>
              <span>正确</span>
            </div>
            <div className="stat">
              <b>{state.wrong}</b>
              <span>错误</span>
            </div>
            <div className="stat">
              <b>{accuracy}%</b>
              <span>准确率</span>
            </div>
            <div className="stat">
              <b>{wpm}</b>
              <span>WPM</span>
            </div>
          </div>
          <button className="primary" onClick={() => restart()}>
            再来一轮（Enter）
          </button>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="progress">
              {Math.min(state.wordIndex + 1, list.length)} / {list.length}
            </div>
            <WordView word={current.word} typed={state.typed} wrongKey={state.wrongKey} />
            <div className="meaning">
              <span className="unit-tag">{current.unit}</span>
              {current.meaning}
            </div>
          </section>

          <div className="stats">
            <div className="stat">
              <b className="green">{state.correct}</b>
              <span>正确</span>
            </div>
            <div className="stat">
              <b className="red">{state.wrong}</b>
              <span>错误</span>
            </div>
            <div className="stat">
              <b>{accuracy}%</b>
              <span>准确率</span>
            </div>
            <div className="stat">
              <b>{wpm}</b>
              <span>WPM</span>
            </div>
          </div>

          <div className="controls">
            <button className="primary" onClick={() => restart()}>
              重新开始
            </button>
            <button className={orderMode === 'order' ? 'on' : ''} onClick={() => restart('order')}>
              顺序
            </button>
            <button className={orderMode === 'random' ? 'on' : ''} onClick={() => restart('random')}>
              随机
            </button>
            <button className={strict ? 'on' : ''} onClick={toggleStrict}>
              严格模式{strict ? '开' : '关'}
            </button>
          </div>

          <p className="tips">
            大小写不敏感 · 短语中的空格用空格键输入 · 空格也可跳到下一词 · 打错需退格（严格模式）
          </p>
        </>
      )}
    </div>
  )
}
