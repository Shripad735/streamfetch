import Badge from "./ui/Badge";
import Card from "./ui/Card";
import { formatDuration } from "../lib/app-formatters";

function VideoInfoCard({ title, thumbnail, extractor, duration, isPlaylist, playlistCount }) {
  return (
    <Card as="section" className="overflow-hidden p-4 min-h-[184px]">
      <div className="grid gap-5 md:grid-cols-[240px_1fr]">
        {thumbnail ? (
          <div className="h-40 overflow-hidden rounded-2xl bg-app-subtleBg md:h-44">
            <img src={thumbnail} alt={title} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="grid h-40 w-full place-items-center rounded-2xl border border-app-border bg-app-bg text-sm text-app-muted md:h-44">
            No Preview
          </div>
        )}

        <div className="flex min-w-0 flex-col justify-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">Fetched media</p>
          <h2 className="mt-2 line-clamp-2 font-display text-xl font-semibold text-app-text" title={title}>
            {title}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="info">Source: {extractor}</Badge>
            <Badge variant="info">Duration: {formatDuration(duration)}</Badge>
            {isPlaylist && <Badge variant="info">Playlist items: {playlistCount}</Badge>}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default VideoInfoCard;
