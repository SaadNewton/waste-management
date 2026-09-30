import {
  BookOpen,
  CalendarDays,
  HandCoins,
  LayoutDashboard,
  Receipt,
  Settings,
  Truck,
  Users,
  HardHat,
} from "lucide-react"

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/purchases", label: "Purchases", icon: Truck },
  { href: "/parties", label: "Parties", icon: Users },
  { href: "/labour", label: "Labour", icon: HardHat },
  { href: "/payments", label: "Payments", icon: HandCoins },
  { href: "/ledger", label: "Ledger", icon: BookOpen },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/daybook", label: "Daybook", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
] as const
