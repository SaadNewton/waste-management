// Client-side export of tabular data to Excel (.xlsx) and PDF.
// Libraries are imported lazily so they only load when a user exports.

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
  align?: "left" | "right"
  width?: number
}

export interface ExportOptions<T> {
  filename: string
  title: string
  subtitle?: string
  columns: ExportColumn<T>[]
  rows: T[]
  /** Extra rows rendered after the data (e.g. totals). Values are aligned to columns. */
  footer?: (string | number | null)[][]
  orientation?: "portrait" | "landscape"
}

export async function exportToExcel<T>({ filename, title, subtitle, columns, rows, footer }: ExportOptions<T>) {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Sheet1")
  ws.addRow([title]).font = { bold: true, size: 14 }
  if (subtitle) ws.addRow([subtitle]).font = { italic: true, color: { argb: "FF666666" } }
  ws.addRow([])
  const header = ws.addRow(columns.map((c) => c.header))
  header.font = { bold: true }
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }
    cell.border = { bottom: { style: "thin" } }
  })
  for (const row of rows) ws.addRow(columns.map((c) => c.value(row) ?? ""))
  for (const f of footer ?? []) ws.addRow(f.map((v) => v ?? "")).font = { bold: true }
  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1)
    col.width = c.width ?? Math.max(12, c.header.length + 4)
    if (c.align === "right") col.numFmt = "#,##0.##"
  })
  const buffer = await wb.xlsx.writeBuffer()
  download(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`)
}

export async function exportToPdf<T>({ filename, title, subtitle, columns, rows, footer, orientation = "landscape" }: ExportOptions<T>) {
  const { jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" })
  doc.setFontSize(14)
  doc.text(title, 40, 40)
  if (subtitle) {
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(subtitle, 40, 56)
    doc.setTextColor(0)
  }
  const fmt = (v: unknown) =>
    typeof v === "number" ? v.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : v == null ? "" : String(v)
  const columnStyles = Object.fromEntries(
    columns.map((c, i) => [i, { halign: c.align === "right" ? ("right" as const) : ("left" as const) }]),
  )
  autoTable(doc, {
    startY: subtitle ? 68 : 56,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => fmt(c.value(r)))),
    foot: footer?.map((f) => f.map(fmt)),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [38, 38, 38] },
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    columnStyles,
    showFoot: "lastPage",
  })
  doc.save(`${filename}.pdf`)
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
