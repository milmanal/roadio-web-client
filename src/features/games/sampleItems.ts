// Dev-only sample road points (real rows from api_samples/item_samples_by_type
// .json), used to exercise card rendering without a selected game. Tree-shaken
// out of production via the import.meta.env.DEV guard at the call site.

import type { RoadPoint } from '../../types'

const base: Omit<RoadPoint, 'id' | 'type' | 'question' | 'story' | 'answers' | 'right_answer'> = {
  labels: ['label'],
  difficulty: null,
  question_images: [],
  question_voice: null,
  story_images: [],
  story_voices: [],
  multiple_right_answers: [],
  points_first_correct: 200,
  points_second_correct: 100,
  countdown: null,
  marker_family: null,
  top_marker: null,
  html_template_name: null,
  crossword_pre_fill: true,
  coder_mode: false,
  org_game_item_type: 'road_point',
  extra_details: null,
}

export const SAMPLE_ITEMS: RoadPoint[] = [
  {
    ...base,
    id: 990001,
    type: 'question',
    question: 'באיזו עונה מדובר בשיר?',
    story: 'זה קרה בסתיו של השנה שעברה…',
    answers: ['חורף', 'סתיו', 'קיץ'],
    right_answer: 'סתיו',
    question_images: [
      'https://images.genius.com/0825e1858d4a5d746c77cb89e43dccb4.250x250x1.jpg',
    ],
  },
  {
    ...base,
    id: 990002,
    type: 'quantitative',
    question: 'באיזה מיקום במצעד נמצא השיר Thriller?',
    story: '',
    answers: ['87', '35', '62'],
    right_answer: '87',
    extra_details: { he: { chart: 'מצעד שנות השמונים', position: 'לפני' } },
  },
  {
    ...base,
    id: 990004,
    type: 'geoguess',
    question: 'Where was most gold located during the California Gold Rush?',
    story: 'Travelers during the Gold Rush were known as "49ers".',
    answers: [],
    right_answer: null,
    points_first_correct: null,
    points_second_correct: null,
  },
  {
    ...base,
    id: 990003,
    type: 'story',
    question: null,
    story:
      'בשנת 1938 הוקם במקום יישוב של עולי תימן ובמקום ניטע פרדס, שאת פירותיו שלחו התושבים לאירופה.',
    answers: null,
    right_answer: null,
    points_first_correct: 250,
  },
]
