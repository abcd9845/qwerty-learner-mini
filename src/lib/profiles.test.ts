import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Word } from '../data/words'
import { DAILY_NEW_UNLIMITED } from './srs'

/**
 * 本地用户（profile）测试：创建/切换/重命名/删除、数据隔离、旧版数据迁移、按用户导出导入。
 * node 环境没有 localStorage，用内存实现 stub 后按模块隔离重新加载（每条用例干净开局）。
 */

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      m.set(k, String(v))
    },
    removeItem: (k: string) => {
      m.delete(k)
    },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
  } as Storage
}

/** stub 掉 localStorage 并重新加载 profiles/storage 模块，返回同一份新鲜实例 */
async function fresh() {
  const ls = memoryStorage()
  vi.stubGlobal('localStorage', ls)
  vi.resetModules()
  const profiles = await import('./profiles')
  const storage = await import('./storage')
  return { ls, profiles, storage }
}

const WORD: Word = { word: 'Cat', meaning: 'n. 猫', unit: 'Starter' }
const LEGACY_KEY = 'qwerty-learner-mini:data'

/** 一份旧版（未分用户）数据 */
const LEGACY_DATA = JSON.stringify({
  version: 1,
  settings: { dailyNew: 20 },
  progress: {},
  daily: {},
  mistakes: { cat: 1700000000000 },
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('本地用户 profile', () => {
  it('首次建用户：迁移旧版数据到该用户名下，不丢数据', async () => {
    const { ls, storage } = await fresh()
    ls.setItem(LEGACY_KEY, LEGACY_DATA)

    const p = storage.createProfile('小明')
    expect(ls.getItem(LEGACY_KEY)).toBeNull() // 旧 key 搬走后删除，不会重复迁移
    expect(ls.getItem(`qlm:v2:${p.id}:data`)).toContain('cat') // 数据落到该用户名下
    expect(storage.getData().mistakes['cat']).toBe(1700000000000)
    expect(storage.getData().settings.dailyNew).toBe(20) // 旧设置一并继承
    expect(storage.currentProfile()?.name).toBe('小明')
  })

  it('数据隔离：A 的错题不出现在 B，切换后各自独立', async () => {
    const { ls, storage } = await fresh()
    const a = storage.createProfile('A')
    storage.recordAnswer(WORD, false) // A 答错一次
    expect(storage.getData().mistakes['cat']).toBeTruthy()

    storage.createProfile('B') // 新建即切换到 B
    expect(storage.getData().mistakes).toEqual({}) // B 是全新数据
    expect(storage.getData().progress).toEqual({})
    expect(ls.getItem(`qlm:v2:${a.id}:data`)).toContain('cat') // A 的数据仍完好

    storage.recordAnswer({ ...WORD, word: 'dog' }, false) // B 答错的是别的词
    storage.switchProfile(a.id) // 切回 A
    expect(storage.getData().mistakes).toEqual({ cat: expect.any(Number) }) // A 只有自己的错题
    expect(storage.getData().mistakes['dog']).toBeUndefined()
  })

  it('切换 / 重命名 / 删除（删当前用户自动切到剩余用户，删光则清空）', async () => {
    const { ls, profiles, storage } = await fresh()
    const a = storage.createProfile('A')
    storage.recordAnswer(WORD, false)
    const b = storage.createProfile('B')
    expect(profiles.getProfileStore().currentId).toBe(b.id) // 建好即切换

    storage.switchProfile(a.id)
    expect(profiles.getProfileStore().currentId).toBe(a.id)

    storage.renameProfile(a.id, '阿明')
    expect(profiles.getProfileStore().profiles.find((p) => p.id === a.id)?.name).toBe('阿明')
    expect(ls.getItem(`qlm:v2:${a.id}:data`)).toContain('cat') // 重命名不动数据

    storage.deleteProfile(b.id) // 删非当前用户：数据块一并删除
    expect(ls.getItem(`qlm:v2:${b.id}:data`)).toBeNull()
    expect(profiles.getProfileStore().currentId).toBe(a.id)
    expect(storage.getData().mistakes['cat']).toBeTruthy()

    const c = storage.createProfile('C') // 当前为 C，删 C → 自动切回 a
    storage.deleteProfile(c.id)
    expect(profiles.getProfileStore().currentId).toBe(a.id)

    storage.deleteProfile(a.id) // 删光
    expect(profiles.getProfileStore().currentId).toBeNull()
    expect(profiles.getProfileStore().profiles).toHaveLength(0)
  })

  it('shuffle 设置：默认 true，旧数据无字段按 true，导出导入往返保留', async () => {
    const { storage } = await fresh()
    storage.createProfile('小明')
    expect(storage.getData().settings.shuffle).toBe(true) // 新用户/无字段的旧数据都按随机
    storage.setSettings({ shuffle: false })
    expect(storage.getData().settings.shuffle).toBe(false)

    const dump = storage.exportData()
    expect(JSON.parse(dump).data.settings.shuffle).toBe(false)
    storage.setSettings({ shuffle: true })
    expect(storage.importData(dump)).toBe(true)
    expect(storage.getData().settings.shuffle).toBe(false) // 导入恢复关闭状态

    // 旧版导出（settings 里没有 shuffle 字段）→ 按默认 true 迁移
    expect(
      storage.importData(JSON.stringify({ version: 1, settings: {}, progress: {}, daily: {}, mistakes: {} }))
    ).toBe(true)
    expect(storage.getData().settings.shuffle).toBe(true)
  })

  it('每日新词：新用户默认不限（0），0 合法可往返，旧值保留，非法/缺字段回退不限', async () => {
    const { storage } = await fresh()
    storage.createProfile('小明')
    expect(storage.getData().settings.dailyNew).toBe(DAILY_NEW_UNLIMITED) // 新用户默认不限

    storage.setSettings({ dailyNew: 0 })
    expect(storage.getData().settings.dailyNew).toBe(0) // 0 是合法值
    const dump = storage.exportData()
    expect(JSON.parse(dump).data.settings.dailyNew).toBe(0)
    storage.setSettings({ dailyNew: 30 })
    expect(storage.importData(dump)).toBe(true)
    expect(storage.getData().settings.dailyNew).toBe(0) // 导出/导入往返保留不限

    // 旧用户已选的 5/10/20/30 原样保留
    expect(
      storage.importData(JSON.stringify({ version: 1, settings: { dailyNew: 20 }, progress: {}, daily: {}, mistakes: {} }))
    ).toBe(true)
    expect(storage.getData().settings.dailyNew).toBe(20)

    // 非法值 / 缺字段都回退到不限
    for (const bad of [7, -5, 'abc', null]) {
      expect(
        storage.importData(JSON.stringify({ version: 1, settings: { dailyNew: bad }, progress: {}, daily: {}, mistakes: {} }))
      ).toBe(true)
      expect(storage.getData().settings.dailyNew).toBe(DAILY_NEW_UNLIMITED)
    }
    expect(
      storage.importData(JSON.stringify({ version: 1, settings: {}, progress: {}, daily: {}, mistakes: {} }))
    ).toBe(true)
    expect(storage.getData().settings.dailyNew).toBe(DAILY_NEW_UNLIMITED)
  })

  it('导出/导入按当前用户：带用户名、不含其它用户数据', async () => {
    const { ls, storage } = await fresh()
    const a = storage.createProfile('小明')
    storage.recordAnswer(WORD, false)
    const dump = storage.exportData()

    const parsed = JSON.parse(dump)
    expect(parsed.app).toBe('qwerty-learner-mini')
    expect(parsed.profile.name).toBe('小明')
    expect(parsed.data.mistakes['cat']).toBeTruthy()

    const b = storage.createProfile('小红') // 新建即切换到小红
    expect(storage.getData().mistakes).toEqual({})
    expect(storage.importData(dump)).toBe(true) // 导入覆盖的是当前用户（小红）
    expect(storage.getData().mistakes['cat']).toBeTruthy()
    expect(ls.getItem(`qlm:v2:${b.id}:data`)).toContain('cat')

    storage.switchProfile(a.id)
    expect(storage.getData().mistakes['cat']).toBeTruthy() // 小明自己的数据不受小红导入影响

    // 兼容旧版纯 AppData 导出格式
    expect(storage.importData(JSON.stringify({ version: 1, settings: {}, progress: {}, daily: {}, mistakes: { dog: 1 } }))).toBe(true)
    expect(storage.getData().mistakes['dog']).toBe(1)

    // 非法内容导入失败
    expect(storage.importData('not json')).toBe(false)
    expect(storage.importData('{"foo":1}')).toBe(false)
  })
})
