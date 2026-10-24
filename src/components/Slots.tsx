/**
 * 单词字母槽位显示。
 * hint = 0：空槽（只看长度）
 * hint = 1：首字母 + 长度（a _ _ _）
 * hint = 2：完整答案（等待重打）
 * 已输入的字母以绿色覆盖显示。
 */
export function Slots({ target, typed, hint, flash }: { target: string; typed: number; hint: 0 | 1 | 2; flash: number }) {
  return (
    <div key={flash} className={`slots ${flash > 0 ? 'shake' : ''}`} aria-label={`共 ${target.length} 个字符`}>
      {target.split('').map((ch, i) => {
        const done = i < typed
        let display = ''
        if (done) display = ch
        else if (hint === 2) display = ch
        else if (hint === 1) display = i === 0 ? ch : '_'
        const cls = ['slot', done ? 'done' : i === typed ? 'current' : '', hint === 2 && !done ? 'reveal' : '', ch === ' ' ? 'space' : '']
          .filter(Boolean)
          .join(' ')
        return (
          <span key={i} className={cls}>
            {display}
          </span>
        )
      })}
    </div>
  )
}
