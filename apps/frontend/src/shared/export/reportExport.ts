interface DocumentDetail {
  label: string;
  value: string | number | null | undefined;
}

interface DocumentTable {
  columns: string[];
  rows: Array<Array<string | number | null | undefined>>;
  title: string;
}

interface ListDocumentOptions {
  columns: string[];
  filename: string;
  generatedBy: string;
  rows: Array<Array<string | number | null | undefined>>;
  subtitle: string;
  title: string;
}

interface TrainingRecordDocumentOptions {
  details: DocumentDetail[];
  filename: string;
  generatedBy: string;
  jsonPayload?: Record<string, unknown> | undefined;
  subtitle: string;
  tables: DocumentTable[];
  title: string;
}

interface TemplateDocumentOptions {
  details: DocumentDetail[];
  filename: string;
  generatedBy: string;
  schemaJson?: Record<string, unknown> | undefined;
  subtitle: string;
  title: string;
}

interface TemplateSchemaSection extends Record<string, unknown> {
  code?: string;
  description?: string;
  fields?: string[];
  objectives?: string[];
  referenceDocuments?: string[];
  tasks?: Array<{
    method?: string;
    taskLabel?: string;
  }>;
  type?: string;
}

interface TemplateSchemaDocument extends Record<string, unknown> {
  documentTitle?: string;
  formFamilyReference?: string;
  formTitle?: string;
  sectionName?: string;
  sections?: TemplateSchemaSection[];
}

const textEncoder = new TextEncoder();
const crcTable = new Uint32Array(256);
const documentTextSizeHalfPoints = 20;
const documentTableWidthTwips = 9300;

for (let index = 0; index < crcTable.length; index += 1) {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  crcTable[index] = crc >>> 0;
}

function normalizeDocumentFilename(filename: string) {
  const safeName = filename.trim() || "report.docx";
  return safeName.toLowerCase().endsWith(".docx")
    ? safeName
    : `${safeName.replace(/\.+$/, "")}.docx`;
}

function escapeXml(value: string | number | null | undefined) {
  const normalizedValue = value == null ? "" : String(value);

  return normalizedValue
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function calculateCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createZipArchive(
  files: Array<{ name: string; content: string | Uint8Array }>
) {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name);
    const contentBytes =
      typeof file.content === "string"
        ? textEncoder.encode(file.content)
        : file.content;
    const crc32 = calculateCrc32(contentBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc32, true);
    localView.setUint32(18, contentBytes.length, true);
    localView.setUint32(22, contentBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc32, true);
    centralView.setUint32(20, contentBytes.length, true);
    centralView.setUint32(24, contentBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    localOffset += localHeader.length + contentBytes.length;
  }

  const centralSize = centralChunks.reduce(
    (total, chunk) => total + chunk.length,
    0
  );
  const outputLength = localOffset + centralSize + 22;
  const output = new Uint8Array(outputLength);
  let cursor = 0;

  for (const chunk of localChunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }

  const centralOffset = cursor;

  for (const chunk of centralChunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }

  const endRecord = new DataView(output.buffer, cursor, 22);
  endRecord.setUint32(0, 0x06054b50, true);
  endRecord.setUint16(4, 0, true);
  endRecord.setUint16(6, 0, true);
  endRecord.setUint16(8, files.length, true);
  endRecord.setUint16(10, files.length, true);
  endRecord.setUint32(12, centralSize, true);
  endRecord.setUint32(16, centralOffset, true);
  endRecord.setUint16(20, 0, true);

  return output;
}

