interface PrintableReportOptions {
  columns: string[];
  generatedBy: string;
  subtitle: string;
  title: string;
}

function escapeCsvValue(value: string | number | null | undefined) {
  const normalizedValue = value == null ? "" : String(value);

  return `"${normalizedValue.replaceAll('"', '""')}"`;
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function escapeHtml(value: string | number | null | undefined) {
  const normalizedValue = value == null ? "" : String(value);

  return normalizedValue
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function downloadCsvReport(
  filename: string,
  columns: string[],
  rows: Array<Array<string | number | null | undefined>>
) {
  const csvContent = [
    columns.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\n");

  downloadBlob(csvContent, filename, "text/csv;charset=utf-8");
}

export function printReportTable(
  rows: Array<Array<string | number | null | undefined>>,
  options: PrintableReportOptions
) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    window.print();
    return;
  }

  const generatedAt = new Date().toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const headerCells = options.columns
    .map((column) => `<th>${escapeHtml(column)}</th>`)
    .join("");
  const bodyRows = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${row
              .map((value) => `<td>${escapeHtml(value)}</td>`)
              .join("")}</tr>`
        )
        .join("")
    : `<tr><td colspan="${options.columns.length}">No rows available.</td></tr>`;

  printWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(options.title)}</title>
        <style>
          body {
            margin: 32px;
            color: #102a43;
            font-family: Avenir Next, Avenir, Nunito Sans, Trebuchet MS, sans-serif;
          }

          .report-meta {
            margin-bottom: 24px;
            color: #486581;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }

          h1 {
            margin: 0 0 8px;
            font-size: 28px;
            letter-spacing: -0.04em;
          }

          p {
            margin: 0 0 16px;
            color: #486581;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }

          th,
          td {
            padding: 12px 10px;
            border-bottom: 1px solid #d9e2ec;
            text-align: left;
            vertical-align: top;
            overflow-wrap: anywhere;
          }

          th {
            background: #f0fdfa;
            color: #0f766e;
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          @media print {
            body {
              margin: 18mm 14mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="report-meta">
          Generated ${escapeHtml(generatedAt)} · ${escapeHtml(options.generatedBy)}
        </div>
        <h1>${escapeHtml(options.title)}</h1>
        <p>${escapeHtml(options.subtitle)}</p>
        <table>
          <thead>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
        <script>
          window.onload = () => {
            window.print();
            window.onafterprint = () => window.close();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
