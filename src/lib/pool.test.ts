import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/words'
import { DAY_MS } from './srs'
import { orderPool, poolOf, todayInfo } from './pool'
import { ALL_UNITS, wordKey, type AppData, type Settings } from './storage'

/** 造一份当前用户数据（默认全单元、每日新词额度足够大，方便看全队列） */
function mkData(settings: Partial<Settings> = {}, progress: AppData['progress'] = {}): AppData {
  return {
    version: 1,
    settings: {
      units: [...ALL_UNITS],
      dailyNew: 300,
      autoRead: true,
      showChinese: false,
      rate: 0.85,
      volume: 1,
      keySound: false,
      shuffle: true,
      lastMode: 'dictation',
      ...settings,
    },
    progress,
    daily: {},
    mistakes: {},
  }
}

describe('poolOf', () => {
  it('只包含选中单元，且保持课本顺序（与 words.ts 原顺序一致）', () => {
    const pool = poolOf(['Unit 2', 'Starter']) // 故意乱序传入
    expect(pool).toEqual(WORDS.filter((w) => w.unit === 'Starter' || w.unit === 'Unit 2'))
  })

  it('空选择视为全部', () => {
    expect(poolOf([])).toEqual(WORDS)
  })
})

describe('orderPool（自由练习 / 错题练习的出题顺序）', () => {
  const pool = poolOf(['Unit 1'])

  it('关（shuffle=false）：顺序确定，与课本完全一致', () => {
    expect(orderPool(pool, false)).toEqual(pool)
  })

  it('开（shuffle=true）：元素集合相同，不丢不改', () => {
    const byWord = (a: typeof WORDS[number], b: typeof WORDS[number]) => a.word.localeCompare(b.word)
    expect([...orderPool(pool, true)].sort(byWord)).toEqual([...pool].sort(byWord))
  })

  it('开：会真的打乱（大池多次抽样必出现不同排列）', () => {
    const base = WORDS.map((w) => w.word).join('|')
    let changed = false
    for (let i = 0; i < 5 && !changed; i++) {
      changed = orderPool(WORDS, true).map((w) => w.word).join('|') !== base
    }
    expect(changed).toBe(true)
  })
})

describe('todayInfo（今日队列在 shuffle 开/关下的行为）', () => {
  const pool = poolOf(['Starter', 'Unit 1'])
  const now = Date.now()
  // pool[3]/pool[0]/pool[7] 已学且到期；pool[1] 已学但未到期（不该出现）
  const dueWords = [pool[3], pool[0], pool[7]]
  const notDueWord = pool[1]
  const progress: AppData['progress'] = {}
  for (const w of dueWords) {
    progress[wordKey(w.word)] = { box: 2, dueAt: now - 1000, correct: 1, wrong: 0, lastResult: 'correct', lastAt: now }
  }
  progress[wordKey(notDueWord.word)] = { box: 5, dueAt: now + 14 * DAY_MS, correct: 3, wrong: 0, lastResult: 'correct', lastAt: now }
  const dueKeys = new Set(dueWords.map((w) => wordKey(w.word)))
  const freshExpected = pool.filter((w) => progress[wordKey(w.word)] === undefined)

  it('关：顺序确定——到期词在前且组内按课本顺序，新词按课本顺序，仅含选中单元', () => {
    const r = todayInfo(mkData({ shuffle: false }, progress), pool)
    expect(r.queue.slice(0, 3)).toEqual([pool[0], pool[3], pool[7]])
    expect(r.queue.slice(3)).toEqual(freshExpected)
    expect(r.queue.every((w) => w.unit === 'Starter' || w.unit === 'Unit 1')).toBe(true)
  })

  it('开：到期词优先于新词的规则保留，未到期词不出现', () => {
    const r = todayInfo(mkData({ shuffle: true }, progress), pool)
    expect(r.dueCount).toBe(3)
    expect(r.queue.slice(0, r.dueCount).every((w) => dueKeys.has(wordKey(w.word)))).toBe(true)
    expect(r.queue.slice(r.dueCount).every((w) => !dueKeys.has(wordKey(w.word)))).toBe(true)
    expect(r.queue.some((w) => w.word === notDueWord.word)).toBe(false)
  })

  it('开：与关闭时元素集合相同（只差顺序）', () => {
    const on = todayInfo(mkData({ shuffle: true }, progress), pool)
    const off = todayInfo(mkData({ shuffle: false }, progress), pool)
    expect([...on.queue].map((w) => w.word).sort()).toEqual([...off.queue].map((w) => w.word).sort())
  })

  it('到期词优先在两种设置下都成立（到期词全部位于新词之前）', () => {
    for (const shuffle of [true, false]) {
      const r = todayInfo(mkData({ shuffle }, progress), pool)
      expect(r.queue.slice(0, r.dueCount).every((w) => dueKeys.has(wordKey(w.word)))).toBe(true)
      expect(r.queue.slice(r.dueCount).every((w) => !dueKeys.has(wordKey(w.word)))).toBe(true)
    }
  })
})
