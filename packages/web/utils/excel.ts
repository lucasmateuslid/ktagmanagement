type TabularValue = string | number | boolean | Date | null | undefined;
type TabularRow = Record<string, TabularValue>;
type WorkbookSheet =
  | { name: string; rows: TabularRow[] }
  | { name: string; matrix: TabularValue[][] };

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const normalizeCell = (value: TabularValue): string | number | boolean | Date => {
  if (value === null || value === undefined) return '';
  return value;
};

export const exportSheetsToXlsx = async (sheets: WorkbookSheet[], fileName: string) => {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  sheets.forEach((sheet) => {
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31));
    let headers: string[] = [];

    if ('rows' in sheet) {
      headers = Object.keys(sheet.rows[0] || {});
      worksheet.addRow(headers);
      sheet.rows.forEach((row) => worksheet.addRow(headers.map((header) => normalizeCell(row[header]))));
    } else {
      sheet.matrix.forEach((row) => worksheet.addRow(row.map(normalizeCell)));
    }

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F3F46' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.columns.forEach((column, index) => {
      const headerLength = headers[index]?.length || 10;
      let contentLength = headerLength;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        contentLength = Math.max(contentLength, cell.text.length);
      });
      column.width = Math.min(Math.max(contentLength + 2, 12), 45);
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([new Uint8Array(buffer)], { type: XLSX_MIME }), fileName);
};

export const exportRowsToXlsx = async (
  rows: TabularRow[],
  worksheetName: string,
  fileName: string,
) => exportSheetsToXlsx([{ name: worksheetName, rows }], fileName);

const delimiterFor = (line: string) => {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    if (!quoted && line[index] === ',') commas += 1;
    if (!quoted && line[index] === ';') semicolons += 1;
  }

  return semicolons > commas ? ';' : ',';
};

const parseCsv = (content: string): string[][] => {
  const delimiter = delimiterFor(content.split(/\r?\n/, 1)[0] || '');
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];

    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const recordsFromMatrix = (matrix: string[][]): Record<string, string>[] => {
  const [headers = [], ...rows] = matrix;
  return rows.map((row) => Object.fromEntries(
    headers.map((header, index) => [header.trim(), row[index] || '']),
  ));
};

export const readTabularFile = async (file: File): Promise<Record<string, string>[]> => {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return recordsFromMatrix(parseCsv(await file.text()));
  }

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer() as never);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const matrix: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    for (let column = 1; column <= worksheet.columnCount; column += 1) {
      values.push(row.getCell(column).text.trim());
    }
    matrix.push(values);
  });

  return recordsFromMatrix(matrix);
};
