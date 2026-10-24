/**
 * 简单 Service Worker：离线缓存静态资源。
 * 部署在 GitHub Pages 子路径 /qwerty-learner-mini/ 下。
 * - 导航请求：网络优先，离线回退到缓存的 index.html
 * - 带 hash 的 assets：缓存优先（不可变文件）
 * - 其它同路径 GET：stale-while-revalidate
 */
const VERSION = 'v1'
const BASE = '/qwerty-learner-mini/'
const CACHE = `qlm-${VERSION}`
const CORE = [BASE, `${BASE}index.html`, `${BASE}manifest.webmanifest`, `${BASE}icon.svg`, `${BASE}icon-maskable.svg`]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(`${BASE}index.html`, clone))
          return res
        })
        .catch(() => caches.match(`${BASE}index.html`).then((r) => r || caches.match(BASE))),
    )
    return
  }

  if (url.pathname.startsWith(`${BASE}assets/`)) {
    // 不可变资源：缓存优先
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(req, clone))
            return res
          }),
      ),
    )
    return
  }

  // 其它资源：先用缓存，后台更新
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetching = fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(req, clone))
          }
          return res
        })
        .catch(() => hit)
      return hit || fetching
    }),
  )
})
