import { TypingPractice } from './TypingPractice'
import type { ModeProps } from './index'

/** 模式一：看中文默写——显示释义，输入英文 */
export function DictationMode(props: ModeProps) {
  return <TypingPractice {...props} variant="dictation" />
}
