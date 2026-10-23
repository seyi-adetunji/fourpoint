import { eachDayOfInterval, format } from "date-fns";

export interface TimesheetEmployee {
  empCode: string;
  department: string;
  surname: string;
  givenNames: string;
  fullName: string;
}

export interface TimesheetDayCell {
  dateStr: string; // YYYY-MM-DD
  shifts: 0 | 1 | 2; // 0 = "0", 1 = "✓", 2 = "✓✓"
}

export interface TimesheetRow {
  employee: TimesheetEmployee;
  days: Record<string, 0 | 1 | 2>; // dateStr -> 0 | 1 | 2
  totalShifts: number;
}

export interface TimesheetExportOptions {
  departmentLabel: string; // e.g. "HR" or "All Departments"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  rows: TimesheetRow[];
  preparedBy?: string;
  subtitleNote?: string; // e.g. "Staff Gate Attendance" or "Canteen Meal Punches"
  filePrefix?: string;
}

const DOW_ABBR: Record<number, string> = {
  0: "Su",
  1: "M",
  2: "Tu",
  3: "W",
  4: "Th",
  5: "F",
  6: "Sa",
};

function escapeHtml(val: string | number | null | undefined): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function splitEmployeeName(
  firstNameRaw: string | null | undefined,
  lastNameRaw?: string | null | undefined
): { surname: string; givenNames: string; displayFullName: string } {
  const first = (firstNameRaw || "").trim();
  const last = (lastNameRaw || "").trim();

  if (last) {
    return {
      surname: last,
      givenNames: first,
      displayFullName: `${last} ${first}`.trim(),
    };
  }

  const parts = first.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      surname: parts[0],
      givenNames: parts.slice(1).join(" "),
      displayFullName: first,
    };
  }

  return {
    surname: first || "—",
    givenNames: "",
    displayFullName: first || "—",
  };
}

function getDateColumns(startDateStr: string, endDateStr: string) {
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  const days = eachDayOfInterval({
    start: start <= end ? start : end,
    end: end >= start ? end : start,
  });

  return days.map((d) => {
    const dow = d.getDay();
    return {
      dateStr: format(d, "yyyy-MM-dd"),
      dowLabel: DOW_ABBR[dow] || "",
      dayNum: d.getDate(),
      isWeekend: dow === 0 || dow === 6,
    };
  });
}

function getMonthAndYearLabels(startDateStr: string, endDateStr: string) {
  const s = new Date(`${startDateStr}T00:00:00`);
  const e = new Date(`${endDateStr}T00:00:00`);
  const sameMonth =
    s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();

  const monthLabel = sameMonth
    ? format(s, "MMMM")
    : `${format(s, "MMM")} – ${format(e, "MMM")}`;
  const yearLabel =
    s.getFullYear() === e.getFullYear()
      ? String(s.getFullYear())
      : `${s.getFullYear()}/${e.getFullYear()}`;

  return { monthLabel, yearLabel };
}

/**
 * Generates an Excel (.xls) workbook styled identically to the
 * Four Points by Sheraton Lagos "FT Associate Time Sheet" template,
 * using ✓ for 1 shift, ✓✓ for double shift, and 0 for absent/off.
 */
