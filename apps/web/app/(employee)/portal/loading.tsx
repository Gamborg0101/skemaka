import { Skeleton } from "@/components/ui/skeleton"

export default function PortalLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <Skeleton className="h-7 w-40 mb-1.5" />
          <Skeleton className="h-4 w-56" />
        </div>

        {/* Week group */}
        {Array.from({ length: 2 }).map((_, w) => (
          <div key={w} className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            {Array.from({ length: w === 0 ? 3 : 2 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3.5 w-48 mb-1.5" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="size-9 rounded-lg shrink-0" />
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Time off section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {Array.from({ length: 2 }).map((_, i) => (
              <li key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <Skeleton className="h-4 w-36 mb-1.5" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
