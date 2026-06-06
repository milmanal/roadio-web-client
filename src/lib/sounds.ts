// Thin wrapper around the Web Audio API for game sound effects.
// All sounds are lazy-loaded on first play and cached. Silently no-ops
// in environments without audio support (e.g. headless test runners).

const cache: Record<string, HTMLAudioElement> = {}

function play(src: string, volume = 1) {
  try {
    let audio = cache[src]
    if (!audio) {
      audio = new Audio(src)
      cache[src] = audio
    }
    audio.volume = volume
    audio.currentTime = 0
    audio.play().catch(() => {})
  } catch {
    // audio unavailable — ignore
  }
}

export const Sounds = {
  newQuestion: () => play('/sounds/new_question.wav', 0.7),
  correct:     () => play('/sounds/correct.wav'),
  wrong:       () => play('/sounds/wrong.wav'),
  next:        () => play('/sounds/next.wav', 0.8),
  proximity:   () => play('/sounds/proximity.wav', 0.6),
}
