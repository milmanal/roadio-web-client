import type { CardProps } from '../cardProps'
import { MediaBlock } from '../MediaBlock'

// html / html_trivia and template-driven items (html_template_name, e.g.
// "babel/pattern_lock.html"). Many carry their content as HTML in `story`.
// Rendered as trusted HTML (source is our own backend). Full template-hosted
// games (pattern_lock, volume_meter, radar) get fleshed out later — for now we
// show the prompt and let the player continue.
export default function WebGameCard({ point, busy, onContinue }: CardProps) {
  const html = point.story || point.question || ''
  return (
    <div className="card-inner">
      <MediaBlock images={point.question_images} voice={point.question_voice} />
      {html && (
        <div className="card-html" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      {point.html_template_name && (
        <p className="muted small">
          (template: {point.html_template_name} — interactive version pending)
        </p>
      )}
      <div className="feedback">
        <button disabled={busy} onClick={onContinue}>
          המשך
        </button>
      </div>
    </div>
  )
}