function downloadBinaryFile(
  bytes: Uint8Array,
  filename: string,
  type: string
) {
  const blob = new Blob([bytes.slice().buffer], { type });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = normalizeDocumentFilename(filename);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function sanitizeParagraphValue(value: string | number | null | undefined) {
  const normalizedValue = value == null ? "Not set" : String(value).trim();
  return normalizedValue || "Not set";
}

function createParagraph(text: string, style = "BodyText") {
  const chunks = text.split("\n");

  const runs = chunks
    .map(
      (chunk, index) => `
        <w:r>
          <w:t xml:space="preserve">${escapeXml(chunk)}</w:t>
        </w:r>
        ${index < chunks.length - 1 ? "<w:r><w:br/></w:r>" : ""}
      `
    )
    .join("");

  return `
    <w:p>
      <w:pPr><w:pStyle w:val="${style}"/></w:pPr>
      ${runs}
    </w:p>
  `;
}

function createDetailParagraph(detail: DocumentDetail) {
  return createParagraph(
    `${detail.label}: ${sanitizeParagraphValue(detail.value)}`,
    "BodyText"
  );
}

function createSectionHeading(title: string) {
  return createParagraph(title, "Heading1");
}

function createLabelValueTable(
  title: string,
  rows: Array<[string, string | number | null | undefined]>
) {
  return createTable({
    title,
    columns: ["Field", "Content"],
    rows: rows.map(([label, value]) => [label, sanitizeParagraphValue(value)]),
  });
}

function formatSignatureFieldName(fieldName: string) {
  return fieldName
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isTemplateSchemaDocument(
  value: Record<string, unknown>
): value is TemplateSchemaDocument {
  return Array.isArray(value.sections);
}

function buildTemplateSchemaXml(schemaJson: Record<string, unknown>) {
  if (!isTemplateSchemaDocument(schemaJson)) {
    return `
      ${createSectionHeading("Template schema")}
      ${createParagraph(JSON.stringify(schemaJson, null, 2), "BodyText")}
    `;
  }

  const sections = schemaJson.sections ?? [];

  const documentHeader = [
    schemaJson.formTitle
      ? createParagraph(schemaJson.formTitle, "Heading1")
      : "",
    schemaJson.documentTitle
      ? createParagraph(schemaJson.documentTitle, "BodyText")
      : "",
    schemaJson.formFamilyReference || schemaJson.sectionName
      ? createParagraph(
          [
            schemaJson.formFamilyReference,
            schemaJson.sectionName,
          ]
            .filter(Boolean)
            .join(" · "),
          "BodyText"
        )
      : "",
  ].join("");

  const sectionXml = sections
    .map((section, index) => {
      if (section.type === "training_event") {
        return `
          ${createLabelValueTable("Training Event", [
            ["Training event", section.code],
            ["Description", section.description],
            [
              "Objectives",
              (section.objectives ?? [])
                .map((objective, objectiveIndex) => `${objectiveIndex + 1}. ${objective}`)
                .join("\n"),
            ],
            [
              "Related documentation",
              (section.referenceDocuments ?? []).join("\n"),
            ],
          ])}
        `;
      }

      if (section.type === "competency_assessment") {
        return `
          ${createLabelValueTable("Competency Assessment", [
            ["Assessment", section.code],
            ["Description", section.description],
            [
              "Objectives",
              (section.objectives ?? [])
                .map((objective, objectiveIndex) => `${objectiveIndex + 1}. ${objective}`)
                .join("\n"),
            ],
          ])}
          ${createTable({
            title: "Competency tasks / methods",
            columns: ["Task", "Method"],
            rows: (section.tasks ?? []).map((task) => [
              task.taskLabel,
              task.method,
            ]),
          })}
        `;
      }

      if (section.type === "signature_block") {
        return `
          ${createTable({
            title: "Signatures and dates",
            columns: ["Field", "Value"],
            rows: (section.fields ?? []).map((field) => [
              formatSignatureFieldName(field),
              "",
            ]),
          })}
        `;
      }

      return `
        ${createSectionHeading(
          `Additional form section ${index + 1}: ${
            section.type || "Custom section"
          }`
        )}
        ${createParagraph(JSON.stringify(section, null, 2), "BodyText")}
      `;
    })
    .join("");

  return `${documentHeader}${sectionXml}`;
}

function createTable(table: DocumentTable) {
  const columnWidth = Math.max(
    900,
    Math.floor(
      documentTableWidthTwips / Math.max(table.columns.length, 1)
    )
  );

  const headerRow = `
    <w:tr>
      ${table.columns
        .map(
          (column) => `
            <w:tc>
              <w:tcPr>
                <w:tcW w:w="${columnWidth}" w:type="dxa"/>
                <w:shd w:fill="D9F0EE"/>
              </w:tcPr>
              ${createParagraph(column, "TableHeader")}
            </w:tc>
          `
        )
        .join("")}
    </w:tr>
  `;

  const bodyRows = (
    table.rows.length > 0
      ? table.rows
      : [table.columns.map(() => "No rows available.")]
  )
    .map(
      (row) => `
        <w:tr>
          ${row
            .map(
              (value) => `
                <w:tc>
                  <w:tcPr><w:tcW w:w="${columnWidth}" w:type="dxa"/></w:tcPr>
                  ${createParagraph(sanitizeParagraphValue(value), "BodyText")}
                </w:tc>
              `
            )
            .join("")}
        </w:tr>
      `
    )
    .join("");

  return `
    ${createParagraph(table.title, "Heading1")}
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="${documentTableWidthTwips}" w:type="dxa"/>
        <w:tblLayout w:type="fixed"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:color="A8B8C7"/>
          <w:left w:val="single" w:sz="4" w:color="A8B8C7"/>
          <w:bottom w:val="single" w:sz="4" w:color="A8B8C7"/>
          <w:right w:val="single" w:sz="4" w:color="A8B8C7"/>
          <w:insideH w:val="single" w:sz="4" w:color="A8B8C7"/>
          <w:insideV w:val="single" w:sz="4" w:color="A8B8C7"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tblGrid>
        ${table.columns
          .map(() => `<w:gridCol w:w="${columnWidth}"/>`)
          .join("")}
      </w:tblGrid>
      ${headerRow}
      ${bodyRows}
    </w:tbl>
    ${createParagraph("", "BodyText")}
  `;
}

function buildDocumentXml(options: {
  details?: DocumentDetail[];
  jsonPayload?: Record<string, unknown> | undefined;
  subtitle: string;
  templateSchemaXml?: string;
  tables?: DocumentTable[];
  title: string;
}) {
  const detailsXml = (options.details ?? [])
    .map((detail) => createDetailParagraph(detail))
    .join("");

  const tablesXml = (options.tables ?? [])
    .map((table) => createTable(table))
    .join("");

  const jsonXml = options.jsonPayload
    ? `
      ${createParagraph("Structured payload", "Heading1")}
      ${createParagraph(JSON.stringify(options.jsonPayload, null, 2), "BodyText")}
    `
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${createParagraph(options.title, "Title")}
        ${createParagraph(options.subtitle, "Subtitle")}
        ${detailsXml}
        ${tablesXml}
        ${options.templateSchemaXml ?? ""}
        ${jsonXml}
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
        </w:sectPr>
      </w:body>
    </w:document>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:style w:type="paragraph" w:styleId="Title">
        <w:name w:val="Title"/>
        <w:rPr>
          <w:b/>
          <w:sz w:val="48"/>
          <w:color w:val="102A43"/>
        </w:rPr>
      </w:style>
      <w:style w:type="paragraph" w:styleId="Subtitle">
        <w:name w:val="Subtitle"/>
        <w:rPr>
          <w:sz w:val="24"/>
          <w:color w:val="486581"/>
        </w:rPr>
      </w:style>
      <w:style w:type="paragraph" w:styleId="Heading1">
        <w:name w:val="heading 1"/>
        <w:rPr>
          <w:b/>
          <w:sz w:val="30"/>
          <w:color w:val="0F766E"/>
        </w:rPr>
      </w:style>
      <w:style w:type="paragraph" w:styleId="TableHeader">
        <w:name w:val="Table Header"/>
        <w:rPr>
          <w:b/>
          <w:sz w:val="${documentTextSizeHalfPoints}"/>
          <w:color w:val="0F766E"/>
        </w:rPr>
      </w:style>
      <w:style w:type="paragraph" w:styleId="BodyText">
        <w:name w:val="Body Text"/>
        <w:rPr>
          <w:sz w:val="${documentTextSizeHalfPoints}"/>
          <w:color w:val="102A43"/>
        </w:rPr>
      </w:style>
    </w:styles>`;
}

function downloadDocxDocument(
  filename: string,
  documentXml: string
) {
  const archive = createZipArchive([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
          <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
        </Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
        </Relationships>`,
    },
    {
      name: "word/_rels/document.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
        </Relationships>`,
    },
    {
      name: "word/document.xml",
      content: documentXml,
    },
    {
      name: "word/styles.xml",
      content: buildStylesXml(),
    },
  ]);

  downloadBinaryFile(
    archive,
    filename,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function downloadListReportDocx(options: ListDocumentOptions) {
  const generatedAt = new Date().toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  downloadDocxDocument(
    options.filename,
    buildDocumentXml({
      title: options.title,
      subtitle: `${options.subtitle}\nGenerated ${generatedAt} by ${options.generatedBy}`,
      tables: [
        {
          title: options.title,
          columns: options.columns,
          rows: options.rows,
        },
      ],
    })
  );
}

export function downloadTrainingRecordDocument(
  options: TrainingRecordDocumentOptions
) {
  const generatedAt = new Date().toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  downloadDocxDocument(
    options.filename,
    buildDocumentXml({
      title: options.title,
      subtitle: `${options.subtitle}\nGenerated ${generatedAt} by ${options.generatedBy}`,
      details: options.details,
      tables: options.tables,
      jsonPayload: options.jsonPayload,
    })
  );
}

export function downloadTemplateDocument(options: TemplateDocumentOptions) {
  const generatedAt = new Date().toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  downloadDocxDocument(
    options.filename,
    buildDocumentXml({
      title: options.title,
      subtitle: `${options.subtitle}\nGenerated ${generatedAt} by ${options.generatedBy}`,
      details: options.details,
      templateSchemaXml: options.schemaJson
        ? buildTemplateSchemaXml(options.schemaJson)
        : createParagraph("Template schema not available.", "BodyText"),
    })
  );
}
