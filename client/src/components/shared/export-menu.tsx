"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { errorMessage } from "@/lib/api"
import { exportToExcel, exportToPdf, type ExportOptions } from "@/lib/export"

/**
 * Export dropdown. `getData` may fetch the full (unpaginated) data set, so it
 * is called lazily when the user picks a format.
 */
export function ExportMenu<T>({
  getData,
  print = true,
}: {
  getData: () => Promise<ExportOptions<T>> | ExportOptions<T>
  print?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const run = async (kind: "excel" | "pdf") => {
    setBusy(true)
    try {
      const opts = await getData()
      if (kind === "excel") await exportToExcel(opts)
      else await exportToPdf(opts)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={busy} />}>
        <Download />
        {busy ? "Exporting…" : "Export"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run("excel")}>
          <FileSpreadsheet /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("pdf")}>
          <FileText /> PDF
        </DropdownMenuItem>
        {print && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.print()}>
              <Printer /> Print
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
