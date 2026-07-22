export interface GlobalDateAlignmentRow {
  etfCode: string;
  sourceAsOf: string | null;
  fetchedAt: string | null;
}

export function globalDateAlignment(rows: GlobalDateAlignmentRow[]) {
  const availableDates = rows
    .map((row) => row.sourceAsOf)
    .filter((value): value is string => Boolean(value));
  const commonDateOnly = rows.length > 0
    && availableDates.length === rows.length
    && new Set(availableDates).size === 1;

  return {
    commonDate: commonDateOnly ? availableDates[0] ?? null : null,
    commonDateOnly,
    rows
  };
}
