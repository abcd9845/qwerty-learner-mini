import { useRef, useState } from 'react'
import { playCorrect, playKey, playWrong } from '../lib/sound'
import { charMatches } from '../lib/util'

export interface TypeState {
  /** 已正确输入的字符数 */
  typed: number
  /** 本词拼错次数 */
  errors: number
  /** 提示级别：0 无 / 1 首字母+长度 / 2 完整答案（需重打） */
  hint: 0 | 1 | 2
  done: boolean
}

const INITIAL: TypeState = { typed: 0, errors: 0, hint: 0, done: false }

/**
 * 打字答题状态机（看中文默写 / 听音默写 / 句子填空共用）：
 * - 首次错误：提示首字母和长度（a _ _ _），从头再输
 * - 再次错误：显示完整答案，要求重打一遍才能继续
 * - 全部输对：onDone(errors)，errors===0 记为答对
 *
 * 状态放 ref、视图放 useState，保证副作用（音效/回调）不放进更新器。
 */
export function useTypeAnswer(target: string, onDone: (errors: number) => void, onReveal?: () => void) {
  const ref = useRef<TypeState>({ ...INITIAL })
  const [view, setView] = useState<TypeState>({ ...INITIAL })
  const [flash, setFlash] = useState(0)
  const cbRef = useRef({ onDone, onReveal })
  cbRef.current = { onDone, onReveal }

  const apply = (next: TypeState) => {
    ref.current = next
    setView(next)
  }

  const onChar = (ch: string) => {
    const s = ref.current
    if (s.done) return
    const expected = target[s.typed]
    if (expected === undefined) return

    if (charMatches(expected, ch)) {
      playKey()
      const typed = s.typed + 1
      if (typed >= target.length) {
        playCorrect()
        apply({ ...s, typed, done: true })
        cbRef.current.onDone(s.errors)
      } else {
        apply({ ...s, typed })
      }
      return
    }

    // 输错
    playWrong()
    setFlash((f) => f + 1)
    if (s.hint === 2) {
      // 重打阶段已显示答案：只抖动提醒，不重复计数
      return
    }
    const errors = s.errors + 1
    const hint: 0 | 1 | 2 = errors >= 2 ? 2 : 1
    if (hint === 2) cbRef.current.onReveal?.()
    apply({ ...s, typed: 0, errors, hint })
  }

  const onBackspace = () => {
    const s = ref.current
    if (s.done || s.typed === 0) return
    apply({ ...s, typed: s.typed - 1 })
  }

  return { ...view, flash, onChar, onBackspace }
}
