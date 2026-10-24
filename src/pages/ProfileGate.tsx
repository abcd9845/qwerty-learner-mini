import { useState } from 'react'
import { DEFAULT_PROFILE_NAME, hasLegacyData } from '../lib/profiles'
import { createProfile } from '../lib/storage'

/**
 * 首次使用（或用户被全部删除）时的建用户引导。
 * 无密码、不收集任何个人信息；页面上明确说明数据只存在本机浏览器。
 */
export function ProfileGate() {
  const [name, setName] = useState(DEFAULT_PROFILE_NAME)
  const [legacy] = useState(() => hasLegacyData())

  const start = () => {
    // 建用户并切换；若存在旧版（未分用户）数据，storage.createProfile 会自动搬到该用户名下
    createProfile(name)
  }

  return (
    <div className="page">
      <section className="card empty gate-card">
        <p className="empty-icon">👋</p>
        <h2>欢迎使用背词课</h2>
        <p className="dim">输入你的名字，建立属于你的学习记录。家里多人使用可以各建一个，进度互不影响。</p>
        <input
          className="name-input"
          value={name}
          maxLength={12}
          placeholder="你的名字"
          enterKeyHint="done"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') start()
          }}
        />
        {legacy && <p className="warn">检测到旧版学习记录，会自动保存到你名下，不会丢失。</p>}
        <button className="primary big" onClick={start}>
          开始背词
        </button>
        <p className="gate-note">🔒 数据只存在本机浏览器（localStorage），不上传服务器，也不收集任何个人信息。</p>
      </section>
    </div>
  )
}
