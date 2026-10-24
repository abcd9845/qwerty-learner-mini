import { TypingPractice } from './TypingPractice'
import type { ModeProps } from './index'

/** 模式二：听音默写——只听读音（可开中文提示），输入英文 */
export function ListeningMode(props: ModeProps) {
  return <TypingPractice {...props} variant="listening" />
}
