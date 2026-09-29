"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Recycle } from "lucide-react"
import { useSettings } from "@/hooks/use-settings"
import { cn } from "@/lib/utils"
import { NAV } from "./nav"

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { data: settings } = useSettings()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Recycle className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{settings?.businessName ?? "Waste Manager"}</p>
          <p className="text-xs text-muted-foreground">Waste Management</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
