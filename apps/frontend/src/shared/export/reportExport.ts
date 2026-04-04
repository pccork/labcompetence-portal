interface PrintableReportOptions {
  columns: string[];
  generatedBy: string;
  subtitle: string;
  title: string;
}

interface PrintableTrainingRecordSection {
  label: string;
  value: string | number | null | undefined;
}

interface PrintableTrainingRecordTable {
  columns: string[];
  rows: Array<Array<string | number | null | undefined>>;
  title: string;
}

interface PrintableTrainingRecordOptions {
  details: PrintableTrainingRecordSection[];
  generatedBy: string;
  jsonPayload?: Record<string, unknown>;
  subtitle: string;
  tables: PrintableTrainingRecordTable[];
  title: string;
}

interface PrintableTemplateOptions {
  details: PrintableTrainingRecordSection[];
  generatedBy: string;
  schemaJson?: Record<string, unknown> | undefined;
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

export function printTrainingRecordReport(
  options: PrintableTrainingRecordOptions
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

  const detailCards = options.details
    .map(
      (detail) => `
        <article class="detail-card">
          <p class="detail-label">${escapeHtml(detail.label)}</p>
          <p class="detail-value">${escapeHtml(detail.value)}</p>
        </article>
      `
    )
    .join("");

  const tableSections = options.tables
    .map((table) => {
      const headerCells = table.columns
        .map((column) => `<th>${escapeHtml(column)}</th>`)
        .join("");
      const bodyRows = table.rows.length
        ? table.rows
            .map(
              (row) =>
                `<tr>${row
                  .map((value) => `<td>${escapeHtml(value)}</td>`)
                  .join("")}</tr>`
            )
            .join("")
        : `<tr><td colspan="${table.columns.length}">No rows available.</td></tr>`;

      return `
        <section class="report-section">
          <h2>${escapeHtml(table.title)}</h2>
          <table>
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  const jsonPayload = options.jsonPayload
    ? `<section class="report-section">
        <h2>Assessment payload</h2>
        <pre>${escapeHtml(JSON.stringify(options.jsonPayload, null, 2))}</pre>
      </section>`
    : "";

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

          .report-meta,
          .detail-label {
            color: #486581;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }

          h1 {
            margin: 0 0 8px;
            font-size: 30px;
            letter-spacing: -0.04em;
          }

          h2 {
            margin: 0 0 14px;
            font-size: 18px;
            letter-spacing: -0.03em;
          }

          .report-subtitle {
            margin: 0 0 24px;
            color: #486581;
          }

          .detail-grid {
            display: grid;
            gap: 14px;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            margin: 28px 0;
          }

          .detail-card {
            border: 1px solid #d9e2ec;
            border-radius: 18px;
            padding: 14px 16px;
            background: #f8fafc;
          }

          .detail-label,
          .detail-value {
            margin: 0;
          }

          .detail-value {
            margin-top: 8px;
            font-size: 15px;
            font-weight: 700;
            overflow-wrap: anywhere;
          }

          .report-section {
            margin-top: 30px;
            page-break-inside: avoid;
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

          pre {
            margin: 0;
            padding: 16px;
            border-radius: 16px;
            background: #0f172a;
            color: #e2e8f0;
            font-size: 12px;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
          }

          @media print {
            body {
              margin: 18mm 14mm;
            }

            .detail-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
        </style>
      </head>
      <body>
        <div class="report-meta">
          Generated ${escapeHtml(generatedAt)} · ${escapeHtml(options.generatedBy)}
        </div>
        <h1>${escapeHtml(options.title)}</h1>
        <p class="report-subtitle">${escapeHtml(options.subtitle)}</p>
        <section class="detail-grid">${detailCards}</section>
        ${tableSections}
        ${jsonPayload}
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

export function printTemplateReport(options: PrintableTemplateOptions) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    window.print();
    return;
  }

  const generatedAt = new Date().toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const detailCards = options.details
    .map(
      (detail) => `
        <article class="detail-card">
          <p class="detail-label">${escapeHtml(detail.label)}</p>
          <p class="detail-value">${escapeHtml(detail.value)}</p>
        </article>
      `
    )
    .join("");

  const schemaSection = options.schemaJson
    ? `<section class="report-section">
        <h2>Template schema</h2>
        <pre>${escapeHtml(JSON.stringify(options.schemaJson, null, 2))}</pre>
      </section>`
    : "";

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

          .report-meta,
          .detail-label {
            color: #486581;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }

          h1 {
            margin: 0 0 8px;
            font-size: 30px;
            letter-spacing: -0.04em;
          }

          h2 {
            margin: 0 0 14px;
            font-size: 18px;
            letter-spacing: -0.03em;
          }

          .report-subtitle {
            margin: 0 0 24px;
            color: #486581;
          }

          .detail-grid {
            display: grid;
            gap: 14px;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            margin: 28px 0;
          }

          .detail-card {
            border: 1px solid #d9e2ec;
            border-radius: 18px;
            padding: 14px 16px;
            background: #f8fafc;
          }

          .detail-label,
          .detail-value {
            margin: 0;
          }

          .detail-value {
            margin-top: 8px;
            font-size: 15px;
            font-weight: 700;
            overflow-wrap: anywhere;
          }

          .report-section {
            margin-top: 30px;
            page-break-inside: avoid;
          }

          pre {
            margin: 0;
            padding: 16px;
            border-radius: 16px;
            background: #0f172a;
            color: #e2e8f0;
            font-size: 12px;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
          }

          @media print {
            body {
              margin: 18mm 14mm;
            }

            .detail-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
        </style>
      </head>
      <body>
        <div class="report-meta">
          Generated ${escapeHtml(generatedAt)} · ${escapeHtml(options.generatedBy)}
        </div>
        <h1>${escapeHtml(options.title)}</h1>
        <p class="report-subtitle">${escapeHtml(options.subtitle)}</p>
        <section class="detail-grid">${detailCards}</section>
        ${schemaSection}
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
