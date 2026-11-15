// Media helpers. story_images sometimes holds a YouTube URL (e.g. geoguess),
// so image slots need to detect and embed video.

const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/

export function youTubeId(url: string): string | null {
  const m = url.match(YT_RE)
  return m ? m[1] : null
}

export function youTubeEmbed(id: string): string {
  return `https://www.youtube.com/embed/${id}`
}

export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url)
}

// Wikimedia only serves thumbnails at its standard widths now; any other width
// (e.g. ".../220px-x.jpg", common in our quiz data) returns HTTP 400 and the
// image never shows. Round the width up to the next allowed step.
const WIKI_THUMB_STEPS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920]
const WIKI_THUMB_RE = /^(https?:\/\/upload\.wikimedia\.org\/.+\/thumb\/.+\/)(\d+)px-([^/]+)$/

export function fixImageUrl(url: string): string {
  const m = url.match(WIKI_THUMB_RE)
  if (!m) return url
  const want = Number(m[2])
  if (WIKI_THUMB_STEPS.includes(want)) return url
  const step = WIKI_THUMB_STEPS.find((s) => s >= want) ?? 1280
  return `${m[1]}${step}px-${m[3]}`
}
