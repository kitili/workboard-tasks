/** Find the Status cell for a TAP rock code. Column B holds the code. */
export function findStatusCell(rows: string[][], code: string) {
  const wanted = code.trim();
  if (!wanted) return null;
  let statusCol = -1;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let column = 0; column < row.length; column += 1) {
      const cell = (row[column] ?? "").trim();
      if (/^status\b/i.test(cell) && !/code/i.test(cell)) statusCol = column;
    }
    if ((row[1] ?? "").trim() === wanted && statusCol >= 0) {
      return { row: rowIndex, column: statusCol };
    }
  }
  return null;
}

export function cellA1(row: number, column: number) {
  let n = column + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${row + 1}`;
}

export function rockCodeFromLabels(labels: string[] | null | undefined) {
  const label = (labels ?? []).find((item) => item.startsWith("Rock "));
  return label ? label.slice(5).trim() : null;
}
