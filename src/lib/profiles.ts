/**
 * 本地用户（profile）注册表：无后端、无密码、不收集任何个人信息。
 * - 用户列表 + 当前用户：localStorage 键 `qlm:profiles`
 * - 每个用户一份独立数据块：`qlm:v2:<profileId>:data`（内容由 storage.ts 的 AppData 占用）
 * - 旧版单用户数据：`qwerty-learner-mini:data`，首次建用户时整体搬到该用户名下后删除（不丢数据）
 * 切换/删除用户会通知订阅者（useProfileStore），storage.ts 再按新当前用户重载数据。
 */
import { useSyncExternalStore } from 'react'

export interface Profile {
  id: string
  name: string
  createdAt: number
}

export interface ProfileStore {
  profiles: Profile[]
  currentId: string | null
}

export const PROFILES_KEY = 'qlm:profiles'
/** 旧版（未分用户）数据的 localStorage 键 */
export const LEGACY_DATA_KEY = 'qwerty-learner-mini:data'
/** 每用户数据键前缀：qlm:v2:<profileId>:data */
export const profileDataKey = (id: string) => `qlm:v2:${id}:data`

export const DEFAULT_PROFILE_NAME = '同学'
export const MAX_NAME_LEN = 12

/** 名字规范化：去首尾空白、限长、空则用默认名 */
export function normalizeName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LEN) || DEFAULT_PROFILE_NAME
}

function isProfile(v: unknown): v is Profile {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Partial<Profile>
  return typeof p.id === 'string' && typeof p.name === 'string' && p.id.length > 0
}

function loadStore(): ProfileStore {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProfileStore>
      if (Array.isArray(parsed.profiles)) {
        const profiles = parsed.profiles.filter(isProfile).map((p) => ({
          id: p.id,
          name: normalizeName(p.name),
          createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
        }))
        const currentId =
          typeof parsed.currentId === 'string' && profiles.some((p) => p.id === parsed.currentId)
            ? parsed.currentId
            : profiles[0]?.id ?? null
        return { profiles, currentId }
      }
    }
  } catch {
    /* 数据损坏时回退为空（引导重新建用户） */
  }
  return { profiles: [], currentId: null }
}

let store: ProfileStore = loadStore()
const listeners = new Set<() => void>()

function persistStore(): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(store))
  } catch {
    /* 存储不可用时静默降级为内存模式 */
  }
}

function emit(): void {
  for (const fn of listeners) fn()
}

function setStore(next: ProfileStore): void {
  store = next
  persistStore()
  emit()
}

/** React 订阅：用户列表/当前用户变化时组件自动刷新 */
export function useProfileStore(): ProfileStore {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => store,
  )
}

/** 非React场景读取当前快照（storage.ts 模块初始化用） */
export function getProfileStore(): ProfileStore {
  return store
}

function newId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** 新建用户并切换为当前用户（建好即用） */
export function createProfile(name: string): Profile {
  const p: Profile = { id: newId(), name: normalizeName(name), createdAt: Date.now() }
  setStore({ profiles: [...store.profiles, p], currentId: p.id })
  return p
}

/** 重命名（只改注册表，不动数据块） */
export function renameProfile(id: string, name: string): void {
  setStore({ ...store, profiles: store.profiles.map((p) => (p.id === id ? { ...p, name: normalizeName(name) } : p)) })
}

/**
 * 删除用户及其数据块；若删的是当前用户，自动切到剩余的第一个（删光则为 null，
 * App 层会重新引导创建）。返回删除后的 currentId。
 */
export function deleteProfile(id: string): string | null {
  const profiles = store.profiles.filter((p) => p.id !== id)
  const currentId = store.currentId === id ? profiles[0]?.id ?? null : store.currentId
  removeProfileData(id)
  setStore({ profiles, currentId })
  return currentId
}

/** 切换当前用户（不存在或已是当前则返回 false） */
export function switchCurrentProfile(id: string): boolean {
  if (store.currentId === id || !store.profiles.some((p) => p.id === id)) return false
  setStore({ ...store, currentId: id })
  return true
}

/* ============ 每用户数据块的原始 JSON 读写（内容校验在 storage.ts） ============ */

export function readProfileData(id: string): string | null {
  try {
    return localStorage.getItem(profileDataKey(id))
  } catch {
    return null
  }
}

export function writeProfileData(id: string, json: string): void {
  try {
    localStorage.setItem(profileDataKey(id), json)
  } catch {
    /* 内存模式 */
  }
}

export function removeProfileData(id: string): void {
  try {
    localStorage.removeItem(profileDataKey(id))
  } catch {
    /* ignore */
  }
}

/** 是否存在旧版（未分用户）数据 */
export function hasLegacyData(): boolean {
  try {
    return localStorage.getItem(LEGACY_DATA_KEY) !== null
  } catch {
    return false
  }
}

/**
 * 旧版数据迁移：把 `qwerty-learner-mini:data` 整体搬到指定用户名下。
 * 只在首次建用户时调用；成功搬运后删除旧键（之后不再重复迁移），不丢任何数据。
 */
export function migrateLegacyData(targetId: string): boolean {
  try {
    const raw = localStorage.getItem(LEGACY_DATA_KEY)
    if (!raw) return false
    if (localStorage.getItem(profileDataKey(targetId)) === null) {
      localStorage.setItem(profileDataKey(targetId), raw)
    }
    localStorage.removeItem(LEGACY_DATA_KEY)
    return true
  } catch {
    return false
  }
}
