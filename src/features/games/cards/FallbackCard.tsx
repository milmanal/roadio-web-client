import type { CardProps } from '../cardProps'
import { MediaBlock } from '../MediaBlock'

// Safe renderer for unknown / not-yet-modeled `type` values.
export default function FallbackCard({ point, busy, onContinue }: CardProps) {
  return (
    <div className="card-inner">
      {point.question && <h2 className="card-q">{point.question}</h2>}
      <MediaBlock images={point.question_images} voice={point.question_voice} />
      {point.story && <p className="card-story">{point.story}</p>}
      <p className="muted small">type: {point.type}</p>
      <div className="feedback">
        <button disabled={busy} onClick={onContinue}>
          המשך
        </button>
      </div>
    </div>
  )
}
