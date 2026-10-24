import type { ReactNode } from 'react'

/** 二级页面顶栏：返回 + 标题 + 右侧动作 */
export function PageHeader({ title, onBack, right }: { title: ReactNode; onBack: () => void; right?: ReactNode }) {
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={onBack} aria-label="返回">
        ←
      </button>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  )
}
