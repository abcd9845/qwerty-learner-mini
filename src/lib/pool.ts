import { WORDS, type Unit, type Word } from '../data/words'
import { buildQueue, dayKey, type QueueResult } from './srs'
import { ALL_UNITS, wordKey, type AppData } from './storage'
import { shuffled } from './util'

/**
 * 按设置的单元筛选词池（空选择视为全部）。
 * 结果保持课本顺序：Starter→Unit 1→…→Unit 6，单元内按 words.ts 原顺序。
 */
export function poolOf(units: Unit[]): Word[] {
  const list = units.length > 0 ? units : ALL_UNITS
  return WORDS.filter((w) => list.includes(w.unit))
}

/** 出题顺序：shuffle 开 = 随机打乱；关 = 课本顺序（自由练习 / 错题练习用）。 */
export function orderPool(pool: Word[], shuffle: boolean): Word[] {
  return shuffle ? shuffled(pool) : [...pool]
}

/**
 * 今日队列：到期词优先，其次新词（受每日新词额度限制）。
 * shuffle 开：到期、新词两组各自随机（到期仍整体在前）；
 * shuffle 关：两组各自按课本顺序。
 */
export function todayInfo(data: AppData, pool: Word[]): QueueResult<Word> {
  const r = buildQueue({
    items: pool,
    keyOf: (w) => wordKey(w.word),
    progress: data.progress,
    now: Date.now(),
    dailyNew: data.settings.dailyNew,
    newToday: data.daily[dayKey(Date.now())]?.newWords ?? 0,
  })

  const order = (list: Word[]): Word[] => {
    if (data.settings.shuffle) return shuffled(list)
    const rank = new Map(pool.map((w, i) => [w, i]))
    return [...list].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))
  }

  const due = order(r.queue.slice(0, r.dueCount))
  const fresh = order(r.queue.slice(r.dueCount))
  return { ...r, queue: [...due, ...fresh] }
}
