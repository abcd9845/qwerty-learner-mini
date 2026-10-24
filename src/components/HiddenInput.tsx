import { useEffect, useRef } from 'react'

/**
 * 隐藏 input：仅用于在手机上唤起软键盘。
 * 字符输入走 input 事件（兼容安卓 IME），Backspace/Enter 走 keydown。
 * 桌面端与移动端行为一致：每次有字符插入就逐个回调并清空。
 */
export function HiddenInput({ onChar, onBackspace }: { onChar: (ch: string) => void; onBackspace: () => void }) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focus = () => ref.current?.focus({ preventScroll: true })
    focus()
    // 点击页面任意处（包括按钮）都重新聚焦，保证软键盘不收起
    window.addEventListener('pointerdown', focus)
    return () => window.removeEventListener('pointerdown', focus)
  }, [])

  return (
    <input
      ref={ref}
      className="hidden-input"
      aria-hidden="true"
      tabIndex={-1}
      type="text"
      inputMode="text"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onKeyDown={(e) => {
        if (e.key === 'Backspace') {
          e.preventDefault()
          onBackspace()
        }
        // 其余单字符按键交给 input 事件统一处理，避免桌面端重复触发
      }}
      onInput={(e) => {
        const v = e.currentTarget.value
        for (const ch of v) {
          if (ch >= ' ' && ch <= '~') onChar(ch)
        }
        e.currentTarget.value = ''
      }}
    />
  )
}
