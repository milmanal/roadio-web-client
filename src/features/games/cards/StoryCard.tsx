import type { CardProps } from '../cardProps'
import { MediaBlock } from '../MediaBlock'

// Narrative cards with no scored answer: story / insta_story / narrator.
// Shows text + media + voice, then a single continue action.
export default function StoryCard({ point, busy, onContinue }: CardProps) {
  return (
    <div className="card-inner">
      {point.question && <h2 className="card-q">{point.question}</h2>}
      <MediaBlock images={point.question_images} voice={point.question_voice} />
      {point.story && <p className="card-story card-story-lg">{point.story}</p>}
      <MediaBlock images={point.story_images} />
      {(point.story_voices ?? []).map((v) =>
        v ? <audio key={v} className="media-audio" src={v} controls /> : null,
      )}
      <div className="feedback">
        <button disabled={busy} onClick={onContinue}>
          המשך
        </button>
      </div>
    </div>
  )
}
