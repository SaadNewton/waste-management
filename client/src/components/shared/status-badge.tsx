import { Badge } from "@/components/ui/badge"

export function StatusBadge({ active, deleted }: { active: boolean; deleted?: boolean }) {
  if (deleted) return <Badge variant="destructive">Deleted</Badge>
  return active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>
}
