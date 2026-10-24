/**
 * 浏览器 speechSynthesis 朗读封装：
 * lang 固定 en-US，优先挑选 en-US 的 voice，常规语速 ≤ 0.85，慢速 0.6。
 */

let cachedVoice: SpeechSynthesisVoice | null = null

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function bestVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null
  if (cachedVoice) return cachedVoice
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  cachedVoice =
    voices.find((v) => v.lang === 'en-US' && /google/i.test(v.name)) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
    null
  return cachedVoice
}

/** App 启动时调用：预热 voice 列表（异步加载） */
export function initSpeech(): void {
  if (!speechSupported()) return
  bestVoice()
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null
    bestVoice()
  }
}

export interface SpeakOptions {
  /** 0.5 ~ 0.85 */
  rate?: number
  /** 0 ~ 1 */
  volume?: number
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi)
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!speechSupported() || !text) return
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voice = bestVoice()
    if (voice) u.voice = voice
    u.lang = 'en-US'
    u.rate = clamp(opts.rate ?? 0.85, 0.5, 0.85)
    u.volume = clamp(opts.volume ?? 1, 0, 1)
    synth.speak(u)
  } catch {
    /* 语音不可用时静默忽略 */
  }
}

/** 慢速朗读（rate 0.6） */
export function speakSlow(text: string, volume = 1): void {
  speak(text, { rate: 0.6, volume })
}

export function stopSpeak(): void {
  if (!speechSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
}
