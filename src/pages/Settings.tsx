import { useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { speak } from '../lib/speech'
import { ALL_UNITS, clearProgress, exportData, importData, setSettings, useAppData } from '../lib/storage'
import type { Unit } from '../data/words'

const DAILY_OPTIONS = [5, 10, 20, 30]

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const data = useAppData()
  const s = data.settings
  const [importText, setImportText] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [exportJson, setExportJson] = useState(() => exportData())
  const exportRef = useRef<HTMLTextAreaElement>(null)

  const toggleUnit = (u: Unit) => {
    const units = s.units.includes(u) ? s.units.filter((x) => x !== u) : [...s.units, u]
    setSettings({ units })
  }

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text })
    window.setTimeout(() => setMsg(null), 2500)
  }

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportJson)
      flash(true, '已复制到剪贴板')
    } catch {
      exportRef.current?.select()
      document.execCommand('copy')
      flash(true, '已全选，请手动复制')
    }
  }

  const doImport = () => {
    if (!importText.trim()) return flash(false, '先粘贴导出的 JSON')
    if (importData(importText)) {
      flash(true, '导入成功')
      setImportText('')
      setExportJson(exportData())
    } else {
      flash(false, '导入失败：不是有效的数据')
    }
  }

  return (
    <div className="page">
      <PageHeader title="设置" onBack={onBack} />

      <section className="settings-group">
        <h2>单元范围 <small className="dim">（不选 = 全部）</small></h2>
        <div className="chips">
          {ALL_UNITS.map((u) => (
            <button key={u} className={`chip ${s.units.includes(u) ? 'on' : ''}`} onClick={() => toggleUnit(u)}>
              {u}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2>每日新词数</h2>
        <div className="seg">
          {DAILY_OPTIONS.map((n) => (
            <button key={n} className={`seg-btn ${s.dailyNew === n ? 'on' : ''}`} onClick={() => setSettings({ dailyNew: n })}>
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2>开关</h2>
        <label className="switch-row">
          <span>自动朗读（选择题读题、答对读词）</span>
          <input type="checkbox" checked={s.autoRead} onChange={(e) => setSettings({ autoRead: e.target.checked })} />
        </label>
        <label className="switch-row">
          <span>听音默写同时显示中文</span>
          <input type="checkbox" checked={s.showChinese} onChange={(e) => setSettings({ showChinese: e.target.checked })} />
        </label>
        <label className="switch-row">
          <span>键盘音效（WebAudio 合成）</span>
          <input type="checkbox" checked={s.keySound} onChange={(e) => setSettings({ keySound: e.target.checked })} />
        </label>
      </section>

      <section className="settings-group">
        <h2>语音</h2>
        <div className="slider-row">
          <span>语速 {s.rate.toFixed(2)}</span>
          <input
            type="range"
            min={0.5}
            max={0.85}
            step={0.05}
            value={s.rate}
            onChange={(e) => setSettings({ rate: Number(e.target.value) })}
          />
        </div>
        <div className="slider-row">
          <span>音量 {Math.round(s.volume * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={s.volume}
            onChange={(e) => setSettings({ volume: Number(e.target.value) })}
          />
        </div>
        <button className="ghost-btn" onClick={() => speak('Welcome to junior high', { rate: s.rate, volume: s.volume })}>
          🔊 试听
        </button>
      </section>

      <section className="settings-group">
        <h2>导出 / 导入进度</h2>
        <p className="dim">导出：复制下面的 JSON 保存。导入：粘贴后点导入（仅本地，无后端）。</p>
        <textarea ref={exportRef} className="json-area" readOnly value={exportJson} onFocus={(e) => e.currentTarget.select()} />
        <button className="ghost-btn" onClick={copyExport}>复制导出内容</button>
        <textarea
          className="json-area"
          placeholder="把之前导出的 JSON 粘贴到这里…"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <button className="ghost-btn" onClick={doImport}>导入</button>
        {msg && <p className={msg.ok ? 'ok' : 'bad'}>{msg.text}</p>}
      </section>

      <section className="settings-group danger">
        <h2>清空进度</h2>
        <p className="dim">删除全部学习记录、每日统计和错题本（设置保留）。</p>
        <button
          className="danger-btn"
          onClick={() => {
            if (window.confirm('确定清空全部学习进度吗？此操作不可恢复。')) {
              clearProgress()
              setExportJson(exportData())
              flash(true, '已清空')
            }
          }}
        >
          清空学习进度
        </button>
      </section>
    </div>
  )
}
