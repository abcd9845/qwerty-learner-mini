/**
 * Leitner 5 盒记忆算法（纯函数，无副作用，便于单元测试）。
 *
 * 盒子与复习间隔：
 *   盒 1：当天/下次练习就到期（答错回盒 1）
 *   盒 2：1 天后到期
 *   盒 3：3 天后到期
 *   盒 4：7 天后到期
 *   盒 5：14 天后到期（已掌握，答对保持盒 5）
 *
 * 答对：升一盒（盒 5 封顶），按新盒间隔安排下次复习。
 * 答错：回到盒 1，立即到期。
 */

export const MAX_BOX = 5

/** 各盒子答对后的到期间隔（天）。盒 1 不会停留：答对至少进盒 2。 */
export const BOX_INTERVAL_DAYS: Readonly<Record<number, number>> = {
  1: 0,
  2: 1,
  3: 3,
  4: 7,
  5: 14,
}

export const DAY_MS = 86_400_000

/** 单词的记忆状态（掌握度 = box，0 表示没学过） */
export interface SrsState {
  box: number
  /** 到期时间戳（ms）。盒 1 为「立刻到期」。 */
  dueAt: number
}

/** 存储层使用的完整进度记录 */
export interface WordProgress extends SrsState {
  correct: number
  wrong: number
  lastResult: 'correct' | 'wrong'
  lastAt: number
}

function clampBox(box: number): number {
  return Math.min(Math.max(Math.round(box), 1), MAX_BOX)
}

/** 本地时区的日期键，如 2024-01-05 */
export function dayKey(now: number | Date): string {
  const d = now instanceof Date ? now : new Date(now)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 答对：升一盒（封顶盒 5），按新盒的间隔安排到期 */
export function boxAfterCorrect(prev: SrsState | undefined, now: number): SrsState {
  const from = clampBox(prev?.box ?? 1)
  const box = Math.min(from + 1, MAX_BOX)
  const days = BOX_INTERVAL_DAYS[box] ?? 0
  return { box, dueAt: days > 0 ? now + days * DAY_MS : now }
}

/** 答错：回盒 1，立刻到期 */
export function boxAfterWrong(now: number): SrsState {
  return { box: 1, dueAt: now }
}

/** 是否到期（含当天盒 1 的「立刻到期」） */
export function isDue(state: SrsState | undefined, now: number): boolean {
  if (!state) return false
  return state.dueAt <= now
}

/** 掌握度 0~5：没学过为 0，学过即为所在盒子 */
export function masteryOf(state: SrsState | undefined): number {
  if (!state) return 0
  return clampBox(state.box)
}

/**
 * 连续打卡天数：从今天往回数「完成数 > 0」的连续天数；
 * 今天还没练时不打断连胜（从昨天往回数）。
 */
export function computeStreak(daily: Record<string, { completed: number }>, now: number = Date.now()): number {
  const d = new Date(now)
  if (!(daily[dayKey(d)]?.completed > 0)) d.setDate(d.getDate() - 1)
  let streak = 0
  while (daily[dayKey(d)]?.completed > 0) {
    streak += 1
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/** 每日新词数的「不限」哨兵值：0 表示不限制新词额度（可序列化，Infinity 不行） */
export const DAILY_NEW_UNLIMITED = 0

export interface QueueOptions<T> {
  items: T[]
  keyOf: (item: T) => string
  progress: Record<string, SrsState>
  now: number
  /** 每日新词上限；0（DAILY_NEW_UNLIMITED）= 不限，今日新词全部入队 */
  dailyNew: number
  /** 今天已经练过的新词数（占额度）；不限模式下无意义 */
  newToday?: number
}

export interface QueueResult<T> {
  /** 到期词在前（按到期时间升序），新词在后 */
  queue: T[]
  dueCount: number
  newCount: number
}

/** 生成「今日队列」：先出到期词，再补新词（每日新词 0 = 不限时全补，否则不超过额度） */
export function buildQueue<T>(opts: QueueOptions<T>): QueueResult<T> {
  const seen: T[] = []
  const fresh: T[] = []
  for (const it of opts.items) {
    if (opts.progress[opts.keyOf(it)]) seen.push(it)
    else fresh.push(it)
  }

  const due = seen
    .filter((it) => isDue(opts.progress[opts.keyOf(it)]!, opts.now))
    .sort((a, b) => opts.progress[opts.keyOf(a)]!.dueAt - opts.progress[opts.keyOf(b)]!.dueAt)

  // 不限（0）时额度视为 Infinity：新词全量入队，newToday 不再占用额度
  const allowance = opts.dailyNew === DAILY_NEW_UNLIMITED ? Infinity : Math.max(0, opts.dailyNew - (opts.newToday ?? 0))
  const news = fresh.slice(0, allowance)

  return { queue: [...due, ...news], dueCount: due.length, newCount: news.length }
}
