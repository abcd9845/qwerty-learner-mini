import { useEffect, useRef, useState } from 'react'
import { useKeyboardInput } from '../components/HiddenInput'
import { Slots } from '../components/Slots'
import { speak, speakSlow } from '../lib/speech'
import { useTypeAnswer } from './useTypeAnswer'
import type { ModeProps } from './index'

/**
 * 打字答题视图（看中文默写 / 听音默写共用）。
 * 组件以 key={word} 重挂载来重置状态。
 */
export function TypingPractice({ variant, word, settings, onResult, advance }: ModeProps & { variant: 'dictation' | 'listening' }) {
  const [result, setResult] = useState<boolean | null>(null)
  const advanceRef = useRef(advance)
  advanceRef.current = advance
  const timerRef = useRef<number | null>(null)
  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current) }, [])

  const finish = (correct: boolean, delay: number) => {
    if (result !== null) return
    onResult(correct)
    setResult(correct)
    // 答错必读，答对看自动朗读设置
    if (!correct || settings.autoRead) speak(word.word, { rate: settings.rate, volume: settings.volume })
    timerRef.current = window.setTimeout(() => advanceRef.current(), delay)
  }

  const onDone = (errors: number) => finish(errors === 0, errors === 0 ? 500 : 950)
  const onReveal = () => speak(word.word, { rate: settings.rate, volume: settings.volume })
  const { typed, hint, flash, onChar, onBackspace } = useTypeAnswer(word.word, onDone, onReveal)
  // 把当前词的回调注册给练习层的常驻隐藏 input（切词时组件重挂载、回调自动更新）
  useKeyboardInput({ onChar, onBackspace })

  // 听音模式：出新词自动朗读一次（组件按词重挂载，等价于每词一次）
  useEffect(() => {
    if (variant === 'listening') {
      speak(word.word, { rate: settings.rate, volume: settings.volume })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const skip = () => finish(false, 1000)

  return (
    <div className="mode typing-mode">
      {variant === 'dictation' ? (
        <div className="prompt">
          <span className="unit-tag">{word.unit}</span>
          <p className="meaning-text">{word.meaning}</p>
        </div>
      ) : (
        <div className="prompt">
          <div className="audio-btns">
            <button
              className="round-btn"
              onClick={() => speak(word.word, { rate: settings.rate, volume: settings.volume })}
            >
              🔊 播放
            </button>
            <button className="round-btn" onClick={() => speakSlow(word.word, settings.volume)}>
              🐢 慢速
            </button>
          </div>
          {settings.showChinese && <p className="meaning-text dim">{word.meaning}</p>}
        </div>
      )}

      <Slots target={word.word} typed={typed} hint={hint} flash={flash} />

      <div className="feedback" aria-live="polite">
        {result === true ? (
          <span className="ok">✓ 正确！</span>
        ) : result === false ? (
          <span className="bad">✗ 答案：{word.word}</span>
        ) : hint === 2 ? (
          <span className="warn">照着答案重打一遍 ✍️</span>
        ) : hint === 1 ? (
          <span className="warn">已提示首字母，从头再输一次</span>
        ) : (
          <span className="dim">输入英文拼写 · 大小写不敏感</span>
        )}
      </div>

      <div className="mode-actions">
        <button className="ghost-btn" onClick={skip}>
          跳过（算错）
        </button>
      </div>
    </div>
  )
}
