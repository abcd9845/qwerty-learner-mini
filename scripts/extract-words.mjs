#!/usr/bin/env node
/**
 * 一次性数据提取脚本：生成 src/data/words.ts（七年级上册·外研版 Starter–Unit 6 词库）。
 *
 * 数据来源（只读，不做任何修改）：
 *   - 词汇：--vocab-dir 指定的目录下 starter.ts / unit1.ts … unit6.ts，
 *     每个文件里 vocabItems(...) 的词汇行是含 en/ipa/cn/pos 字段的对象。
 *   - 短语：--phrases 指定的短语库文件（可传多个），
 *     里面 STARTER_PHRASES / UNIT1_PHRASES … UNIT6_PHRASES 数组的行是含 en/cn 字段的对象。
 *
 * 规则：
 *   - 只提取「英文 + 中文释义 + 单元」；
 *   - 释义 = 词性 + 中文（词汇行有词性）；短语行直接用中文释义；
 *   - 英文超过 60 个字符的整句跳过；
 *   - 全局去重（忽略大小写与多余空白，保留先出现的条目）；
 *   - 英文保持原有大小写（专有名词原样保留）。
 *
 * 用法（路径均由命令行传入）：
 *   node scripts/extract-words.mjs \
 *     --out src/data/words.ts \
 *     --vocab-dir <词汇数据目录> \
 *     --phrases <短语库文件> [--phrases <短语库文件> ...]
 */
import { parseArgs } from 'node:util'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const UNIT_ORDER = ['Starter', 'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Unit 6']
const ARRAY_NAME_TO_UNIT = {
  STARTER: 'Starter',
  UNIT1: 'Unit 1',
  UNIT2: 'Unit 2',
  UNIT3: 'Unit 3',
  UNIT4: 'Unit 4',
  UNIT5: 'Unit 5',
  UNIT6: 'Unit 6',
}
const VOCAB_FILES = [
  ['starter.ts', 'Starter'],
  ['unit1.ts', 'Unit 1'],
  ['unit2.ts', 'Unit 2'],
  ['unit3.ts', 'Unit 3'],
  ['unit4.ts', 'Unit 4'],
  ['unit5.ts', 'Unit 5'],
  ['unit6.ts', 'Unit 6'],
]
const MAX_EN_LEN = 60

/** 提取文本中所有最外层 `{ ... }` 对象字面量的源码片段（花括号配对扫描） */
function extractTopLevelObjects(text) {
  const objs = []
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '{') {
      if (depth === 0) start = i
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        objs.push(text.slice(start, i + 1))
        start = -1
      }
      if (depth < 0) depth = 0
    }
  }
  return objs
}

