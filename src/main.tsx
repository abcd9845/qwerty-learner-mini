import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initSpeech } from './lib/speech'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

initSpeech()

// PWA：仅生产环境注册 service worker（GitHub Pages 子路径下）
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* 注册失败不影响使用 */
    })
  })
}
