import Card from "./ui/Card";

function VideoInfoSkeleton() {
  return (
    <Card as="section" className="animate-pulse p-4 min-h-[184px]">
      <div className="grid gap-5 md:grid-cols-[240px_1fr]">
        <div className="h-40 rounded-2xl bg-app-subtleBg md:h-44" />
        <div className="space-y-3 py-2">
          <div className="h-4 w-24 rounded-full bg-app-subtleBg" />
          <div className="h-6 w-4/5 rounded-full bg-app-subtleBg" />
          <div className="h-4 w-2/3 rounded-full bg-app-subtleBg" />
          <div className="h-4 w-1/2 rounded-full bg-app-subtleBg" />
        </div>
      </div>
    </Card>
  );
}

export default VideoInfoSkeleton;