/** 在对象源码里取字符串字段值，兼容单/双引号与转义 */
function strVal(objSrc, key) {
  const re = new RegExp(`\\b${key}\\s*:\\s*('((?:\\\\.|[^'\\\\])*)'|"((?:\\\\.|[^"\\\\])*)")`)
  const m = objSrc.match(re)
  if (!m) return undefined
  return (m[2] ?? m[3] ?? '').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

function normalizeEn(en) {
  return en.replace(/\s+/g, ' ').trim()
}

function dedupeKey(en) {
  return normalizeEn(en).toLowerCase()
}

/** 统计与跳过原因 */
const dropped = { tooLong: [], duplicated: [], nonAscii: [] }

function recordEntry(entries, en, cn, unit, pos) {
  const word = normalizeEn(en)
  const meaning = pos ? `${pos} ${cn}` : cn
  if (!word || !meaning) return
  if (word.length > MAX_EN_LEN) {
    dropped.tooLong.push({ word, unit })
    return
  }
  // 英文里混有非 ASCII 字符（如语法公式「until + 从句」）的条目无法用英文键盘输入，直接跳过
  if (!/^[ -~]*$/.test(word)) {
    dropped.nonAscii.push({ word, unit })
    return
  }
  entries.push({ word, meaning, unit })
}

function parseVocabFile(file, unit) {
  const text = readFileSync(file, 'utf8')
  const entries = []
  for (const obj of extractTopLevelObjects(text)) {
    const en = strVal(obj, 'en')
    const cn = strVal(obj, 'cn')
    if (en === undefined || cn === undefined) continue
    recordEntry(entries, en, cn, unit, strVal(obj, 'pos'))
  }
  return entries
}

function parsePhraseFile(file) {
  const text = readFileSync(file, 'utf8')
  const byUnit = new Map()
  const arrRe = /(?:const|export\s+const)\s+(STARTER|UNIT[1-6])_PHRASES\b/g
  for (const m of text.matchAll(arrRe)) {
    const unit = ARRAY_NAME_TO_UNIT[m[1]]
    const bracketStart = text.indexOf('[', m.index + m[0].length)
    const bracketEnd = text.indexOf('\n];', bracketStart)
    if (bracketStart === -1 || bracketEnd === -1) {
      throw new Error(`无法定位短语数组边界：${m[0]}（${path.basename(file)}）`)
    }
    const slice = text.slice(bracketStart, bracketEnd)
    const entries = []
    for (const obj of extractTopLevelObjects(slice)) {
      const en = strVal(obj, 'en')
      const cn = strVal(obj, 'cn')
      if (en === undefined || cn === undefined) continue
      recordEntry(entries, en, cn, unit)
    }
    byUnit.set(unit, entries)
  }
  return byUnit
}

function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      'vocab-dir': { type: 'string' },
      phrases: { type: 'string', multiple: true },
    },
  })
  if (!values.out || !values['vocab-dir'] || !values.phrases?.length) {
    console.error('用法: node scripts/extract-words.mjs --out src/data/words.ts --vocab-dir <目录> --phrases <文件> [--phrases <文件>…]')
    process.exit(1)
  }

  // 1) 词汇（每单元一个文件）
  const vocab = new Map() // unit -> entries[]
  for (const [name, unit] of VOCAB_FILES) {
    const file = path.join(values['vocab-dir'], name)
    vocab.set(unit, parseVocabFile(file, unit))
  }

  // 2) 短语（文件内按数组名归属单元）
  const phrases = new Map()
  for (const file of values.phrases) {
    for (const [unit, entries] of parsePhraseFile(file)) {
      if (!phrases.has(unit)) phrases.set(unit, [])
      phrases.get(unit).push(...entries)
    }
  }

  // 3) 合并 + 全局去重：先词汇后短语，按单元顺序
  const seen = new Set()
  const final = []
  for (const unit of UNIT_ORDER) {
    for (const e of [...(vocab.get(unit) ?? []), ...(phrases.get(unit) ?? [])]) {
      const key = dedupeKey(e.word)
      if (seen.has(key)) {
        dropped.duplicated.push(`${e.word}（${e.unit}）`)
        continue
      }
      seen.add(key)
      final.push(e)
    }
  }

  // 4) 生成 src/data/words.ts
  const lines = []
  for (const e of final) {
    lines.push(`  { word: ${JSON.stringify(e.word)}, meaning: ${JSON.stringify(e.meaning)}, unit: '${e.unit}' },`)
  }
  const unitTypes = UNIT_ORDER.map((u) => `'${u}'`).join(' | ')
  const out = `// 本文件由 scripts/extract-words.mjs 生成，请勿手改。
// 词库：外研版英语七年级上册（Starter + Unit 1 ~ Unit 6）单词与重点短语/句型。
// 提取规则：英文 + 中文释义 + 单元；超长整句已剔除；已全局去重。

export type Unit = ${unitTypes}

export interface UnitOption {
  id: Unit | 'all'
  label: string
}

export const UNITS: UnitOption[] = [
  { id: 'all', label: '全部七上' },
${UNIT_ORDER.map((u) => `  { id: '${u}', label: '${u}' },`).join('\n')}
]

export interface Word {
  word: string
  meaning: string
  unit: Unit
}

export const WORDS: Word[] = [
${lines.join('\n')}
]
`
  writeFileSync(values.out, out, 'utf8')

  // 5) 报告
  const countByUnit = new Map()
  for (const e of final) countByUnit.set(e.unit, (countByUnit.get(e.unit) ?? 0) + 1)
  console.log(`已生成 ${values.out}`)
  console.log(`词条总数: ${final.length}`)
  for (const u of UNIT_ORDER) console.log(`  ${u}: ${countByUnit.get(u) ?? 0}`)
  console.log(`去重丢弃: ${dropped.duplicated.length} 条${dropped.duplicated.length ? ' → ' + dropped.duplicated.join('、') : ''}`)
  console.log(`超长(>${MAX_EN_LEN}字符)丢弃: ${dropped.tooLong.length} 条`)
  console.log(`含非 ASCII 字符丢弃: ${dropped.nonAscii.length} 条${dropped.nonAscii.length ? ' → ' + dropped.nonAscii.map((d) => `${d.word}（${d.unit}）`).join('、') : ''}`)
}

main()
