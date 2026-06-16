import type { PostStatus } from "@prisma/client";
import { cn, POST_STATUS_COLORS, POST_STATUS_LABELS } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: PostStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        POST_STATUS_COLORS[status],
        className,
      )}
    >
      {POST_STATUS_LABELS[status]}
    </span>
  );
}
