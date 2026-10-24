import { useEffect, useMemo, useRef, useState } from 'react'
import type { Word } from '../data/words'
import { speak } from '../lib/speech'
import { playCorrect, playWrong } from '../lib/sound'
import { pickDistractors, shuffled } from '../lib/util'
import type { ModeProps } from './index'

interface ChoiceProps extends ModeProps {
  /** 干扰项来源词池（同单元优先） */
  pool: Word[]
}

/** 模式三：选择题速刷——看英文选中文释义 */
export function ChoiceMode({ word, pool, settings, onResult, advance }: ChoiceProps) {
  const [picked, setPicked] = useState<string | null>(null)
  const advanceRef = useRef(advance)
  advanceRef.current = advance
  const timerRef = useRef<number | null>(null)
  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current) }, [])

  const options = useMemo(() => {
    // 与其它选项文案可能重复的极端情况下也保证 4 个按钮
    const distractors = pickDistractors(word, pool)
    const extra = pool.filter((w) => w.word !== word.word && !distractors.includes(w))
    while (distractors.length < 3 && extra.length > 0) distractors.push(extra.shift()!)
    return shuffled([word, ...distractors.slice(0, 3)])
  }, [word, pool])

  // 自动读题
  useEffect(() => {
    if (settings.autoRead) speak(word.word, { rate: settings.rate, volume: settings.volume })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (opt: Word) => {
    if (picked !== null) return
    const correct = opt.word === word.word
    setPicked(opt.word)
    onResult(correct)
    if (correct) {
      playCorrect()
      if (settings.autoRead) speak(word.word, { rate: settings.rate, volume: settings.volume })
    } else {
      playWrong()
      speak(word.word, { rate: settings.rate, volume: settings.volume })
    }
    timerRef.current = window.setTimeout(() => advanceRef.current(), correct ? 450 : 1600)
  }

  return (
    <div className="mode choice-mode">
      <div className="prompt center">
        <span className="unit-tag">{word.unit}</span>
        <p className="choice-word">{word.word}</p>
        <button
          className="round-btn small"
          aria-label="朗读"
          onClick={() => speak(word.word, { rate: settings.rate, volume: settings.volume })}
        >
          🔊
        </button>
      </div>

      <div className="options" role="listbox" aria-label="选择正确释义">
        {options.map((o) => {
          const isAnswer = o.word === word.word
          const state = picked === null ? '' : isAnswer ? 'right' : picked === o.word ? 'wrong' : 'faded'
          return (
            <button key={o.word} className={`option ${state}`} onClick={() => choose(o)} disabled={picked !== null}>
              {o.meaning}
            </button>
          )
        })}
      </div>

      <div className="feedback" aria-live="polite">
        {picked === null ? (
          <span className="dim">选出正确的中文释义</span>
        ) : picked === word.word ? (
          <span className="ok">✓ 正确！</span>
        ) : (
          <span className="bad">✗ 正确答案：{word.meaning}</span>
        )}
      </div>
    </div>
  )
}
