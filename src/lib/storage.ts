/**
 * localStorage 持久化（无后端，仅本地）。
 * 单一数据块存储 + 订阅更新，React 侧通过 useAppData() 读取。
 */
import { useSyncExternalStore } from 'react'
import type { Unit, Word } from '../data/words'
import { boxAfterCorrect, boxAfterWrong, dayKey, type WordProgress } from './srs'

export type ModeId = 'dictation' | 'listening' | 'choice' | 'cloze'

export interface Settings {
  /** 选中的单元（空数组视为全部） */
  units: Unit[]
  /** 每日新词数：5/10/20/30 */
  dailyNew: number
  /** 自动朗读（选择题读题、打完读词等） */
  autoRead: boolean
  /** 听音默写时同时显示中文 */
  showChinese: boolean
  /** 朗读语速 0.5~0.85 */
  rate: number
  /** 朗读音量 0~1 */
  volume: number
  /** 键盘音效（WebAudio 合成） */
  keySound: boolean
  /** 上次使用的练习模式 */
  lastMode: ModeId
}

export interface DayStat {
  completed: number
  correct: number
  wrong: number
  newWords: number
}

export interface AppData {
  version: 1
  settings: Settings
  progress: Record<string, WordProgress>
  daily: Record<string, DayStat>
  /** 错题本：key -> 加入时间戳 */
  mistakes: Record<string, number>
}

export const STORAGE_KEY = 'qwerty-learner-mini:data'

export const ALL_UNITS: Unit[] = ['Starter', 'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Unit 6']

const DEFAULT_DATA: AppData = {
  version: 1,
  settings: {
    units: [...ALL_UNITS],
    dailyNew: 10,
    autoRead: true,
    showChinese: false,
    rate: 0.85,
    volume: 1,
    keySound: false,
    lastMode: 'dictation',
  },
  progress: {},
  daily: {},
  mistakes: {},
}

function cloneDefault(): AppData {
  return {
    ...DEFAULT_DATA,
    settings: { ...DEFAULT_DATA.settings, units: [...DEFAULT_DATA.settings.units] },
    progress: {},
    daily: {},
    mistakes: {},
  }
}

function sanitize(raw: unknown): AppData {
  const base = cloneDefault()
  if (typeof raw !== 'object' || raw === null) return base
  const r = raw as Partial<AppData>
  const s = (r.settings ?? {}) as Partial<Settings>
  return {
    version: 1,
    settings: {
      units: Array.isArray(s.units) ? s.units.filter((u): u is Unit => ALL_UNITS.includes(u as Unit)) : [...ALL_UNITS],
      dailyNew: [5, 10, 20, 30].includes(Number(s.dailyNew)) ? Number(s.dailyNew) : 10,
      autoRead: Boolean(s.autoRead),
      showChinese: Boolean(s.showChinese),
      rate: typeof s.rate === 'number' ? Math.min(Math.max(s.rate, 0.5), 0.85) : 0.85,
      volume: typeof s.volume === 'number' ? Math.min(Math.max(s.volume, 0), 1) : 1,
      keySound: Boolean(s.keySound),
      lastMode: (['dictation', 'listening', 'choice', 'cloze'] as const).includes(s.lastMode as ModeId)
        ? (s.lastMode as ModeId)
        : 'dictation',
    },
    progress: typeof r.progress === 'object' && r.progress !== null ? (r.progress as AppData['progress']) : {},
    daily: typeof r.daily === 'object' && r.daily !== null ? (r.daily as AppData['daily']) : {},
    mistakes: typeof r.mistakes === 'object' && r.mistakes !== null ? (r.mistakes as AppData['mistakes']) : {},
  }
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneDefault()
    return sanitize(JSON.parse(raw))
  } catch {
    return cloneDefault()
  }
}

let current: AppData = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    /* 存储不可用时静默降级为内存模式 */
  }
}

function emit() {
  for (const fn of listeners) fn()
}

function update(mutate: (d: AppData) => AppData) {
  current = mutate(current)
  persist()
  emit()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, () => current)
}

export function getData(): AppData {
  return current
}

/** 进度键：统一小写去空格 */
export function wordKey(text: string): string {
  return text.trim().toLowerCase()
}

/** 记录一次答题：更新记忆盒、每日统计、错题本 */
export function recordAnswer(word: Word, correct: boolean, session: 'normal' | 'mistakes' = 'normal'): void {
  const now = Date.now()
  const key = wordKey(word.word)
  update((d) => {
    const prev = d.progress[key]
    const srs = correct ? boxAfterCorrect(prev, now) : boxAfterWrong(now)
    const progress: AppData['progress'] = {
      ...d.progress,
      [key]: {
        ...srs,
        correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
        wrong: (prev?.wrong ?? 0) + (correct ? 0 : 1),
        lastResult: correct ? 'correct' : 'wrong',
        lastAt: now,
      },
    }

    const k = dayKey(now)
    const day = d.daily[k] ?? { completed: 0, correct: 0, wrong: 0, newWords: 0 }
    const wasNew = !prev
    const daily: AppData['daily'] = {
      ...d.daily,
      [k]: {
        completed: day.completed + 1,
        correct: day.correct + (correct ? 1 : 0),
        wrong: day.wrong + (correct ? 0 : 1),
        newWords: day.newWords + (wasNew && session !== 'mistakes' ? 1 : 0),
      },
    }

    let mistakes = d.mistakes
    if (!correct) {
      mistakes = { ...mistakes, [key]: now }
    } else if (session === 'mistakes' && mistakes[key] !== undefined) {
      const { [key]: _removed, ...rest } = mistakes
      mistakes = rest
    }

    return { ...d, progress, daily, mistakes }
  })
}

export function setSettings(patch: Partial<Settings>): void {
  update((d) => ({ ...d, settings: sanitize({ settings: { ...d.settings, ...patch } }).settings }))
}

/** 清空学习进度（保留设置） */
export function clearProgress(): void {
  update((d) => ({ ...d, progress: {}, daily: {}, mistakes: {} }))
}

export function removeMistake(word: string): void {
  const key = wordKey(word)
  update((d) => {
    if (d.mistakes[key] === undefined) return d
    const { [key]: _removed, ...rest } = d.mistakes
    return { ...d, mistakes: rest }
  })
}

/** 导出全部数据（进度+设置）为 JSON 字符串，供复制保存 */
export function exportData(): string {
  return JSON.stringify(current, null, 2)
}

/** 从 JSON 导入数据，成功返回 true */
export function importData(json: string): boolean {
  try {
    const parsed = sanitize(JSON.parse(json))
    if (parsed.version !== 1) return false
    update(() => parsed)
    return true
  } catch {
    return false
  }
}
