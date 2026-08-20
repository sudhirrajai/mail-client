'use client'

export function EmailListSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-xl border border-border/40 bg-card/40 p-3"
        >
          {/* Avatar Skeleton */}
          <div className="size-9 shrink-0 rounded-full bg-muted/60" />

          {/* Lines Skeleton */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="h-3.5 w-24 rounded bg-muted/80" />
              <div className="h-3 w-12 rounded bg-muted/50" />
            </div>
            <div className="h-3 w-3/4 rounded bg-muted/70" />
            <div className="h-2.5 w-full rounded bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmailReaderSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-8 py-8 space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-start gap-4">
        <div className="size-11 shrink-0 rounded-full bg-muted/60" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-3/4 rounded bg-muted/80" />
          <div className="h-4 w-1/3 rounded bg-muted/60" />
          <div className="h-3 w-1/4 rounded bg-muted/40" />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-border/60" />

      {/* Body Lines Skeleton */}
      <div className="space-y-3 pt-2">
        <div className="h-4 w-full rounded bg-muted/70" />
        <div className="h-4 w-11/12 rounded bg-muted/60" />
        <div className="h-4 w-4/5 rounded bg-muted/50" />
        <div className="h-4 w-full rounded bg-muted/60" />
        <div className="h-4 w-2/3 rounded bg-muted/40" />
      </div>

      <div className="space-y-3 pt-4">
        <div className="h-4 w-full rounded bg-muted/60" />
        <div className="h-4 w-5/6 rounded bg-muted/50" />
      </div>
    </div>
  )
}
