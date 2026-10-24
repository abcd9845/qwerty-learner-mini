import { useState } from 'react'
import { useProfileStore, type Profile } from '../lib/profiles'
import { createProfile, deleteProfile, renameProfile, switchProfile } from '../lib/storage'

/**
 * 用户管理弹层（首页顶部入口）：切换 / 新建 / 重命名 / 删除。
 * 删除为二次确认，且会连同该用户的全部数据一起删除。
 */
export function ProfileManager({ onClose }: { onClose: () => void }) {
  const { profiles, currentId } = useProfileStore()
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  const addProfile = () => {
    createProfile(newName) // 建好即切换为新用户
    setNewName('')
    onClose()
  }

  const applyRename = () => {
    if (!renaming) return
    renameProfile(renaming.id, renaming.name)
    setRenaming(null)
  }

  const removeProfile = (p: Profile) => {
    if (!window.confirm(`删除「${p.name}」？该用户的进度、错题本、统计和设置会被删除。`)) return
    if (!window.confirm(`再次确认：真的删除「${p.name}」吗？此操作不可恢复。`)) return
    deleteProfile(p.id)
  }

  return (
    <div className="overlay" role="dialog" aria-label="切换用户" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <h2>使用者</h2>
        <ul className="profile-list">
          {profiles.map((p) => (
            <li key={p.id} className={`profile-row${p.id === currentId ? ' current' : ''}`}>
              {renaming?.id === p.id ? (
                <>
                  <input
                    className="name-input"
                    value={renaming.name}
                    maxLength={12}
                    enterKeyHint="done"
                    autoFocus
                    onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyRename()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                  />
                  <button className="mini-btn" aria-label="保存名字" onClick={applyRename}>
                    ✓
                  </button>
                  <button className="mini-btn" aria-label="取消" onClick={() => setRenaming(null)}>
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="profile-name"
                    onClick={() => {
                      switchProfile(p.id)
                      onClose()
                    }}
                    disabled={p.id === currentId}
                  >
                    👤 {p.name}
                    {p.id === currentId ? ' · 当前' : ''}
                  </button>
                  <button
                    className="mini-btn"
                    aria-label={`重命名 ${p.name}`}
                    onClick={() => setRenaming({ id: p.id, name: p.name })}
                  >
                    ✎
                  </button>
                  <button className="mini-btn danger" aria-label={`删除 ${p.name}`} onClick={() => removeProfile(p)}>
                    🗑
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="profile-new">
          <input
            className="name-input"
            placeholder="新用户名字"
            value={newName}
            maxLength={12}
            enterKeyHint="done"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) addProfile()
            }}
          />
          <button className="ghost-btn" onClick={addProfile} disabled={!newName.trim()}>
            新建
          </button>
        </div>
        <p className="gate-note">每人独立记录进度、错题本和设置 · 数据只存在本机浏览器，不上传</p>
      </div>
    </div>
  )
}
