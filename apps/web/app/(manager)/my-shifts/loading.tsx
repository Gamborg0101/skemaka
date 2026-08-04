import { Skeleton } from "@/components/ui/skeleton"

/**
 * /my-shifts is an async server component running ~9 queries, and Neon cold-
 * starts take 10–15s after a few minutes idle. Without a loading boundary Next
 * holds the *previous* screen frozen until the whole page resolves, so tapping
 * the nav item looked like nothing happened — on the employee-facing page,
 * where the audience is least likely to assume the app is fine and wait.
 */
export default function Loading() {
  return (
    <div className="flex flex-col h-full">
      <div className="hidden md:flex items-start justify-between gap-4 px-6 pt-6 pb-2">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-9 w-64" />
      </div>

      <div className="md:hidden px-4 pt-6 pb-2 space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3 w-48" />
      </div>

      <div className="flex-1 px-4 md:px-6 py-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
