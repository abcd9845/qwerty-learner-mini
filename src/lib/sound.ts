/**
 * WebAudio 合成键盘音效（无音频文件）。
 * 由设置里的「键盘音效」开关控制，默认关闭。
 */

let ctx: AudioContext | null = null
let enabled = false

export function setSoundEnabled(v: boolean): void {
  enabled = v
}

function ac(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** 打字：轻快短音 */
export function playKey(): void {
  tone(740, 0.05, 'triangle', 0.045)
}

/** 答对：上行双音 */
export function playCorrect(): void {
  tone(660, 0.09, 'sine', 0.06)
  tone(990, 0.13, 'sine', 0.06, 0.09)
}

/** 答错：低频短促 */
export function playWrong(): void {
  tone(196, 0.16, 'sawtooth', 0.05)
}
