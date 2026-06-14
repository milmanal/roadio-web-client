// Quest (Babylon) background music. Mirrors the Android StandbyActivity's
// bgAudioManager: a single looping ambience track that plays while the quest map
// is up, ducks/pauses while a game card is open, and obeys the mute toggle.
//
// Browsers block autoplay until a user gesture, so the first play() may reject;
// we retry on the next gesture (pointerdown) until it sticks.

import { useEffect, useRef } from 'react'
import { useDriving } from '../../store/driving'
import { useQuestAudio } from './questAudio'

const MUSIC_VOLUME = 0.45

export function useQuestMusic(url: string | null | undefined, enabled: boolean) {
  const muted = useQuestAudio((s) => s.muted)
  // A card being shown pauses the music (the card carries its own audio).
  const cardOpen = useDriving((s) => !!s.activeCard)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Create/swap the audio element when the track url changes.
  useEffect(() => {
    if (!enabled || !url) {
      audioRef.current?.pause()
      audioRef.current = null
      return
    }
    const audio = new Audio(url)
    audio.loop = true
    audio.volume = MUSIC_VOLUME
    audioRef.current = audio
    return () => {
      audio.pause()
      if (audioRef.current === audio) audioRef.current = null
    }
  }, [url, enabled])

  // Drive play/pause from mute + card state. Retry play on the next user
  // gesture when the browser blocks autoplay.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const shouldPlay = enabled && !muted && !cardOpen

    if (!shouldPlay) {
      audio.pause()
      return
    }

    let detach: (() => void) | undefined
    const tryPlay = () => {
      audio.play().catch(() => {
        // Autoplay blocked — wait for a gesture, then try once more.
        if (detach) return
        const onGesture = () => {
          audio.play().catch(() => {})
          detach?.()
        }
        window.addEventListener('pointerdown', onGesture, { once: true })
        detach = () => {
          window.removeEventListener('pointerdown', onGesture)
          detach = undefined
        }
      })
    }
    tryPlay()
    return () => detach?.()
  }, [enabled, muted, cardOpen, url])
}
