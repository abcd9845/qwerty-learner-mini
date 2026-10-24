import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from 'react'

/**
 * 常驻隐藏 input：一次练习会话只挂载一次、不随单词切换重挂载，仅用于唤起/保持软键盘。
 *
 * 旧版「点哪儿键盘都收起」的三个真因与对应修法：
 * 1. input 挂在按词 key 重挂载的子树里：每换一个词 input 就被卸载重建，focus()
 *    发生在答题延时的 setTimeout 里（非用户手势），iOS 只在手势内响应 focus 弹键盘。
 *    → 现在 input 提升到 Practice 层常驻，切词只通过 KeyboardContext 换回调，DOM/焦点从不丢失。
 * 2. window 级 pointerdown 里 focus()：与点击目标的默认聚焦互相打架（pointerdown 时 focus
 *    输入框，随后浏览器默认又把焦点给按钮/空白收起键盘），focus/blur 反复抢焦点。
 *    → 去掉全局监听，改为练习区域 onClick（真用户手势内）聚焦；按钮统一 preventDefault 不抢焦点。
 * 3. 每次 input 事件后清空 value：安卓 IME 正在组合输入时被程序改 value 会中断并收起键盘。
 *    → 改用 beforeinput + preventDefault，value 永不变更；组合输入结束才统一取字符并清空。
 *
 * 另有 blur 兜底：焦点若没有落到其它可交互元素（按钮/输入框等）就立即收回，防止键盘收起。
 */

export interface KeyboardHandlers {
  onChar: (ch: string) => void
  onBackspace: () => void
}

const NOOP: KeyboardHandlers = { onChar: () => {}, onBackspace: () => {} }

/** 练习层持有 ref；打字模式组件每次渲染把最新回调写进 ref（input 不动、回调常新） */
export const KeyboardContext = createContext<MutableRefObject<KeyboardHandlers> | null>(null)

/** 打字模式组件调用：把 onChar/onBackspace 注册给练习层的常驻隐藏 input */
export function useKeyboardInput(handlers: KeyboardHandlers): void {
  const bridge = useContext(KeyboardContext)
  useEffect(() => {
    if (!bridge) return
    bridge.current = handlers
    return () => {
      if (bridge.current === handlers) bridge.current = NOOP
    }
  })
}

/** 可见 ASCII 字符才算输入（与词表字符集一致） */
function isPrintable(ch: string): boolean {
  return ch >= ' ' && ch <= '~'
}

/** 焦点是否落在了其它可交互元素上（这些元素获得焦点是合理的，不抢回） */
function isInteractive(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return (
    tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'A' || el.isContentEditable
  )
}

export function HiddenInput({ inputRef }: { inputRef: RefObject<HTMLInputElement> }) {
  const bridge = useContext(KeyboardContext)
  const composingRef = useRef(false)

  const handlers = (): KeyboardHandlers => bridge?.current ?? NOOP

  // useLayoutEffect：进入练习通常源于「开始」按钮的点击手势，同步提交期内聚焦才能让 iOS 弹键盘
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    const onBlur = () => {
      // 焦点被移走（系统收起/点击空白）时：若没有其它可交互元素接住，立即收回，键盘保持
      window.setTimeout(() => {
        if (!el.isConnected) return // 练习页已退出
        const active = document.activeElement
        if (active === el || isInteractive(active)) return
        el.focus({ preventScroll: true })
      }, 0)
    }
    el.addEventListener('blur', onBlur)
    return () => el.removeEventListener('blur', onBlur)
  }, [inputRef])

  return (
    <input
      ref={inputRef}
      className="hidden-input"
      aria-hidden="true"
      tabIndex={-1}
      type="text"
      inputMode="text"
      enterKeyHint="done"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onKeyDown={(e) => {
        if (e.key === 'Backspace') {
          e.preventDefault() // value 保持为空，不产生删除类 input 事件
          handlers().onBackspace()
        }
        // 其余单字符按键统一交给 beforeinput 处理，避免桌面端重复触发
      }}
      onBeforeInput={(e) => {
        if (composingRef.current) return // 组合输入期间不处理（交给 compositionend）
        const native = e.nativeEvent as InputEvent
        if (native.isComposing) return
        if (native.inputType?.startsWith('delete')) {
          e.preventDefault()
          handlers().onBackspace()
          return
        }
        if (native.data) {
          // value 永不变更 → 无需清空 value → 安卓 IME 不会因 value 被改而收起
          e.preventDefault()
          for (const ch of native.data) if (isPrintable(ch)) handlers().onChar(ch)
        }
      }}
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false
        // 组合（拼音等）结束后才统一取字符，期间完全不碰 value，保证 IME 稳定
        const el = e.currentTarget
        const data = e.data || el.value
        for (const ch of data) if (isPrintable(ch)) handlers().onChar(ch)
        el.value = ''
      }}
      onInput={(e) => {
        // 兜底：正常路径 value 恒为空；走到这里说明个别引擎绕过了 beforeinput
        if (composingRef.current) return
        const el = e.currentTarget
        if (el.value === '') return
        for (const ch of el.value) if (isPrintable(ch)) handlers().onChar(ch)
        el.value = ''
      }}
    />
  )
}
