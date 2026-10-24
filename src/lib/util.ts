import type { Word } from '../data/words'

/** 洗牌（返回新数组） */
export function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 大小写不敏感比较单个字符 */
export function charMatches(expected: string, typed: string): boolean {
  return expected.toLowerCase() === typed.toLowerCase()
}

/** 释义里内嵌的词性前缀（如 “n. 句子” → “n.”）；没有则返回 null */
const POS_RE = /^(n|v|adj|adv|prep|pron|conj|num|art|int|abbr|aux|det)\.\s+/i
export function posOf(meaning: string): string | null {
  const m = meaning.match(POS_RE)
  return m ? m[1].toLowerCase() + '.' : null
}

/**
 * 选择题干扰项：优先同单元、同词性的其它词；不足时用其它单元补齐。
 * 返回 3 个干扰项（不含目标本身）。
 */
export function pickDistractors(target: Word, pool: readonly Word[], count = 3): Word[] {
  const usedMeanings = new Set([target.meaning])
  const sameUnitSamePos: Word[] = []
  const sameUnit: Word[] = []
  const others: Word[] = []
  const targetPos = posOf(target.meaning)
  for (const w of pool) {
    if (w.word === target.word || usedMeanings.has(w.meaning)) continue
    if (w.unit === target.unit) {
      if (targetPos && posOf(w.meaning) === targetPos) sameUnitSamePos.push(w)
      else sameUnit.push(w)
    } else {
      others.push(w)
    }
  }
  const picked: Word[] = []
  const takeFrom = (list: Word[]) => {
    while (list.length > 0 && picked.length < count) {
      const idx = Math.floor(Math.random() * list.length)
      const [w] = list.splice(idx, 1)
      if (!usedMeanings.has(w.meaning)) {
        picked.push(w)
        usedMeanings.add(w.meaning)
      }
    }
  }
  takeFrom(sameUnitSamePos)
  takeFrom(sameUnit)
  takeFrom(others)
  return picked
}
