import { useEffect, useMemo, useRef, useState } from 'react'
import { WORDS, type Word } from '../data/words'
import { useKeyboardInput } from '../components/HiddenInput'
import { Slots } from '../components/Slots'
import { speak } from '../lib/speech'
import { wordKey } from '../lib/storage'
import { useTypeAnswer } from './useTypeAnswer'
import type { ModeProps } from './index'

const WORD_BY_KEY = new Map(WORDS.map((w) => [wordKey(w.word), w]))

export interface Cloze {
  before: string
  keyword: string
  after: string
  /** 挖掉的关键词的中文释义（词表里没有独立词条时用整条释义） */
  hint: string
}

/** 从短语/句子里挖掉一个关键词：优先挖「词表里有独立释义」的最长单词 */
export function buildCloze(entry: Word): Cloze | null {
  if (!entry.word.includes(' ')) return null
  const tokens = [...entry.word.matchAll(/[A-Za-z']+/g)]
  if (tokens.length === 0) return null
  let best: { text: string; index: number } | null = null
  let fallback: { text: string; index: number } | null = null
  for (const m of tokens) {
    const t = { text: m[0], index: m.index ?? 0 }
    if (!fallback || t.text.length > fallback.text.length) fallback = t
    if (WORD_BY_KEY.has(wordKey(t.text)) && (!best || t.text.length > best.text.length)) best = t
  }
  const chosen = best ?? fallback!
  const standalone = best ? WORD_BY_KEY.get(wordKey(chosen.text)) : undefined
  return {
    before: entry.word.slice(0, chosen.index),
    keyword: chosen.text,
    after: entry.word.slice(chosen.index + chosen.text.length),
    hint: standalone ? standalone.meaning : entry.meaning,
  }
}

/** 模式四：句子/短语填空——挖掉关键词，按提示补全 */
export function ClozeMode({ word, settings, onResult, advance }: ModeProps) {
  // 兜底：万一遇到非句子条目，退化为整词默写
  const cloze = useMemo<Cloze>(
    () => buildCloze(word) ?? { before: '', keyword: word.word, after: '', hint: word.meaning },
    [word],
  )
  const [result, setResult] = useState<boolean | null>(null)
  const advanceRef = useRef(advance)
  advanceRef.current = advance
  const timerRef = useRef<number | null>(null)
  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current) }, [])

  const onDone = (errors: number) => {
    const correct = errors === 0
    onResult(correct)
    setResult(correct)
    if (!correct || settings.autoRead) speak(word.word, { rate: settings.rate, volume: settings.volume })
    timerRef.current = window.setTimeout(() => advanceRef.current(), correct ? 550 : 1000)
  }
  const onReveal = () => speak(cloze.keyword, { rate: settings.rate, volume: settings.volume })

  const { typed, hint, flash, done, onChar, onBackspace } = useTypeAnswer(cloze.keyword, onDone, onReveal)
  // 把当前词的回调注册给练习层的常驻隐藏 input（切词时组件重挂载、回调自动更新）
  useKeyboardInput({ onChar, onBackspace })

  const skip = () => {
    if (done || result !== null) return
    onResult(false)
    setResult(false)
    speak(word.word, { rate: settings.rate, volume: settings.volume })
    timerRef.current = window.setTimeout(() => advanceRef.current(), 1100)
  }

  return (
    <div className="mode cloze-mode">
      <div className="prompt">
        <span className="unit-tag">{word.unit}</span>
        <p className="meaning-text">补全挖掉的单词 · 提示：{cloze.hint}</p>
      </div>

      <p className="cloze-sentence">
        {cloze.before && <span className="cloze-text">{cloze.before}</span>}
        <Slots target={cloze.keyword} typed={typed} hint={hint} flash={flash} />
        {cloze.after && <span className="cloze-text">{cloze.after}</span>}
      </p>

      <div className="feedback" aria-live="polite">
        {result === true ? (
          <span className="ok">✓ 正确！</span>
        ) : result === false ? (
          <span className="bad">✗ 答案：{cloze.keyword}</span>
        ) : hint === 2 ? (
          <span className="warn">照着答案重打一遍 ✍️</span>
        ) : hint === 1 ? (
          <span className="warn">已提示首字母，从头再输一次</span>
        ) : (
          <span className="dim">输入挖掉的单词</span>
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
