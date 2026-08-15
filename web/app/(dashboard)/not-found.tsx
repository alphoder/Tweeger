import { FileQuestion, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4 max-w-md">
        <div className="inline-flex p-4 rounded-full bg-zinc-800">
          <FileQuestion className="h-8 w-8 text-zinc-500" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-100">Page Not Found</h2>
        <p className="text-sm text-zinc-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
