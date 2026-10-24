import { describe, expect, it } from 'vitest'
import {
  BOX_INTERVAL_DAYS,
  boxAfterCorrect,
  boxAfterWrong,
  buildQueue,
  computeStreak,
  DAY_MS,
  dayKey,
  isDue,
  masteryOf,
  MAX_BOX,
} from './srs'

const NOW = new Date(2024, 0, 5, 9, 0, 0).getTime() // 2024-01-05 09:00 本地时间

describe('dayKey', () => {
  it('生成本地时区 YYYY-MM-DD', () => {
    expect(dayKey(NOW)).toBe('2024-01-05')
    expect(dayKey(new Date(2023, 11, 31, 23, 59))).toBe('2023-12-31')
  })
})

describe('boxAfterCorrect', () => {
  it('新词首次答对进盒 2，1 天后到期', () => {
    const r = boxAfterCorrect(undefined, NOW)
    expect(r.box).toBe(2)
    expect(r.dueAt).toBe(NOW + BOX_INTERVAL_DAYS[2] * DAY_MS)
  })

  it('逐盒上升且间隔为 1/3/7/14 天', () => {
    for (const from of [1, 2, 3, 4] as const) {
      const r = boxAfterCorrect({ box: from, dueAt: NOW }, NOW)
      expect(r.box).toBe(from + 1)
      expect(r.dueAt).toBe(NOW + BOX_INTERVAL_DAYS[from + 1] * DAY_MS)
    }
    expect(BOX_INTERVAL_DAYS[2]).toBe(1)
    expect(BOX_INTERVAL_DAYS[3]).toBe(3)
    expect(BOX_INTERVAL_DAYS[4]).toBe(7)
    expect(BOX_INTERVAL_DAYS[5]).toBe(14)
  })

  it('盒 5 答对保持盒 5，再隔 14 天', () => {
    const r = boxAfterCorrect({ box: 5, dueAt: NOW }, NOW)
    expect(r.box).toBe(MAX_BOX)
    expect(r.dueAt).toBe(NOW + 14 * DAY_MS)
  })

  it('异常数据（越界盒子）会被纠正', () => {
    expect(boxAfterCorrect({ box: 99, dueAt: NOW }, NOW).box).toBe(MAX_BOX)
    expect(boxAfterCorrect({ box: 0, dueAt: NOW }, NOW).box).toBe(2)
  })
})

describe('boxAfterWrong', () => {
  it('任何盒答错都回盒 1 并立刻到期', () => {
    expect(boxAfterWrong(NOW)).toEqual({ box: 1, dueAt: NOW })
    // 与之前所在盒子无关
    expect(boxAfterWrong(NOW + 999)).toEqual({ box: 1, dueAt: NOW + 999 })
  })
})

describe('isDue / masteryOf', () => {
  it('dueAt <= now 视为到期', () => {
    expect(isDue({ box: 2, dueAt: NOW }, NOW)).toBe(true)
    expect(isDue({ box: 2, dueAt: NOW + 1 }, NOW)).toBe(false)
    expect(isDue(undefined, NOW)).toBe(false)
  })

  it('掌握度：未学为 0，学过等于所在盒', () => {
    expect(masteryOf(undefined)).toBe(0)
    expect(masteryOf({ box: 3, dueAt: NOW })).toBe(3)
  })
})

describe('computeStreak', () => {
  const mk = (n: number) => ({ completed: n })

  it('无记录为 0', () => {
    expect(computeStreak({}, NOW)).toBe(0)
  })

  it('今天练过按今天起算', () => {
    expect(computeStreak({ '2024-01-05': mk(3) }, NOW)).toBe(1)
  })

  it('连续天数跨昨天', () => {
    expect(computeStreak({ '2024-01-05': mk(1), '2024-01-04': mk(2) }, NOW)).toBe(2)
    expect(computeStreak({ '2024-01-05': mk(1), '2024-01-04': mk(2), '2024-01-03': mk(1) }, NOW)).toBe(3)
  })

  it('今天还没练不打断昨天的连胜', () => {
    expect(computeStreak({ '2024-01-04': mk(2), '2024-01-03': mk(1) }, NOW)).toBe(2)
  })

  it('断档后重新计数，completed=0 不算', () => {
    expect(computeStreak({ '2024-01-05': mk(1), '2024-01-03': mk(1) }, NOW)).toBe(1)
    expect(computeStreak({ '2024-01-05': mk(0) }, NOW)).toBe(0)
  })
})

describe('buildQueue', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f']

  it('到期词在前且按到期时间升序，新词在后', () => {
    const progress = {
      a: { box: 2, dueAt: NOW - 3 * DAY_MS }, // 更早到期，排最前
      b: { box: 3, dueAt: NOW }, // 今天到期
      c: { box: 3, dueAt: NOW + DAY_MS }, // 未到期，不进队列
    }
    const r = buildQueue({ items, keyOf: (x) => x, progress, now: NOW, dailyNew: 10 })
    expect(r.queue).toEqual(['a', 'b', 'd', 'e', 'f'])
    expect(r.dueCount).toBe(2)
    expect(r.newCount).toBe(3)
  })

  it('新词数量受每日额度限制', () => {
    const r = buildQueue({ items, keyOf: (x) => x, progress: {}, now: NOW, dailyNew: 2 })
    expect(r.queue).toEqual(['a', 'b'])
    expect(r.newCount).toBe(2)
  })

  it('今天已练的新词占用额度', () => {
    const r = buildQueue({ items, keyOf: (x) => x, progress: {}, now: NOW, dailyNew: 3, newToday: 1 })
    expect(r.newCount).toBe(2)
  })

  it('额度用完后只出到期词', () => {
    const progress = { a: { box: 1, dueAt: NOW } }
    const r = buildQueue({ items, keyOf: (x) => x, progress, now: NOW, dailyNew: 5, newToday: 5 })
    expect(r.queue).toEqual(['a'])
    expect(r.newCount).toBe(0)
  })
})
