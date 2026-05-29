import { useState } from 'react'
import type { CardProps } from '../cardProps'
import { MediaBlock } from '../MediaBlock'
import { normalize } from '../answer'

// Covers the trivia family: question / image_trivia / logic / ispy / crossword
// / decision_tree / mission_code / SingleChoice / MultipleChoice / OpenQuestion.
// Multiple-choice when `answers` is non-empty, otherwise a free-text input.
export default function QuestionCard({
  point,
  result,
  busy,
  onSubmit,
  onContinue,
}: CardProps) {
  const [text, setText] = useState('')
  const choices = (point.answers ?? []).filter(Boolean)
  const answered = result != null
  const rightAnswer = point.right_answer?.trim()

  return (
    <div className="card-inner">
      {point.question && <h2 className="card-q">{point.question}</h2>}
      <MediaBlock images={point.question_images} voice={point.question_voice} />
      {point.story && <p className="card-story">{point.story}</p>}

      {choices.length > 0 ? (
        <div className="choices">
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
      ) : (
        !answered && (
          <form
            className="open-answer"
            onSubmit={(e) => {
              e.preventDefault()
              if (text.trim()) onSubmit(text.trim())
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="…"
              disabled={busy}
              autoFocus
            />
            <button type="submit" disabled={busy || !text.trim()}>
              ✓
            </button>
          </form>
        )
      )}

      {answered && (
        <Feedback result={result} rightAnswer={rightAnswer} onContinue={onContinue} />
      )}
    </div>
  )
}

export function Feedback({
  result,
  rightAnswer,
  onContinue,
}: {
  result: CardProps['result']
  rightAnswer?: string
  onContinue: () => void
}) {
  if (!result) return null
  return (
    <div className="feedback">
      {result.scored ? (
        <div className={result.correct ? 'fb-good' : 'fb-bad'}>
          {result.correct ? '✓ נכון!' : '✗ לא נכון'}
          {!result.correct && rightAnswer && (
            <span className="fb-right"> — {rightAnswer}</span>
          )}
        </div>
      ) : null}
      <button onClick={onContinue}>המשך</button>
    </div>
  )
}
