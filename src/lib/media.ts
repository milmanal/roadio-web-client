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
