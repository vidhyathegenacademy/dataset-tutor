export type Dimension = {
  id: string;
  name: string;
  description?: string;
  min: number;
  max: number;
};

export type FailureCategory = {
  id: string;
  name: string;
  description?: string;
};

export type FailRule =
  | { id: string; kind: "dimension_lt"; dimensionId: string; value: number }
  | { id: string; kind: "total_lt"; value: number };

export type RubricMode = "binary" | "dimensional";

export type Rubric = {
  mode: RubricMode;
  dimensions: Dimension[];
  failRules: FailRule[];
  categories: FailureCategory[];
};

export type Row = {
  id: string;
  input: string;
  groundTruth: string;
  prediction: string;
  scores: Record<string, number | null>;
  manualStatus?: "pass" | "fail" | null;
  categoryId?: string | null;
  notes?: string;
  extra?: Record<string, string>;
};

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  rubric: Rubric;
  rows: Row[];
};

export const emptyRubric = (): Rubric => ({
  mode: "binary",
  dimensions: [],
  failRules: [],
  categories: [],
});

export const socialMediaPreset = (): Rubric => ({
  mode: "dimensional",
  dimensions: [
    { id: "d1", name: "Factual Correctness", description: "Hallucinations, wrong facts.", min: 1, max: 5 },
    { id: "d2", name: "Clarity", description: "Concise, coherent, easy to read.", min: 1, max: 5 },
    { id: "d3", name: "Value / Insight", description: "Unique perspective vs. generic fluff.", min: 1, max: 5 },
    { id: "d4", name: "Engagement", description: "Strong hook, clear CTA.", min: 1, max: 5 },
    { id: "d5", name: "Tone Fit", description: "Matches intended persona.", min: 1, max: 5 },
  ],
  failRules: [
    { id: "r1", kind: "dimension_lt", dimensionId: "d1", value: 4 },
    { id: "r2", kind: "total_lt", value: 20 },
  ],
  categories: [
    { id: "c1", name: "Hallucinated Content", description: "Wrong dates, made-up features. Fix: context injection." },
    { id: "c2", name: "Low Informational Value", description: "Generic advice, buzzwords. Fix: reasoning scaffold." },
    { id: "c3", name: "Instruction Non-Compliance", description: "Ignored format/constraints. Fix: positive framing." },
    { id: "c4", name: "Poor Framing", description: "Boring hook, robotic tone. Fix: few-shot prompting." },
  ],
});

export function computeStatus(row: Row, rubric: Rubric): { status: "pass" | "fail" | "incomplete"; reasons: string[]; total: number } {
  if (rubric.mode === "binary") {
    if (!row.manualStatus) return { status: "incomplete", reasons: ["Not yet scored"], total: 0 };
    return { status: row.manualStatus, reasons: [], total: 0 };
  }
  const reasons: string[] = [];
  const scores = rubric.dimensions.map((d) => row.scores[d.id]);
  const anyMissing = scores.some((s) => s == null);
  const total = scores.reduce((acc: number, s) => acc + (s ?? 0), 0);
  if (rubric.dimensions.length === 0) return { status: "incomplete", reasons: ["No dimensions defined"], total };
  if (anyMissing) return { status: "incomplete", reasons: ["Not all dimensions scored"], total };
  for (const rule of rubric.failRules) {
    if (rule.kind === "dimension_lt") {
      const dim = rubric.dimensions.find((d) => d.id === rule.dimensionId);
      const v = row.scores[rule.dimensionId];
      if (dim && v != null && v < rule.value) reasons.push(`${dim.name} < ${rule.value}`);
    } else if (rule.kind === "total_lt") {
      if (total < rule.value) reasons.push(`Total (${total}) < ${rule.value}`);
    }
  }
  return { status: reasons.length ? "fail" : "pass", reasons, total };
}

export function effectiveStatus(row: Row, rubric: Rubric) {
  if (rubric.mode === "dimensional" && row.manualStatus) {
    return { status: row.manualStatus, reasons: ["Manual override"], total: 0 };
  }
  return computeStatus(row, rubric);
}

export const uid = () => Math.random().toString(36).slice(2, 10);
