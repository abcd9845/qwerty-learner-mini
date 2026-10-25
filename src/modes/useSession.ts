import { useState } from 'react'
import { WORDS, type Word } from '../data/words'
import { orderPool, poolOf, todayInfo } from '../lib/pool'
import { getData, recordAnswer, wordKey, type ModeId } from '../lib/storage'

export type SessionSource = 'today' | 'free' | 'mistakes'

/** 自由练习一轮的词数上限，避免队列过长 */
const FREE_CAP = 30

export interface SessionStats {
  correct: number
  wrong: number
}

function buildQueueFor(src: SessionSource, mode: ModeId): Word[] {
  const d = getData()
  // 出题顺序跟随设置：shuffle 开 = 随机；关 = 课本顺序（到期复习仍优先于新词）
  if (src === 'mistakes') {
    return orderPool(WORDS.filter((w) => d.mistakes[wordKey(w.word)] !== undefined), d.settings.shuffle)
  }
  let pool = poolOf(d.settings.units)
  if (mode === 'cloze') pool = pool.filter((w) => w.word.includes(' '))
  if (src === 'free') return orderPool(pool, d.settings.shuffle).slice(0, FREE_CAP)
  return todayInfo(d, pool).queue
}

/**
 * 一次练习会话：
 * - today：今日队列（到期词优先 + 新词）
 * - free：自由练习（所选单元随机，上限 30 词）
 * - mistakes：错题本专项练习（答对即移出错题本）
 */
export function useSession(source: SessionSource, mode: ModeId) {
  // 队列只在会话开始（或「再练一轮」seed 变化）时构建一次
  const [queue] = useState<Word[]>(() => buildQueueFor(source, mode))
  const [index, setIndex] = useState(0)
  const [stats, setStats] = useState<SessionStats>({ correct: 0, wrong: 0 })

  const answer = (correct: boolean) => {
    const w = queue[index]
    if (!w) return
    recordAnswer(w, correct, source === 'mistakes' ? 'mistakes' : 'normal')
    setStats((s) => ({ correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1) }))
  }

  const next = () => setIndex((i) => i + 1)

  return {
    queue,
    index,
    current: queue[index] ?? null,
    stats,
    answer,
    next,
    finished: index >= queue.length,
  }
}
