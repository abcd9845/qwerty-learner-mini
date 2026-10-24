import {
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useAppData, type ModeId } from '../lib/storage'
import { poolOf } from '../lib/pool'
import { HiddenInput, KeyboardContext, type KeyboardHandlers } from '../components/HiddenInput'
import { ChoiceMode } from './ChoiceMode'
import { ClozeMode } from './ClozeMode'
import { DictationMode } from './DictationMode'
import { ListeningMode } from './ListeningMode'
import { MODES, modeName } from './index'
import { useSession, type SessionSource } from './useSession'

/** 练习外壳：顶栏 + 进度 + 模式切换渲染 + 结算页。key 变化即重开会话。 */
export function Practice({ mode, source, onExit }: { mode: ModeId; source: SessionSource; onExit: () => void }) {
  const [run, setRun] = useState<{ id: number; source: SessionSource }>({ id: 0, source })
  return (
    <PracticeRun
      key={run.id}
      mode={mode}
      source={run.source}
      onExit={onExit}
      onRestart={(next) => setRun((r) => ({ id: r.id + 1, source: next }))}
    />
  )
}

/** 练习层常驻键盘的空回调（未进入打字模式前占位） */
const NOOP_HANDLERS: KeyboardHandlers = { onChar: () => {}, onBackspace: () => {} }

function PracticeRun({
  mode,
  source,
  onExit,
  onRestart,
}: {
  mode: ModeId
  source: SessionSource
  onExit: () => void
  onRestart: (next: SessionSource) => void
}) {
  const session = useSession(source, mode)
  const data = useAppData()
  const pool = useMemo(() => poolOf(data.settings.units), [data.settings.units])

  // 常驻隐藏 input：整个会话只挂载一次，切词只换回调不换 DOM，焦点/软键盘不丢（详见 HiddenInput 注释）
  const bridge = useRef<KeyboardHandlers>(NOOP_HANDLERS)
  const inputRef = useRef<HTMLInputElement>(null)
  const needsInput = MODES.find((m) => m.id === mode)?.needsInput ?? true

  /** 练习区域内任意点击都聚焦输入框（点击处于用户手势内，iOS 才肯弹键盘） */
  const focusInput = () => inputRef.current?.focus({ preventScroll: true })
  /** 按钮/下拉/链接不抢焦点：preventDefault 掉默认聚焦（click 仍会触发），键盘保持升起 */
  const keepFocus = (e: ReactPointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, select, textarea, a[href]')) e.preventDefault()
  }

  const total = session.queue.length
  const doneCount = Math.min(session.index, total)
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const answered = session.stats.correct + session.stats.wrong
  const accuracy = answered > 0 ? Math.round((session.stats.correct / answered) * 100) : 100

  if (total === 0) {
    const reason = source === 'mistakes' ? '错题本是空的，答错的词会自动收进来。' : '所选单元里没有可练习的词，去设置里调整单元范围吧。'
    return (
      <div className="page practice">
        <header className="topbar">
          <button className="icon-btn" onClick={onExit} aria-label="返回">←</button>
          <h1 className="topbar-title">{modeName(mode)}</h1>
          <div className="topbar-right" />
        </header>
        <section className="card empty">
          <p className="empty-icon">🌤️</p>
          <p>{reason}</p>
          <button className="primary" onClick={onExit}>返回首页</button>
        </section>
      </div>
    )
  }

  if (session.finished) {
    return (
      <div className="page practice">
        <header className="topbar">
          <button className="icon-btn" onClick={onExit} aria-label="返回">←</button>
          <h1 className="topbar-title">{modeName(mode)}</h1>
          <div className="topbar-right" />
        </header>
        <section className="card finished">
          <h2>{source === 'today' ? '🎉 今日任务完成' : source === 'mistakes' ? '📕 错题练习完成' : '👏 本轮练习完成'}</h2>
          <div className="stat-cards">
            <div className="stat-card"><b>{session.stats.correct}</b><span>答对</span></div>
            <div className="stat-card"><b className="bad">{session.stats.wrong}</b><span>答错</span></div>
            <div className="stat-card"><b>{accuracy}%</b><span>正确率</span></div>
          </div>
          <div className="btn-col">
            <button className="primary" onClick={() => onRestart('free')}>再练一轮（自由练习）</button>
            <button className="ghost-btn" onClick={onExit}>返回首页</button>
          </div>
        </section>
      </div>
    )
  }

  const w = session.current!
  const modeProps = { word: w, settings: data.settings, onResult: session.answer, advance: session.next }

  return (
    <KeyboardContext.Provider value={bridge}>
      <div
        className="page practice"
        onClick={needsInput ? focusInput : undefined}
        onPointerDown={keepFocus}
        onMouseDown={keepFocus}
      >
        <header className="topbar">
          <button className="icon-btn" onClick={onExit} aria-label="返回">←</button>
          <h1 className="topbar-title">{modeName(mode)}</h1>
          <div className="topbar-right progress-text">{doneCount + 1} / {total}</div>
        </header>
        <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>

        <main className="practice-main" key={`${session.index}:${w.word}`}>
          {mode === 'dictation' && <DictationMode {...modeProps} />}
          {mode === 'listening' && <ListeningMode {...modeProps} />}
          {mode === 'choice' && <ChoiceMode {...modeProps} pool={pool} />}
          {mode === 'cloze' && <ClozeMode {...modeProps} />}
        </main>

        <footer className="session-stats">
          <span className="ok">✓ {session.stats.correct}</span>
          <span className="bad">✗ {session.stats.wrong}</span>
          <span className="dim">{accuracy}%</span>
        </footer>

        {/* 常驻隐藏输入：放在按词重挂载的 <main> 之外，切词不重挂载 */}
        {needsInput && <HiddenInput inputRef={inputRef} />}
      </div>
    </KeyboardContext.Provider>
  )
}
