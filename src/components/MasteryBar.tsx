/** 掌握度条：0~5 格 */
export function MasteryBar({ level }: { level: number }) {
  return (
    <span className="mastery" role="img" aria-label={`掌握度 ${level}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`seg ${i < level ? `on l${level}` : ''}`} />
      ))}
    </span>
  )
}
