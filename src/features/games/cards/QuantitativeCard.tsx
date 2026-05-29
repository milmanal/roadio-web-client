import type { CardProps } from '../cardProps'
import { Feedback } from './QuestionCard'
import { normalize } from '../answer'

// quantitative: pick the right number among `answers`. extra_details carries a
// localized chart label + a position hint (he/en), e.g. ranking a song.
export default function QuantitativeCard({
  point,
  result,
  busy,
  onSubmit,
  onContinue,
}: CardProps) {
  const choices = (point.answers ?? []).filter(Boolean)
  const answered = result != null
  const rightAnswer = point.right_answer?.trim()

  const ed = point.extra_details ?? {}
  const he = (ed.he ?? ed.en) as { chart?: string; position?: string } | undefined

  return (
    <div className="card-inner">
      {point.question && <h2 className="card-q">{point.question}</h2>}
      {he?.chart && <p className="card-story">{he.chart}</p>}
      {point.story && <p className="card-story">{point.story}</p>}

      <div className="choices choices-num">
        {choices.map((choice) => {
          const isPick = result?.pickedAnswer != null &&
            normalize(result.pickedAnswer) === normalize(choice)
          const isRight =
            answered && rightAnswer != null &&
            normalize(choice) === normalize(rightAnswer)
          const cls = [
            'choice',
            isRight ? 'choice-right' : '',
            isPick && !isRight ? 'choice-wrong' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={choice}
              className={cls}
              disabled={busy || answered}
              onClick={() => onSubmit(choice)}
            >
              {choice}
            </button>
          )
        })}
      </div>

      {answered && (
        <Feedback result={result} rightAnswer={rightAnswer} onContinue={onContinue} />
      )}
    </div>
  )
}
