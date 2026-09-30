import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  tone?: "default" | "positive" | "negative" | "warning"
  className?: string
}) {
  const toneClass = {
    default: "text-foreground",
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-rose-600 dark:text-rose-400",
    warning: "text-amber-600 dark:text-amber-400",
  }[tone]
  return (
    <Card size="sm" className={cn("gap-1", className)}>
      <CardContent className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-base font-semibold break-words tabular-nums sm:text-lg 2xl:text-xl", toneClass)}>{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      </CardContent>
    </Card>
  )
}
