import type { ModeId, Settings } from '../lib/storage'
import type { Word } from '../data/words'

export interface ModeMeta {
  id: ModeId
  icon: string
  name: string
  desc: string
  /** 需要软键盘输入（练习层据此决定是否挂载常驻隐藏 input） */
  needsInput: boolean
}

export const MODES: ModeMeta[] = [
  { id: 'dictation', icon: '✍️', name: '看中文默写', desc: '看释义拼单词', needsInput: true },
  { id: 'listening', icon: '🎧', name: '听音默写', desc: '听读音拼单词', needsInput: true },
  { id: 'choice', icon: '⚡️', name: '选择题速刷', desc: '看英文选中文', needsInput: false },
  { id: 'cloze', icon: '🧩', name: '句子填空', desc: '补全关键单词', needsInput: true },
]

/** 各练习模式组件的公共 props */
export interface ModeProps {
  word: Word
  settings: Settings
  /** 记录一次答题（供 SRS/统计/错题本） */
  onResult: (correct: boolean) => void
  /** 进入下一个词 */
  advance: () => void
}

export function modeName(id: ModeId): string {
  return MODES.find((m) => m.id === id)?.name ?? id
}
