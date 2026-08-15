import { Skeleton } from "@/components/ui/skeleton";

export default function BrandSetupLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <Skeleton className="h-4 w-96 mt-2 bg-zinc-800" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl bg-zinc-800/50" />
    </div>
  );
}