export function exportTimesheetExcel(opts: TimesheetExportOptions) {
  if (opts.rows.length === 0) {
    alert("No attendance records found to export for the selected filter.");
    return;
  }

  const dateCols = getDateColumns(opts.startDate, opts.endDate);
  const { monthLabel, yearLabel } = getMonthAndYearLabels(
    opts.startDate,
    opts.endDate
  );
  const grandTotal = opts.rows.reduce((sum, r) => sum + r.totalShifts, 0);
  const totalDayCols = dateCols.length;
  // Total columns in sheet: [Row#] [ID No.] [Dept] [Surname] [Given Names] [...days] [Totals]
  const rightMetaStartSpan = Math.max(2, totalDayCols - 4);

  const dowHeadersHtml = dateCols
    .map(
      (c) =>
        `<td style="background:#FFC000;font-weight:bold;text-align:center;font-size:9pt;border-top:0.5pt solid #000;border-bottom:none;">${c.dowLabel}</td>`
    )
    .join("");

  const dayNumHeadersHtml = dateCols
    .map(
      (c) =>
        `<td style="background:${
          c.isWeekend ? "#BFBFBF" : "#FFC000"
        };font-weight:bold;text-align:center;font-size:9pt;border-bottom:1pt solid #000;">${
          c.dayNum
        }</td>`
    )
    .join("");

  const dataRowsHtml = opts.rows
    .map((row, idx) => {
      const cellsHtml = dateCols
        .map((c) => {
          const val = row.days[c.dateStr] ?? 0;
          if (val === 2) {
            return `<td style="background:#FFFF00;color:#000000;font-weight:bold;text-align:center;border:0.5pt solid #7F7F7F;mso-number-format:'\\@';">&#10003;&#10003;</td>`;
          }
          if (val === 1) {
            return `<td style="background:#FFFF00;color:#000000;font-weight:bold;text-align:center;border:0.5pt solid #7F7F7F;mso-number-format:'\\@';">&#10003;</td>`;
          }
          return `<td style="background:#BFBFBF;color:#000000;text-align:center;border:0.5pt solid #7F7F7F;">0</td>`;
        })
        .join("");

      return `
        <tr style="height:19pt;">
          <td style="text-align:center;font-size:9pt;color:#333333;">${idx + 1}</td>
          <td style="background:#92D050;text-align:center;font-weight:bold;border:0.5pt solid #7F7F7F;mso-number-format:'\\@';">${escapeHtml(
            row.employee.empCode
          )}</td>
          <td style="background:#FFFFFF;text-align:left;border:0.5pt solid #7F7F7F;padding-left:4px;">${escapeHtml(
            row.employee.department
          )}</td>
          <td style="background:#FFFFFF;text-align:left;border:0.5pt solid #7F7F7F;padding-left:4px;">${escapeHtml(
            row.employee.surname
          )}</td>
          <td style="background:#FFFFFF;text-align:left;border:0.5pt solid #7F7F7F;padding-left:4px;">${escapeHtml(
            row.employee.givenNames
          )}</td>
          ${cellsHtml}
          <td style="background:#F8CBAD;text-align:center;font-weight:bold;border-left:1pt solid #000;border-right:1pt solid #000;border-top:0.5pt solid #7F7F7F;border-bottom:0.5pt solid #7F7F7F;">${
            row.totalShifts
          }</td>
        </tr>`;
    })
    .join("");

  const html = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>FT Associate Time Sheet</x:Name>
          <x:WorksheetOptions>
            <x:Print>
              <x:ValidPrinterInfo/>
              <x:PaperSizeIndex>9</x:PaperSizeIndex>
              <x:HorizontalResolution>600</x:HorizontalResolution>
              <x:VerticalResolution>600</x:VerticalResolution>
            </x:Print>
            <x:PageSetup>
              <x:Layout x:Orientation="Landscape"/>
            </x:PageSetup>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body, table, td, th { font-family: Calibri, Arial, sans-serif; font-size: 10pt; }
  </style>
</head>
<body style="background:#D9D9D9;">
  <table cellspacing="0" cellpadding="2" style="border-collapse:collapse;">
    <!-- Title Row 1 -->
    <tr style="height:26pt;">
      <td></td>
      <td colspan="2" rowspan="4" style="background:#FFFFFF;border:1pt solid #BFBFBF;text-align:center;vertical-align:middle;padding:6px;">
        <div style="font-size:12pt;font-weight:bold;letter-spacing:1px;color:#222;">FOUR <span style="color:#00A8B5;">&#10022;</span></div>
        <div style="font-size:12pt;font-weight:bold;letter-spacing:1px;color:#222;">POINTS</div>
        <div style="font-size:7pt;letter-spacing:1.5px;color:#555;">BY SHERATON</div>
        <div style="font-size:7.5pt;font-weight:bold;color:#222;margin-top:3px;">Lagos</div>
      </td>
      <td colspan="${2 + totalDayCols + 1}" style="font-size:18pt;font-weight:bold;color:#000000;padding-left:8px;">
        Four Points by Sheraton Lagos
      </td>
    </tr>
    <!-- Title Row 2 -->
    <tr style="height:22pt;">
      <td></td>
      <td colspan="${2 + totalDayCols + 1}" style="font-size:15pt;font-weight:bold;color:#000000;padding-left:8px;">
        FT Associate Time Sheet${opts.subtitleNote ? ` (${escapeHtml(opts.subtitleNote)})` : ""}
      </td>
    </tr>
    <!-- Metadata Row 3: Dept & Month -->
    <tr style="height:20pt;">
      <td></td>
      <td style="font-size:12pt;font-weight:bold;color:#C00000;padding-left:8px;">Dept:</td>
      <td colspan="2" style="font-size:12pt;font-weight:bold;color:#000000;text-align:center;border-bottom:1pt solid #000000;">
        ${escapeHtml(opts.departmentLabel)}
      </td>
      <td colspan="${rightMetaStartSpan}"></td>
      <td colspan="2" style="font-size:10pt;font-weight:bold;color:#C00000;text-align:right;padding-right:6px;">Month:</td>
      <td colspan="3" style="font-size:12pt;font-weight:bold;color:#000000;text-align:center;border-bottom:1pt solid #000000;">
        ${escapeHtml(monthLabel)}
      </td>
      <td></td>
    </tr>
    <!-- Metadata Row 4: Year -->
    <tr style="height:20pt;">
      <td></td>
      <td colspan="${3 + rightMetaStartSpan}"></td>
      <td colspan="2" style="font-size:10pt;color:#000000;text-align:right;padding-right:6px;">Year</td>
      <td colspan="3" style="font-size:12pt;font-weight:bold;color:#000000;text-align:center;border-bottom:1pt solid #000000;">
        ${escapeHtml(yearLabel)}
      </td>
      <td></td>
    </tr>
    <!-- Blank Spacer Row -->
    <tr style="height:10pt;"><td colspan="${6 + totalDayCols}"></td></tr>

    <!-- Table Header Row 1 -->
    <tr style="height:18pt;">
      <td></td>
      <td rowspan="3" style="background:#FFC000;font-weight:bold;text-align:center;vertical-align:middle;border:1pt solid #000000;width:54pt;">ID No.</td>
      <td rowspan="3" style="background:#FFC000;font-weight:bold;text-align:center;vertical-align:middle;border:1pt solid #000000;width:85pt;">Dept</td>
      <td colspan="2" rowspan="2" style="background:#FFC000;font-weight:bold;text-align:center;vertical-align:bottom;border-top:1pt solid #000000;border-left:1pt solid #000000;border-right:1pt solid #000000;">Name</td>
      <td colspan="${totalDayCols}" style="background:#FFC000;color:#C00000;font-weight:bold;font-size:9pt;text-align:center;border-top:1pt solid #000000;border-left:1pt solid #000000;border-right:1pt solid #000000;">
        Shift Attendance Record: &#10003; = 1 Shift, &#10003;&#10003; = Double Shift, &quot;0&quot; = Did Not Work
      </td>
      <td rowspan="2" style="background:#FFC000;font-weight:bold;font-size:11pt;text-align:center;vertical-align:middle;border-top:1pt solid #000000;border-left:1pt solid #000000;border-right:1pt solid #000000;width:72pt;">Totals</td>
    </tr>

    <!-- Table Header Row 2: Day of Week -->
    <tr style="height:15pt;">
      <td></td>
      ${dowHeadersHtml}
    </tr>

    <!-- Table Header Row 3: Surname / Given Names / Day Numbers / Shifts Worked -->
    <tr style="height:16pt;">
      <td></td>
      <td style="background:#FFC000;font-size:9pt;text-align:center;border-bottom:1pt solid #000000;border-left:1pt solid #000000;width:95pt;">Surname</td>
      <td style="background:#FFC000;font-size:9pt;text-align:center;border-bottom:1pt solid #000000;border-right:1pt solid #000000;width:110pt;">Given Names</td>
      ${dayNumHeadersHtml}
      <td style="background:#F4B084;font-weight:bold;font-size:8.5pt;text-align:center;border:1pt solid #000000;">Shifts Worked</td>
    </tr>

    <!-- Employee Data Rows -->
    ${dataRowsHtml}

    <!-- Grand Total Row -->
    <tr style="height:22pt;">
      <td colspan="${5 + totalDayCols}"></td>
      <td style="background:#FFC000;font-size:12pt;font-weight:bold;text-align:center;border:1pt solid #000000;">
        ${grandTotal}
      </td>
    </tr>

    <!-- Human Resources Label -->
    <tr style="height:18pt;">
      <td colspan="${Math.max(5, Math.floor((5 + totalDayCols) * 0.6))}"></td>
      <td colspan="6" style="font-size:9.5pt;color:#000000;">Human Resources:</td>
    </tr>

    <tr style="height:28pt;"><td colspan="${6 + totalDayCols}"></td></tr>

    <!-- Signature Row 1 (Names / Lines) -->
    <tr style="height:18pt;">
      <td></td>
      <td colspan="3" style="border-bottom:1pt solid #000000;font-size:10pt;">
        ${escapeHtml(opts.preparedBy || "")}
      </td>
      <td colspan="${Math.max(2, Math.floor(totalDayCols * 0.55))}"></td>
      <td colspan="5" style="border-bottom:1pt solid #000000;font-size:10pt;"></td>
    </tr>
    <!-- Signature Row 2 (Labels) -->
    <tr style="height:16pt;">
      <td></td>
      <td colspan="3" style="font-size:9pt;color:#000000;">PREPARED BY</td>
      <td colspan="${Math.max(2, Math.floor(totalDayCols * 0.55))}"></td>
      <td colspan="5" style="font-size:9pt;color:#000000;">Approved By</td>
    </tr>
  </table>
</body>
</html>`;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const link = document.createElement("a");
  const safeDept = opts.departmentLabel.replace(/[^a-zA-Z0-9]+/g, "_");
  const prefix = opts.filePrefix || "FT_Associate_Time_Sheet";
  link.href = URL.createObjectURL(blob);
  link.download = `${prefix}_${safeDept}_${monthLabel}_${yearLabel}.xls`;
  link.click();
}

/**
 * Opens a print-ready Landscape PDF view styled identically to the
 * Four Points by Sheraton Lagos "FT Associate Time Sheet" template.
 */
export function exportTimesheetPDF(opts: TimesheetExportOptions) {
  if (opts.rows.length === 0) {
    alert("No attendance records found to export for the selected filter.");
    return;
  }

  const win = window.open("", "_blank", "width=1280,height=850");
  if (!win) {
    window.print();
    return;
  }

  const dateCols = getDateColumns(opts.startDate, opts.endDate);
  const { monthLabel, yearLabel } = getMonthAndYearLabels(
    opts.startDate,
    opts.endDate
  );
  const grandTotal = opts.rows.reduce((sum, r) => sum + r.totalShifts, 0);

  const dowHeadersHtml = dateCols
    .map((c) => `<th class="dow-cell">${c.dowLabel}</th>`)
    .join("");

  const dayNumHeadersHtml = dateCols
    .map(
      (c) =>
        `<th class="day-num-cell ${c.isWeekend ? "weekend-hdr" : ""}">${
          c.dayNum
        }</th>`
    )
    .join("");

  const rowsHtml = opts.rows
    .map((row, idx) => {
      const dayCells = dateCols
        .map((c) => {
          const val = row.days[c.dateStr] ?? 0;
          if (val === 2) {
            return `<td class="shift-cell worked double">&#10003;&#10003;</td>`;
          }
          if (val === 1) {
            return `<td class="shift-cell worked">&#10003;</td>`;
          }
          return `<td class="shift-cell off">0</td>`;
        })
        .join("");

      return `
        <tr>
          <td class="row-idx">${idx + 1}</td>
          <td class="id-cell">${escapeHtml(row.employee.empCode)}</td>
          <td class="text-cell">${escapeHtml(row.employee.department)}</td>
          <td class="text-cell">${escapeHtml(row.employee.surname)}</td>
          <td class="text-cell">${escapeHtml(row.employee.givenNames)}</td>
          ${dayCells}
          <td class="total-cell">${row.totalShifts}</td>
        </tr>`;
    })
    .join("");

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Four Points by Sheraton Lagos — FT Associate Time Sheet (${escapeHtml(
    opts.departmentLabel
  )} - ${escapeHtml(monthLabel)} ${escapeHtml(yearLabel)})</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Calibri, Arial, Helvetica, sans-serif;
      background: #e5e7eb;
      margin: 0;
      padding: 16px;
      color: #000;
    }
    .sheet-container {
      background: #dcdcdc;
      padding: 18px 20px 26px 14px;
      border-radius: 4px;
    }
    @media print {
      body {
        background: #dcdcdc;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
    .top-banner {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-left: 24px;
    }
    .brand-left {
      display: flex;
      align-items: flex-start;
      gap: 18px;
    }
    .logo-box {
      width: 96px;
      background: #ffffff;
      padding: 10px 8px 8px 10px;
      border: 1px solid #c4c4c4;
      flex-shrink: 0;
    }
    .logo-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo-four {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #231f20;
      line-height: 1.05;
    }
    .logo-sub {
      font-size: 7.5px;
      letter-spacing: 1.4px;
      color: #4b5563;
      margin-top: 2px;
    }
    .logo-divider {
      border-top: 1px solid #d1d5db;
      margin: 6px 0 4px;
    }
    .logo-city {
      font-size: 9px;
      font-weight: 700;
      color: #111827;
    }
    .titles-area h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #000;
    }
    .titles-area h2 {
      margin: 3px 0 12px;
      font-size: 18px;
      font-weight: 700;
      color: #000;
    }
    .dept-line {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    .dept-label {
      color: #c00000;
      font-weight: 700;
      font-size: 14px;
    }
    .dept-value {
      min-width: 190px;
      text-align: center;
      font-weight: 700;
      font-size: 14px;
      border-bottom: 1.5px solid #000;
      padding: 0 12px 2px;
    }
    .meta-right {
      margin-top: 38px;
      margin-right: 40px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .meta-row {
      display: flex;
      align-items: baseline;
      justify-content: flex-end;
      gap: 8px;
    }
    .month-label {
      color: #c00000;
      font-weight: 700;
      font-size: 12px;
    }
    .year-label {
      color: #000;
      font-size: 12px;
    }
    .meta-val {
      width: 110px;
      text-align: center;
      font-weight: 700;
      font-size: 14px;
      border-bottom: 1.5px solid #000;
      padding-bottom: 1px;
    }
    table.timesheet {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    table.timesheet th,
    table.timesheet td {
      padding: 2px 3px;
    }
    .hdr-yellow {
      background: #ffc000;
      border: 1px solid #000;
      font-weight: 700;
      text-align: center;
    }
    .hdr-instruction {
      background: #ffc000;
      color: #c00000;
      font-weight: 700;
      font-size: 9.5px;
      text-align: center;
      border-top: 1px solid #000;
      border-left: 1px solid #000;
      border-right: 1px solid #000;
    }
    .dow-cell {
      background: #ffc000;
      font-weight: 700;
      font-size: 8.5px;
      text-align: center;
      min-width: 18px;
    }
    .day-num-cell {
      background: #ffc000;
      font-weight: 700;
      font-size: 8.5px;
      text-align: center;
      border-bottom: 1px solid #000;
    }
    .day-num-cell.weekend-hdr {
      background: #bfbfbf;
    }
    .hdr-shifts-worked {
      background: #f4b084;
      border: 1px solid #000;
      font-weight: 700;
      font-size: 8.5px;
      text-align: center;
      width: 68px;
    }
    .row-idx {
      width: 22px;
      text-align: center;
      font-size: 9px;
      color: #111;
      border: none;
    }
    .id-cell {
      background: #92d050;
      border: 0.5px solid #7f7f7f;
      border-left: 1px solid #000;
      text-align: center;
      font-weight: 600;
      width: 48px;
    }
    .text-cell {
      background: #ffffff;
      border: 0.5px solid #7f7f7f;
      text-align: left;
      padding-left: 5px !important;
      white-space: nowrap;
    }
    .shift-cell {
      border: 0.5px solid #7f7f7f;
      text-align: center;
      font-size: 9px;
      min-width: 18px;
    }
    .shift-cell.worked {
      background: #ffff00;
      font-weight: 700;
      color: #000;
    }
    .shift-cell.worked.double {
      background: #ffe600;
      font-weight: 800;
      letter-spacing: -1px;
    }
    .shift-cell.off {
      background: #bfbfbf;
      color: #000;
    }
    .total-cell {
      background: #f8cbad;
      border-top: 0.5px solid #7f7f7f;
      border-bottom: 0.5px solid #7f7f7f;
      border-left: 1px solid #000;
      border-right: 1px solid #000;
      text-align: center;
      font-weight: 700;
    }
    .grand-total-cell {
      background: #ffc000;
      border: 1.5px solid #000;
      text-align: center;
      font-weight: 800;
      font-size: 13px;
      padding: 4px !important;
    }
    .footer-hr {
      margin-top: 8px;
      padding-left: 58%;
      font-size: 10px;
    }
    .signatures {
      margin-top: 34px;
      padding: 0 18% 0 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .sig-block {
      width: 180px;
    }
    .sig-line {
      border-bottom: 1px solid #000;
      min-height: 18px;
      font-size: 10.5px;
      padding-bottom: 2px;
    }
    .sig-caption {
      font-size: 9.5px;
      margin-top: 3px;
    }
    .toolbar {
      margin-bottom: 10px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .print-btn {
      background: #1d4ed8;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 7px 14px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="sheet-container">
    <div class="top-banner">
      <div class="brand-left">
        <div class="logo-box">
          <div class="logo-row">
            <div class="logo-four">FOUR<br/>POINTS</div>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2 L15 9 L12 12 Z" fill="#00A8B5"/>
              <path d="M22 12 L15 15 L12 12 Z" fill="#F26649"/>
              <path d="M12 22 L9 15 L12 12 Z" fill="#FDB913"/>
              <path d="M2 12 L9 9 L12 12 Z" fill="#7AC143"/>
            </svg>
          </div>
          <div class="logo-sub">BY SHERATON</div>
          <div class="logo-divider"></div>
          <div class="logo-city">Lagos</div>
        </div>

        <div class="titles-area">
          <h1>Four Points by Sheraton Lagos</h1>
          <h2>FT Associate Time Sheet${
            opts.subtitleNote ? ` <span style="font-size:12px;font-weight:600;color:#374151;">(${escapeHtml(opts.subtitleNote)})</span>` : ""
          }</h2>
          <div class="dept-line">
            <span class="dept-label">Dept:</span>
            <span class="dept-value">${escapeHtml(opts.departmentLabel)}</span>
          </div>
        </div>
      </div>

      <div class="meta-right">
        <div class="meta-row">
          <span class="month-label">Month:</span>
          <span class="meta-val">${escapeHtml(monthLabel)}</span>
        </div>
        <div class="meta-row">
          <span class="year-label">Year</span>
          <span class="meta-val">${escapeHtml(yearLabel)}</span>
        </div>
      </div>
    </div>

    <table class="timesheet">
      <thead>
        <tr>
          <th class="row-idx"></th>
          <th rowspan="3" class="hdr-yellow">ID No.</th>
          <th rowspan="3" class="hdr-yellow" style="width:76px;">Dept</th>
          <th colspan="2" rowspan="2" class="hdr-yellow" style="border-bottom:none;">Name</th>
          <th colspan="${dateCols.length}" class="hdr-instruction">
            Shift Attendance Record: &#10003; = 1 Shift, &#10003;&#10003; = Double Shift, &quot;0&quot; = Did Not Work
          </th>
          <th rowspan="2" class="hdr-yellow" style="font-size:11px;">Totals</th>
        </tr>
        <tr>
          <th class="row-idx"></th>
          ${dowHeadersHtml}
        </tr>
        <tr>
          <th class="row-idx"></th>
          <th class="hdr-yellow" style="border-top:none;font-weight:600;width:88px;">Surname</th>
          <th class="hdr-yellow" style="border-top:none;font-weight:600;width:105px;">Given Names</th>
          ${dayNumHeadersHtml}
          <th class="hdr-shifts-worked">Shifts Worked</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr>
          <td colspan="${5 + dateCols.length}" style="border:none;"></td>
          <td class="grand-total-cell">${grandTotal}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer-hr">Human Resources:</div>

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line">${escapeHtml(opts.preparedBy || "")}</div>
        <div class="sig-caption">PREPARED BY</div>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-caption">Approved By</div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`);
  win.document.close();
}
