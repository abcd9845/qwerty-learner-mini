import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Word } from './words'

export type OrderMode = 'order' | 'random'

export interface GameState {
  wordIndex: number
  /** 当前词已正确输入的字符数 */
  typed: number
  /** 严格模式下打错时记录错误按键，需退格清除 */
  wrongKey: string | null
  correct: number
  wrong: number
  finished: boolean
}

const INITIAL: GameState = {
  wordIndex: 0,
  typed: 0,
  wrongKey: null,
  correct: 0,
  wrong: 0,
  finished: false,
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 词库里只含可打印 ASCII：字母、空格和 . ' - ? + ! , ( ) 等标点 */
function isTypableChar(key: string): boolean {
  return key.length === 1 && key >= ' ' && key <= '~'
}

export function useTyping(pool: Word[]) {
  // 核心状态放在 ref 里，保证快速连续按键时读到的一定是最新值
  const stateRef = useRef<GameState>({ ...INITIAL })
  const poolRef = useRef<Word[]>(pool)
  const listRef = useRef<Word[]>(pool)
  const strictRef = useRef(true)
  const orderModeRef = useRef<OrderMode>('order')
  const startRef = useRef<number | null>(null)
  const finishedRef = useRef(false)
  const [, bump] = useReducer((x: number) => x + 1, 0)

  const [list, setList] = useState<Word[]>(pool)
  const [strict, setStrict] = useState(true)
  const [orderMode, setOrderMode] = useState<OrderMode>('order')
  const [elapsed, setElapsed] = useState(0)

  const setGame = useCallback((fn: (s: GameState) => GameState) => {
    stateRef.current = fn(stateRef.current)
    finishedRef.current = stateRef.current.finished
    bump()
  }, [])

  const restart = useCallback((mode?: OrderMode) => {
    const m = mode ?? orderModeRef.current
    orderModeRef.current = m
    const src = poolRef.current
    listRef.current = m === 'order' ? src : shuffled(src)
    setList(listRef.current)
    setOrderMode(m)
    stateRef.current = { ...INITIAL }
    finishedRef.current = false
    startRef.current = null
    setElapsed(0)
    bump()
  }, [])

  // 切换单元（词池变化）时重置练习
  useEffect(() => {
    poolRef.current = pool
    restart(orderModeRef.current)
  }, [pool, restart])

  const toggleStrict = useCallback(() => {
    strictRef.current = !strictRef.current
    setStrict(strictRef.current)
  }, [])

  // 计时：从第一次有效按键开始，结束后停止
  useEffect(() => {
    const id = window.setInterval(() => {
      if (startRef.current !== null && !finishedRef.current) {
        setElapsed((Date.now() - startRef.current) / 1000)
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [])

  // 全局按键处理
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
      const s = stateRef.current

      if (s.finished) {
        if (e.key === 'Enter') restart()
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        setGame((p) => (p.wrongKey ? { ...p, wrongKey: null } : { ...p, typed: Math.max(0, p.typed - 1) }))
        return
      }
      if (!isTypableChar(e.key)) return
      if (s.wrongKey) return // 严格模式：等待退格

      const word = listRef.current[s.wordIndex]
      const expected = word.word[s.typed]
      if (expected === undefined) return

      if (e.key === ' ') {
        e.preventDefault()
        if (expected === ' ') {
          // 短语里的空格：按空格键输入
          if (startRef.current === null) startRef.current = Date.now()
          setGame((p) => ({ ...p, correct: p.correct + 1, typed: p.typed + 1 }))
          return
        }
        // 非空格位置：跳到下一个词
        setGame((p) => {
          const wordIndex = p.wordIndex + 1
          if (wordIndex >= listRef.current.length) return { ...p, typed: 0, wrongKey: null, finished: true }
          return { ...p, wordIndex, typed: 0, wrongKey: null }
        })
        return
      }

      // 大小写不敏感比较（专有名词无需按 Shift 也能输入）
      if (expected.toLowerCase() === e.key.toLowerCase()) {
        if (startRef.current === null) startRef.current = Date.now()
        setGame((p) => {
          const typed = p.typed + 1
          const correct = p.correct + 1
          if (typed >= word.word.length) {
            // 打完当前词，自动进入下一个
            const wordIndex = p.wordIndex + 1
            if (wordIndex >= listRef.current.length) {
              return { ...p, correct, typed: 0, wrongKey: null, finished: true }
            }
            return { ...p, correct, typed: 0, wrongKey: null, wordIndex }
          }
          return { ...p, correct, typed }
        })
      } else {
        setGame((p) => ({
          ...p,
          wrong: p.wrong + 1,
          wrongKey: strictRef.current ? e.key : null,
        }))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [restart, setGame])

  const s = stateRef.current
  const total = s.correct + s.wrong
  const accuracy = total === 0 ? 100 : Math.round((s.correct / total) * 100)
  const minutes = elapsed / 60
  const wpm = minutes > 0 ? Math.round(s.correct / 5 / minutes) : 0

  return {
    list,
    state: s,
    strict,
    orderMode,
    elapsed,
    accuracy,
    wpm,
    restart,
    toggleStrict,
  }
}
