import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface TimesheetReportExportRow {
  weekRange: string;
  weekStart: string;
  weekEnd: string;
  employeeName: string;
  employeeEmail: string;
  status: string;
  projectName: string;
  taskName: string;
  billable: string;
  totalHours: number;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  notes: string;
  updatedAt: string;
}

const createFilenameDate = () =>
  new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

export const exportTimesheetReportToExcel = (
  rows: TimesheetReportExportRow[],
  filtersSummary: string,
  title = "Operational Report",
) => {
  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet([
    [title],
    ["Generated At", new Date().toLocaleString()],
    ["Filters", filtersSummary],
    ["Visible Entries", rows.length],
    ["Visible Hours", rows.reduce((sum, row) => sum + row.totalHours, 0)],
  ]);

  const entrySheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      "Week Range": row.weekRange,
      "Week Start": row.weekStart,
      "Week End": row.weekEnd,
      Employee: row.employeeName,
      Email: row.employeeEmail,
      Status: row.status,
      Project: row.projectName,
      Task: row.taskName,
      Billable: row.billable,
      "Total Hours": row.totalHours,
      Monday: row.monday,
      Tuesday: row.tuesday,
      Wednesday: row.wednesday,
      Thursday: row.thursday,
      Friday: row.friday,
      Saturday: row.saturday,
      Sunday: row.sunday,
      Notes: row.notes,
      "Updated At": row.updatedAt,
    })),
  );

  summarySheet["!cols"] = [{ wch: 18 }, { wch: 70 }];
  entrySheet["!cols"] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 28 },
    { wch: 12 },
    { wch: 24 },
    { wch: 24 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 11 },
    { wch: 10 },
    { wch: 30 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(workbook, entrySheet, "Entries");
  XLSX.writeFile(workbook, `operational-report-${createFilenameDate()}.xlsx`);
};

export const exportTimesheetReportToPdf = (
  rows: TimesheetReportExportRow[],
  filtersSummary: string,
  title = "Operational Report",
) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(18);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 60);
  doc.text(`Filters: ${filtersSummary}`, 40, 76, { maxWidth: 760 });

  autoTable(doc, {
    startY: 96,
    head: [["Week", "Employee", "Project", "Task", "Status", "Billable", "Hours"]],
    body: rows.map((row) => [
      row.weekRange,
      row.employeeName,
      row.projectName,
      row.taskName,
      row.status,
      row.billable,
      `${row.totalHours}`,
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 6,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 110 },
      2: { cellWidth: 120 },
      3: { cellWidth: 180 },
      4: { cellWidth: 70 },
      5: { cellWidth: 65 },
      6: { cellWidth: 55, halign: "right" },
    },
  });

  doc.save(`operational-report-${createFilenameDate()}.pdf`);
};
