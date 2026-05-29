import { isImageUrl, youTubeEmbed, youTubeId } from '../../lib/media'

/** Renders a list of media URLs (images, YouTube links) + an optional audio. */
export function MediaBlock({
  images,
  voice,
}: {
  images?: (string | null)[] | null
  voice?: string | null
}) {
  const urls = (images ?? []).filter((u): u is string => !!u)
  return (
    <>
      {urls.map((url, i) => {
        const yt = youTubeId(url)
        if (yt) {
          return (
            <iframe
              key={i}
              className="media-video"
              src={youTubeEmbed(yt)}
              title="video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )
        }
        if (isImageUrl(url) || /^https?:\/\//.test(url)) {
          return <img key={i} className="media-img" src={url} alt="" />
        }
        return null
      })}
      {voice && (
        <audio className="media-audio" src={voice} controls preload="none" />
      )}
    </>
  )
}
