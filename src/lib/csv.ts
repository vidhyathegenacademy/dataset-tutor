import Papa from "papaparse";
import type { Row } from "./eval-types";
import { uid } from "./eval-types";

export type ColumnMap = { input: string; groundTruth: string; prediction: string };

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const headers = result.meta.fields ?? [];
  return { headers, rows: result.data };
}

export function buildRows(records: Record<string, string>[], map: ColumnMap): Row[] {
  return records.map((r) => {
    const { [map.input]: input, [map.groundTruth]: gt, [map.prediction]: pred, ...rest } = r;
    return {
      id: uid(),
      input: input ?? "",
      groundTruth: gt ?? "",
      prediction: pred ?? "",
      scores: {},
      manualStatus: null,
      categoryId: null,
      notes: "",
      extra: rest as Record<string, string>,
    };
  });
}

export function rowsToCsv(rows: Row[], dimensionIds: { id: string; name: string }[], categories: { id: string; name: string }[]): string {
  const data = rows.map((r) => {
    const out: Record<string, string | number> = {
      input: r.input,
      ground_truth: r.groundTruth,
      prediction: r.prediction,
    };
    for (const d of dimensionIds) out[`score_${d.name}`] = r.scores[d.id] ?? "";
    out["manual_status"] = r.manualStatus ?? "";
    out["failure_category"] = categories.find((c) => c.id === r.categoryId)?.name ?? "";
    out["notes"] = r.notes ?? "";
    if (r.extra) for (const [k, v] of Object.entries(r.extra)) out[`extra_${k}`] = v;
    return out;
  });
  return Papa.unparse(data);
}
