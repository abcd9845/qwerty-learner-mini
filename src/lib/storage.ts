/**
 * localStorage 持久化（无后端，仅本地）。
 * 多用户（profile）：每个用户一份独立 AppData，存 `qlm:v2:<profileId>:data`；
 * 用户列表/当前用户存 `qlm:profiles`（注册表见 profiles.ts）。
 * 订阅按「当前用户」工作：切换/删除用户后整体重载并 emit，
 * 所有 useAppData() 页面（首页/统计/错题本/设置/练习）立即刷新为新用户数据。
 */
import { useSyncExternalStore } from 'react'
import type { Unit, Word } from '../data/words'
import { boxAfterCorrect, boxAfterWrong, dayKey, type WordProgress } from './srs'
import {
  createProfile as createProfileOp,
  deleteProfile as deleteProfileOp,
  getProfileStore,
  migrateLegacyData,
  readProfileData,
  renameProfile as renameProfileOp,
  switchCurrentProfile,
  writeProfileData,
  type Profile,
} from './profiles'

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

/** 读取指定用户的数据块（无数据/损坏时回退默认值） */
function loadFor(id: string | null): AppData {
  if (!id) return cloneDefault()
  try {
    const raw = readProfileData(id)
    return raw ? sanitize(JSON.parse(raw)) : cloneDefault()
  } catch {
    return cloneDefault()
  }
}

/** 模块初始化：按 localStorage 里记录的当前用户加载数据 */
let current: AppData = loadFor(getProfileStore().currentId)
const listeners = new Set<() => void>()

function persist(): void {
  const id = getProfileStore().currentId
  // 尚未建立用户时数据只留在内存（App 会先引导建用户）
  if (id) writeProfileData(id, JSON.stringify(current))
}

function emit(): void {
  for (const fn of listeners) fn()
}

function update(mutate: (d: AppData) => AppData): void {
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

/** 按当前用户整体重载数据并通知所有订阅页面 */
function reloadCurrent(): void {
  current = loadFor(getProfileStore().currentId)
  emit()
}

/** 切换当前用户：数据块整体换成该用户的，所有页面立即刷新 */
export function switchProfile(id: string): boolean {
  if (!switchCurrentProfile(id)) return false
  reloadCurrent()
  return true
}

/** 新建用户并切换过去；若存在旧版（未分用户）数据，自动搬到该用户名下 */
export function createProfile(name: string): Profile {
  const p = createProfileOp(name)
  migrateLegacyData(p.id)
  reloadCurrent()
  return p
}

/** 重命名用户（只改注册表，不动数据） */
export function renameProfile(id: string, name: string): void {
  renameProfileOp(id, name)
}

/** 删除用户及其全部数据；若删的是当前用户自动切到剩余的第一个（删光则由 App 引导重建） */
export function deleteProfile(id: string): void {
  deleteProfileOp(id)
  reloadCurrent()
}

/** 当前用户（可能为 null：尚未建用户） */
export function currentProfile(): Profile | null {
  const { profiles, currentId } = getProfileStore()
  return profiles.find((p) => p.id === currentId) ?? null
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

/** 清空学习进度（保留设置，仅当前用户） */
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

/* ============ 导出 / 导入（只针对当前用户） ============ */

/** 导出文件格式：带用户名，但不含其它任何用户的数据 */
export interface ExportFile {
  app: 'qwerty-learner-mini'
  format: 2
  exportedAt: number
  profile: { name: string }
  data: AppData
}

function isExportFile(v: unknown): v is ExportFile {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Partial<ExportFile>
  return r.app === 'qwerty-learner-mini' && r.format === 2 && typeof r.data === 'object' && r.data !== null
}

/** 看起来像旧版导出的纯 AppData（version===1 或带 settings） */
function looksLikeAppData(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return r.version === 1 || r.settings !== undefined
}

/** 导出【当前用户】的全部数据为 JSON 字符串（文件里带用户名，不含其它用户） */
export function exportData(): string {
  const file: ExportFile = {
    app: 'qwerty-learner-mini',
    format: 2,
    exportedAt: Date.now(),
    profile: { name: currentProfile()?.name ?? '' },
    data: current,
  }
  return JSON.stringify(file, null, 2)
}

/** 从 JSON 导入数据，覆盖【当前用户】；兼容旧版纯 AppData 格式。成功返回 true */
export function importData(json: string): boolean {
  try {
    const parsed: unknown = JSON.parse(json)
    let raw: unknown
    if (isExportFile(parsed)) raw = parsed.data
    else if (looksLikeAppData(parsed)) raw = parsed
    else return false
    const clean = sanitize(raw)
    update(() => clean)
    return true
  } catch {
    return false
  }
}
