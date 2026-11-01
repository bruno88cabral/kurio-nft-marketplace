import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer rounded-md bg-muted bg-[linear-gradient(90deg,transparent_0%,color-mix(in_oklab,var(--muted-foreground)_14%,transparent)_50%,transparent_100%)] bg-[length:200%_100%]", className)}
      {...props}
    />
  )
}

export { Skeleton }
