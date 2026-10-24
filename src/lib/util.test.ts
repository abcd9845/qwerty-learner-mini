import { describe, expect, it } from 'vitest'
import { WORDS } from '../data/words'
import { buildCloze } from '../modes/ClozeMode'
import { charMatches, pickDistractors, posOf, shuffled } from './util'

describe('charMatches', () => {
  it('大小写不敏感', () => {
    expect(charMatches('J', 'j')).toBe(true)
    expect(charMatches('j', 'J')).toBe(true)
    expect(charMatches('a', 'b')).toBe(false)
  })
})

describe('posOf', () => {
  it('识别内嵌词性前缀，没有则返回 null', () => {
    expect(posOf('n. 句子')).toBe('n.')
    expect(posOf('adj. 准备好的')).toBe('adj.')
    expect(posOf('初级中学')).toBeNull()
  })
})

describe('pickDistractors', () => {
  it('返回 3 个干扰项：不含目标、释义不重复、同单元优先', () => {
    const target = WORDS.find((w) => w.unit === 'Unit 1')!
    const d = pickDistractors(target, WORDS)
    expect(d).toHaveLength(3)
    expect(d.every((x) => x.word !== target.word)).toBe(true)
    expect(new Set(d.map((x) => x.meaning)).size).toBe(3)
    expect(d.every((x) => x.unit === target.unit)).toBe(true)
  })
})

describe('shuffled', () => {
  it('不丢不改元素', () => {
    const a = [1, 2, 3, 4, 5]
    const s = shuffled(a)
    expect([...s].sort()).toEqual(a)
    expect(a).toEqual([1, 2, 3, 4, 5]) // 原数组不变
  })
})

describe('buildCloze', () => {
  it('从句子里挖掉有独立释义的关键词', () => {
    const entry = WORDS.find((w) => w.word === 'Welcome to junior high!')!
    const c = buildCloze(entry)!
    expect(c.keyword.length).toBeGreaterThan(0)
    expect(c.before + c.keyword + c.after).toBe(entry.word)
    expect(c.hint.length).toBeGreaterThan(0)
  })

  it('非句子条目返回 null', () => {
    expect(buildCloze({ word: 'ready', meaning: 'adj. 准备好的', unit: 'Starter' })).toBeNull()
  })
})
