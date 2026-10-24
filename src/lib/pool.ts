import { WORDS, type Unit, type Word } from '../data/words'
import { buildQueue, dayKey, type QueueResult } from './srs'
import { ALL_UNITS, wordKey, type AppData } from './storage'

/** 按设置的单元筛选词池（空选择视为全部） */
export function poolOf(units: Unit[]): Word[] {
  const list = units.length > 0 ? units : ALL_UNITS
  return WORDS.filter((w) => list.includes(w.unit))
}

/** 今日队列：到期词优先，其次新词（受每日新词额度限制） */
export function todayInfo(data: AppData, pool: Word[]): QueueResult<Word> {
  return buildQueue({
    items: pool,
    keyOf: (w) => wordKey(w.word),
    progress: data.progress,
    now: Date.now(),
    dailyNew: data.settings.dailyNew,
    newToday: data.daily[dayKey(Date.now())]?.newWords ?? 0,
  })
}
