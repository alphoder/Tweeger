import { Skeleton } from "@/components/ui/skeleton";

export default function ReviewDeckLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <Skeleton className="h-4 w-64 mt-2 bg-zinc-800" />
      </div>
      <Skeleton className="h-[400px] w-full rounded-2xl bg-zinc-800/50" />
      <div className="flex items-center justify-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full bg-zinc-800" />
        <Skeleton className="h-12 w-12 rounded-full bg-zinc-800" />
        <Skeleton className="h-14 w-14 rounded-full bg-zinc-800" />
      </div>
    </div>
  );
}
