import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Plus, Upload, Download, Trash2, FlaskConical, Settings2, FileText, Check, X,
  ChevronRight, ChevronLeft, FilePlus2, GripVertical, BarChart3, Layers, Database, Sparkles,
} from "lucide-react";
import { parseCsv, buildRows, rowsToCsv, type ColumnMap } from "@/lib/csv";
import {
  emptyRubric, socialMediaPreset, effectiveStatus, uid,
  type Project, type Rubric, type Row, type Dimension, type FailureCategory, type FailRule, type RubricMode,
} from "@/lib/eval-types";
import { loadAll, saveAll, getActiveId, setActiveId, newProject } from "@/lib/eval-storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EvalLoop — Systematic LLM Output Evaluation" },
      { name: "description", content: "Score, cluster, and triage any LLM dataset against a custom rubric." },
      { property: "og:title", content: "EvalLoop — Systematic LLM Output Evaluation" },
      { property: "og:description", content: "Score, cluster, and triage any LLM dataset against a custom rubric." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  component: App,
});

type Step = "data" | "rubric" | "score" | "cluster" | "summary";
const STEPS: { id: Step; label: string; icon: typeof Database }[] = [
  { id: "data", label: "Data", icon: Database },
  { id: "rubric", label: "Rubric", icon: Settings2 },
  { id: "score", label: "Score", icon: FileText },
  { id: "cluster", label: "Cluster Failures", icon: Layers },
  { id: "summary", label: "Summary", icon: BarChart3 },
];

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActive] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>("data");

  useEffect(() => {
    const p = loadAll();
    setProjects(p);
    const a = getActiveId();
    setActive(a && p.find((x) => x.id === a) ? a : p[0]?.id ?? null);
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) saveAll(projects); }, [projects, hydrated]);
  useEffect(() => { if (hydrated) setActiveId(activeId); }, [activeId, hydrated]);

  const active = projects.find((p) => p.id === activeId) ?? null;

  function updateActive(updater: (p: Project) => Project) {
    setProjects((prev) => prev.map((p) => (p.id === activeId ? { ...updater(p), updatedAt: Date.now() } : p)));
  }
  function createProject(name: string) {
    const p = newProject(name || "Untitled evaluation");
    setProjects((prev) => [p, ...prev]);
    setActive(p.id);
    setStep("data");
  }
  function deleteProject(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) setActive(null);
  }

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      <Header
        projects={projects} activeId={activeId} onSelect={setActive}
        onCreate={createProject} onDelete={deleteProject}
      />
      {active ? (
        <Workspace project={active} update={updateActive} step={step} setStep={setStep} />
      ) : (
        <EmptyState onCreate={createProject} />
      )}
    </div>
  );
}

function Header({
  projects, activeId, onSelect, onCreate, onDelete,
}: {
  projects: Project[]; activeId: string | null;
  onSelect: (id: string) => void; onCreate: (name: string) => void; onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
        <div className="flex items-center gap-2 pr-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-foreground text-background">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold tracking-tight">EvalLoop</div>
          <Badge variant="secondary" className="ml-1 font-mono text-[10px]">v1</Badge>
        </div>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex min-w-[220px] items-center gap-2">
          <Select value={activeId ?? ""} onValueChange={onSelect}>
            <SelectTrigger className="h-8 w-[260px]">
              <SelectValue placeholder="No evaluation selected" />
            </SelectTrigger>
            <SelectContent>
              {projects.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No evaluations yet</div>}
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8"><Plus className="h-3.5 w-3.5" />New</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New evaluation</DialogTitle>
                <DialogDescription>Start a fresh evaluation project. You can rename it later.</DialogDescription>
              </DialogHeader>
              <Input autoFocus placeholder="e.g. Q3 chatbot regression" value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { onCreate(newName); setNewName(""); setOpen(false); } }} />
              <DialogFooter>
                <Button onClick={() => { onCreate(newName); setNewName(""); setOpen(false); }}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {activeId && (
            <Button size="sm" variant="ghost" className="h-8 text-muted-foreground"
              onClick={() => { if (confirm("Delete this evaluation? This cannot be undone.")) onDelete(activeId); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="ml-auto text-xs text-muted-foreground">Local-only. Data lives in your browser.</div>
      </div>
    </header>
  );
}

function EmptyState({ onCreate }: { onCreate: (name: string) => void }) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-24">
      <div className="rounded-xl border border-border bg-card p-10">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-foreground text-background">
          <FlaskConical className="h-5 w-5" />
        </div>
        <h1 className="mt-6 text-center text-3xl font-semibold tracking-tight">An evaluation loop for any LLM dataset</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
          Import inputs, ground truth, and predictions. Define your own rubric — binary pass/fail
          or multi-dimensional scoring. Score sequentially, then cluster failures into categories.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button onClick={() => onCreate("Untitled evaluation")}>
            <FilePlus2 className="h-4 w-4" />Create your first evaluation
          </Button>
        </div>
        <div className="mt-10 grid grid-cols-3 gap-3 text-xs">
          {[
            { icon: Upload, t: "Bring your own data", d: "CSV with any column names — map them to input / ground truth / prediction." },
            { icon: Settings2, t: "Your scoring, not ours", d: "Binary pass/fail or weighted dimensions with custom fail thresholds." },
            { icon: Layers, t: "Cluster failures", d: "Group failed rows to discover failure categories, then assign them back." },
          ].map((f, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface-2 p-4">
              <f.icon className="h-4 w-4 text-accent" />
              <div className="mt-2 font-medium text-foreground">{f.t}</div>
              <div className="mt-1 text-muted-foreground">{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Workspace({
  project, update, step, setStep,
}: { project: Project; update: (u: (p: Project) => Project) => void; step: Step; setStep: (s: Step) => void }) {
  const stats = useMemo(() => {
    let pass = 0, fail = 0, inc = 0;
    for (const r of project.rows) {
      const s = effectiveStatus(r, project.rubric).status;
      if (s === "pass") pass++; else if (s === "fail") fail++; else inc++;
    }
    return { pass, fail, inc, total: project.rows.length };
  }, [project.rows, project.rubric]);

  const idx = STEPS.findIndex((s) => s.id === step);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-4">
      <Stepper step={step} setStep={setStep} project={project} stats={stats} />
      <div className="mt-4">
        {step === "data" && <DataPanel project={project} update={update} />}
        {step === "rubric" && <RubricEditor rubric={project.rubric} onChange={(r) => update((p) => ({ ...p, rubric: r }))} />}
        {step === "score" && <ScorePanel project={project} update={update} />}
        {step === "cluster" && <ClusterPanel project={project} update={update} />}
        {step === "summary" && <SummaryPanel project={project} />}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" disabled={idx === 0} onClick={() => setStep(STEPS[idx - 1].id)}>
          <ChevronLeft className="h-4 w-4" /> {idx > 0 ? STEPS[idx - 1].label : ""}
        </Button>
        <Button variant="outline" disabled={idx === STEPS.length - 1} onClick={() => setStep(STEPS[idx + 1].id)}>
          {idx < STEPS.length - 1 ? STEPS[idx + 1].label : ""} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </main>
  );
}

function Stepper({
  step, setStep, project, stats,
}: { step: Step; setStep: (s: Step) => void; project: Project; stats: { pass: number; fail: number; inc: number; total: number } }) {
  const activeIdx = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <div className="flex items-stretch">
        {STEPS.map((s, i) => {
          const isActive = s.id === step;
          const isDone = i < activeIdx;
          const meta = stepMeta(s.id, project, stats);
          return (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={cn(
                "group relative flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                isActive ? "bg-surface-2" : "hover:bg-surface-2/60",
              )}
            >
              <div className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-medium",
                isActive ? "bg-foreground text-background" : isDone ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
              )}>
                {isDone ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0">
                <div className={cn("text-xs font-semibold", isActive ? "text-foreground" : "text-muted-foreground")}>
                  {i + 1}. {s.label}
                </div>
                <div className="truncate font-mono text-[10px] text-muted-foreground">{meta}</div>
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/40" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function stepMeta(id: Step, project: Project, stats: { pass: number; fail: number; inc: number; total: number }) {
  switch (id) {
    case "data": return `${project.rows.length} rows`;
    case "rubric": return project.rubric.mode === "binary" ? "binary pass/fail" : `${project.rubric.dimensions.length} dims · ${project.rubric.failRules.length} rules`;
    case "score": return `${stats.inc} pending`;
    case "cluster": {
      const failures = project.rows.filter((r) => effectiveStatus(r, project.rubric).status === "fail");
      const unassigned = failures.filter((r) => !r.categoryId).length;
      return `${failures.length} fail · ${unassigned} unassigned`;
    }
    case "summary": return stats.total ? `${Math.round((stats.pass / stats.total) * 100)}% pass` : "—";
  }
}

/* ---------- DATA ---------- */

function DataPanel({ project, update }: { project: Project; update: (u: (p: Project) => Project) => void }) {
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<ColumnMap>({ input: "", groundTruth: "", prediction: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  function previewCsv(text: string) {
    setCsvText(text);
    const { headers, rows } = parseCsv(text);
    setHeaders(headers);
    setRecords(rows);
    setMap({
      input: headers.find((h) => /input|prompt|topic|question/i.test(h)) ?? headers[0] ?? "",
      groundTruth: headers.find((h) => /ground|truth|expected|reference|answer/i.test(h)) ?? headers[1] ?? "",
      prediction: headers.find((h) => /pred|output|model|response|completion|generated/i.test(h)) ?? headers[2] ?? "",
    });
  }

  function importNow(replace: boolean) {
    if (!records.length) { toast.error("Nothing to import"); return; }
    const newRows = buildRows(records, map);
    update((p) => ({ ...p, rows: replace ? newRows : [...p.rows, ...newRows] }));
    setCsvText(""); setHeaders([]); setRecords([]);
    toast.success(`Imported ${newRows.length} rows`);
  }

  function downloadCsv() {
    const csv = rowsToCsv(project.rows,
      project.rubric.dimensions.map((d) => ({ id: d.id, name: d.name })),
      project.rubric.categories.map((c) => ({ id: c.id, name: c.name })),
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${project.name.replace(/\s+/g, "_")}_annotated.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function loadSample() {
    const sample = `topic,reference_post,generated_post
"AI safety in production","Reliable AI requires evaluation loops, not vibes.","Just shipped some AI! It's super cool and revolutionary. #AI #ML"
"Vector databases","Picking the right vector DB depends on filter cardinality and recall.","Vector databases are databases for vectors. They store vectors."
"Prompt engineering","Prompts are interfaces. Iterate them with evals.","Master these 10 prompt hacks and 10x your productivity! 🚀🚀🚀"
"RAG vs fine-tuning","Use RAG for fresh facts; fine-tune for stable behavior.","RAG is just retrieval. Fine-tuning is just training. Both work in all cases."
"LLM cost optimization","Cache aggressively, route by complexity, measure cost per task.","To save money on LLMs, just use a cheaper model. That's literally it."`;
    previewCsv(sample);
    toast.success("Sample CSV loaded — review and click Import");
  }

  function addManualRow() {
    update((p) => ({
      ...p,
      rows: [...p.rows, { id: uid(), input: "", groundTruth: "", prediction: "", scores: {}, manualStatus: null, categoryId: null, notes: "" }],
    }));
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-7 rounded-xl border border-border bg-card p-4">
        <SectionHeader title="Import CSV" subtitle="Upload or paste — we'll detect headers and let you map columns." />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) previewCsv(await f.text()); }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" />Upload .csv</Button>
          <Button variant="outline" size="sm" onClick={loadSample}>Load sample</Button>
          <Button variant="ghost" size="sm" onClick={addManualRow}><Plus className="h-3.5 w-3.5" />Add empty row</Button>
        </div>
        <Textarea className="mt-3 h-44 font-mono text-xs" placeholder="Or paste CSV text here…"
          value={csvText} onChange={(e) => previewCsv(e.target.value)} />
        {headers.length > 0 && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Column mapping ({records.length} rows detected)</div>
            <div className="grid grid-cols-3 gap-2">
              {(["input", "groundTruth", "prediction"] as const).map((k) => (
                <div key={k}>
                  <Label className="text-xs capitalize">{k === "groundTruth" ? "Ground truth" : k}</Label>
                  <Select value={map[k]} onValueChange={(v) => setMap({ ...map, [k]: v })}>
                    <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => importNow(false)}>Append</Button>
              <Button size="sm" onClick={() => importNow(true)}>Replace dataset</Button>
            </div>
          </div>
        )}
      </div>

      <div className="col-span-5 space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader title="Current dataset" />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Rows" value={project.rows.length} />
            <Stat label="Scored" value={project.rows.filter((r) => effectiveStatus(r, project.rubric).status !== "incomplete").length} />
            <Stat label="With notes" value={project.rows.filter((r) => (r.notes ?? "").trim().length > 0).length} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader title="Export annotations" subtitle="Annotated CSV with scores, status, category, notes." />
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={downloadCsv} disabled={project.rows.length === 0}><Download className="h-3.5 w-3.5" />Download .csv</Button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader title="Danger zone" />
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => { if (confirm("Clear all rows in this evaluation?")) update((p) => ({ ...p, rows: [] })); }}>
              <Trash2 className="h-3.5 w-3.5" />Clear all rows
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="font-mono text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/* ---------- RUBRIC ---------- */

function RubricEditor({ rubric, onChange }: { rubric: Rubric; onChange: (r: Rubric) => void }) {
  function setMode(mode: RubricMode) {
    if (mode === rubric.mode) return;
    onChange({ ...rubric, mode });
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <SectionHeader title="Scoring mode" subtitle="Pick how you want to judge each row." />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ModeCard active={rubric.mode === "binary"} onClick={() => setMode("binary")}
            title="Binary" icon={Check}
            desc="Just PASS or FAIL per row. Fastest for routing / classification tasks." />
          <ModeCard active={rubric.mode === "dimensional"} onClick={() => setMode("dimensional")}
            title="Dimensional" icon={Layers}
            desc="Score multiple dimensions, then derive PASS/FAIL from threshold rules." />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { if (confirm("Replace current rubric with the social-media post preset?")) onChange(socialMediaPreset()); }}>
            <Sparkles className="h-3.5 w-3.5" />Load social-media preset
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Reset to empty rubric?")) onChange(emptyRubric()); }}>Reset</Button>
        </div>
      </div>

      {rubric.mode === "dimensional" && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-7 rounded-xl border border-border bg-card p-4">
            <SectionHeader title="Scoring dimensions" subtitle="What you score on each output." />
            <div className="mt-3 space-y-2">
              {rubric.dimensions.map((d, i) => (
                <DimensionRow key={d.id} dim={d} index={i}
                  onChange={(nd) => onChange({ ...rubric, dimensions: rubric.dimensions.map((x) => (x.id === d.id ? nd : x)) })}
                  onRemove={() => {
                    const id = d.id;
                    onChange({
                      ...rubric,
                      dimensions: rubric.dimensions.filter((x) => x.id !== id),
                      failRules: rubric.failRules.filter((r) => !(r.kind === "dimension_lt" && r.dimensionId === id)),
                    });
                  }}
                />
              ))}
              <Button variant="outline" size="sm" onClick={() => onChange({
                ...rubric,
                dimensions: [...rubric.dimensions, { id: uid(), name: "New dimension", description: "", min: 1, max: 5 }],
              })}><Plus className="h-3.5 w-3.5" />Add dimension</Button>
            </div>
          </div>

          <div className="col-span-5 rounded-xl border border-border bg-card p-4">
            <SectionHeader title="PASS / FAIL rules" subtitle="A row fails if ANY rule fires." />
            <div className="mt-3 space-y-2">
              {rubric.failRules.map((rule) => (
                <FailRuleRow key={rule.id} rule={rule} dims={rubric.dimensions}
                  onChange={(nr) => onChange({ ...rubric, failRules: rubric.failRules.map((r) => (r.id === rule.id ? nr : r)) })}
                  onRemove={() => onChange({ ...rubric, failRules: rubric.failRules.filter((r) => r.id !== rule.id) })}
                />
              ))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm"
                  disabled={rubric.dimensions.length === 0}
                  onClick={() => onChange({
                    ...rubric,
                    failRules: [...rubric.failRules, { id: uid(), kind: "dimension_lt", dimensionId: rubric.dimensions[0]?.id ?? "", value: 4 }],
                  })}><Plus className="h-3.5 w-3.5" />Dimension rule</Button>
                <Button variant="outline" size="sm" onClick={() => onChange({
                  ...rubric,
                  failRules: [...rubric.failRules, { id: uid(), kind: "total_lt", value: 20 }],
                })}><Plus className="h-3.5 w-3.5" />Total rule</Button>
              </div>
              {rubric.failRules.length === 0 && (
                <p className="text-xs text-muted-foreground">No rules yet — without rules, every fully-scored row passes (unless you manually override).</p>
              )}
            </div>
          </div>
        </div>
      )}

      {rubric.mode === "binary" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader title="Auto-match (optional)" subtitle="Auto-compute PASS/FAIL by comparing prediction to ground truth. Manual verdicts still override." />
          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!rubric.autoMatch?.enabled}
                onCheckedChange={(c) =>
                  onChange({ ...rubric, autoMatch: { mode: rubric.autoMatch?.mode ?? "normalized", enabled: !!c } })
                }
              />
              <span>Enable auto-match</span>
            </label>
            <Select
              value={rubric.autoMatch?.mode ?? "normalized"}
              onValueChange={(v) => onChange({ ...rubric, autoMatch: { enabled: !!rubric.autoMatch?.enabled, mode: v as "exact" | "normalized" | "contains" } })}
            >
              <SelectTrigger className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normalized">Normalized (trim + case-insensitive)</SelectItem>
                <SelectItem value="exact">Exact match</SelectItem>
                <SelectItem value="contains">Prediction contains ground truth</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Best for classification, routing, or short-answer tasks where there's a single correct answer.
          </p>
        </div>
      )}
    </div>
  );
}

function ModeCard({ active, onClick, title, desc, icon: Icon }: { active: boolean; onClick: () => void; title: string; desc: string; icon: typeof Check }) {
  return (
    <button onClick={onClick} className={cn(
      "rounded-lg border p-4 text-left transition-all",
      active ? "border-foreground bg-surface-2 ring-1 ring-foreground/20" : "border-border bg-surface-2/40 hover:border-foreground/40"
    )}>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", active ? "text-accent" : "text-muted-foreground")} />
        <div className="text-sm font-semibold">{title}</div>
        {active && <Badge variant="secondary" className="ml-auto text-[10px]">selected</Badge>}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

function DimensionRow({ dim, onChange, onRemove, index }: { dim: Dimension; onChange: (d: Dimension) => void; onRemove: () => void; index: number }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 p-2.5">
      <GripVertical className="mt-2 h-3.5 w-3.5 text-muted-foreground" />
      <div className="grid flex-1 grid-cols-12 gap-2">
        <Input className="col-span-4 h-8" value={dim.name} onChange={(e) => onChange({ ...dim, name: e.target.value })} placeholder={`Dimension ${index + 1}`} />
        <Input className="col-span-6 h-8" value={dim.description ?? ""} onChange={(e) => onChange({ ...dim, description: e.target.value })} placeholder="Definition shown to the rater" />
        <div className="col-span-2 flex items-center gap-1">
          <Input type="number" className="h-8" value={dim.min} onChange={(e) => onChange({ ...dim, min: Number(e.target.value) })} />
          <span className="text-xs text-muted-foreground">–</span>
          <Input type="number" className="h-8" value={dim.max} onChange={(e) => onChange({ ...dim, max: Number(e.target.value) })} />
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

function FailRuleRow({ rule, dims, onChange, onRemove }: { rule: FailRule; dims: Dimension[]; onChange: (r: FailRule) => void; onRemove: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 p-2.5 text-sm">
      <span className="font-mono text-xs text-muted-foreground">FAIL if</span>
      {rule.kind === "dimension_lt" ? (
        <>
          <Select value={rule.dimensionId} onValueChange={(v) => onChange({ ...rule, dimensionId: v })}>
            <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{dims.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
          <span className="font-mono text-xs">&lt;</span>
          <Input type="number" className="h-8 w-20" value={rule.value} onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })} />
        </>
      ) : (
        <>
          <span className="text-xs">total score</span>
          <span className="font-mono text-xs">&lt;</span>
          <Input type="number" className="h-8 w-20" value={rule.value} onChange={(e) => onChange({ ...rule, value: Number(e.target.value) })} />
        </>
      )}
      <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-muted-foreground" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

/* ---------- SCORE ---------- */

function ScorePanel({ project, update }: { project: Project; update: (u: (p: Project) => Project) => void }) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(project.rows[0]?.id ?? null);
  const [filter, setFilter] = useState<"all" | "pass" | "fail" | "incomplete">("all");

  useEffect(() => {
    if (!project.rows.find((r) => r.id === selectedRowId)) {
      setSelectedRowId(project.rows[0]?.id ?? null);
    }
  }, [project.rows, selectedRowId]);

  if (project.rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
        <div className="mt-3 text-sm font-medium">No data yet</div>
        <div className="mt-1 text-xs text-muted-foreground">Go back to the Data step to import a CSV.</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-4">
        <RowList rows={project.rows} rubric={project.rubric} selectedId={selectedRowId} onSelect={setSelectedRowId} filter={filter} setFilter={setFilter} />
      </div>
      <div className="col-span-8">
        {selectedRowId ? (
          <RowDetail
            row={project.rows.find((r) => r.id === selectedRowId)!}
            rubric={project.rubric}
            onChange={(updated) => update((p) => ({ ...p, rows: p.rows.map((r) => (r.id === updated.id ? updated : r)) }))}
            onNext={() => {
              const idx = project.rows.findIndex((r) => r.id === selectedRowId);
              if (idx >= 0 && idx < project.rows.length - 1) setSelectedRowId(project.rows[idx + 1].id);
            }}
          />
        ) : (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">Select a row</div>
        )}
      </div>
    </div>
  );
}

function RowList({
  rows, rubric, selectedId, onSelect, filter, setFilter,
}: {
  rows: Row[]; rubric: Rubric; selectedId: string | null;
  onSelect: (id: string) => void;
  filter: "all" | "pass" | "fail" | "incomplete"; setFilter: (f: "all" | "pass" | "fail" | "incomplete") => void;
}) {
  const filtered = rows.filter((r) => filter === "all" || effectiveStatus(r, rubric).status === filter);
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-1 border-b border-border p-2">
        {(["all", "pass", "fail", "incomplete"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs capitalize" onClick={() => setFilter(f)}>{f}</Button>
        ))}
      </div>
      <ScrollArea className="h-[calc(100vh-280px)]">
        <ul className="divide-y divide-border">
          {filtered.map((r) => {
            const s = effectiveStatus(r, rubric);
            const idx = rows.indexOf(r);
            return (
              <li key={r.id}>
                <button
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2",
                    selectedId === r.id && "bg-surface-2"
                  )}
                  onClick={() => onSelect(r.id)}
                >
                  <span className="mt-0.5 w-6 shrink-0 font-mono text-[10px] text-muted-foreground">#{idx + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-xs text-foreground">{r.input || <em className="text-muted-foreground">no input</em>}</span>
                    <span className="mt-1 line-clamp-1 block text-[11px] text-muted-foreground">{r.prediction}</span>
                  </span>
                  <StatusDot status={s.status} />
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="p-6 text-center text-xs text-muted-foreground">No rows in this view</li>}
        </ul>
      </ScrollArea>
    </div>
  );
}

function StatusDot({ status }: { status: "pass" | "fail" | "incomplete" }) {
  const map = { pass: "bg-success", fail: "bg-destructive", incomplete: "bg-muted-foreground/40" } as const;
  return <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", map[status])} />;
}

function RowDetail({
  row, rubric, onChange, onNext,
}: { row: Row; rubric: Rubric; onChange: (r: Row) => void; onNext: () => void }) {
  const s = effectiveStatus(row, rubric);
  const isBinary = rubric.mode === "binary";
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">ROW</Badge>
            <span className="font-mono text-xs text-muted-foreground">{row.id}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={s.status} />
            {s.reasons.length > 0 && s.status !== "pass" && (
              <span className="text-[11px] text-muted-foreground">{s.reasons.join(" · ")}</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          <FieldBlock label="Input" value={row.input} onChange={(v) => onChange({ ...row, input: v })} />
          <FieldBlock label="Ground Truth" value={row.groundTruth} onChange={(v) => onChange({ ...row, groundTruth: v })} />
          <FieldBlock label="Prediction" value={row.prediction} onChange={(v) => onChange({ ...row, prediction: v })} accent />
        </div>
      </div>

      {isBinary ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verdict</div>
          <div className="flex gap-2">
            <Button size="lg" variant={row.manualStatus === "pass" ? "default" : "outline"}
              className={cn("flex-1", row.manualStatus === "pass" && "bg-success text-success-foreground hover:bg-success/90")}
              onClick={() => onChange({ ...row, manualStatus: row.manualStatus === "pass" ? null : "pass" })}>
              <Check className="h-4 w-4" />PASS
            </Button>
            <Button size="lg" variant={row.manualStatus === "fail" ? "destructive" : "outline"} className="flex-1"
              onClick={() => onChange({ ...row, manualStatus: row.manualStatus === "fail" ? null : "fail" })}>
              <X className="h-4 w-4" />FAIL
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scoring</div>
            {rubric.dimensions.length > 0 && (
              <div className="font-mono text-xs text-muted-foreground">
                Total: <span className="text-foreground">{rubric.dimensions.reduce((a, d) => a + (row.scores[d.id] ?? 0), 0)}</span>
                <span className="opacity-60"> / {rubric.dimensions.reduce((a, d) => a + d.max, 0)}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {rubric.dimensions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No dimensions defined yet. Add some in the Rubric step.</p>
            ) : rubric.dimensions.map((d) => (
              <DimensionScorer key={d.id} dim={d} value={row.scores[d.id] ?? null}
                onChange={(v) => onChange({ ...row, scores: { ...row.scores, [d.id]: v } })} />
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Manual override</div>
            <div className="mt-1.5 flex gap-1.5">
              {(["pass", "fail"] as const).map((v) => (
                <Button key={v} size="sm" variant={row.manualStatus === v ? (v === "pass" ? "default" : "destructive") : "outline"}
                  className="h-7 flex-1 text-xs capitalize"
                  onClick={() => onChange({ ...row, manualStatus: row.manualStatus === v ? null : v })}>
                  {v === "pass" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{v}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</Label>
        <Textarea className="mt-2 h-[90px] resize-none text-sm"
          placeholder="What went wrong? Anything to remember when clustering?"
          value={row.notes ?? ""} onChange={(e) => onChange({ ...row, notes: e.target.value })} />
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} variant="outline">Next row<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function FieldBlock({ label, value, onChange, accent }: { label: string; value: string; onChange: (v: string) => void; accent?: boolean }) {
  return (
    <div className="p-3">
      <div className={cn("mb-1.5 text-[10px] font-semibold uppercase tracking-wider", accent ? "text-accent" : "text-muted-foreground")}>{label}</div>
      <Textarea className="min-h-[140px] resize-none border-0 bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
        value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function StatusBadge({ status }: { status: "pass" | "fail" | "incomplete" }) {
  if (status === "pass") return <Badge className="bg-success text-success-foreground hover:bg-success">PASS</Badge>;
  if (status === "fail") return <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">FAIL</Badge>;
  return <Badge variant="outline">PENDING</Badge>;
}

function DimensionScorer({ dim, value, onChange }: { dim: Dimension; value: number | null; onChange: (v: number | null) => void }) {
  const options = Array.from({ length: Math.max(0, dim.max - dim.min + 1) }, (_, i) => dim.min + i);
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{dim.name}</div>
        {dim.description && <div className="text-xs text-muted-foreground">{dim.description}</div>}
      </div>
      <div className="flex items-center gap-1">
        {options.map((n) => (
          <button key={n} onClick={() => onChange(value === n ? null : n)}
            className={cn(
              "h-8 w-8 rounded-md border text-xs font-medium transition-all",
              value === n
                ? "border-accent bg-accent text-accent-foreground shadow-sm"
                : "border-border bg-surface text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}>{n}</button>
        ))}
      </div>
    </div>
  );
}

/* ---------- CLUSTER FAILURES ---------- */

function ClusterPanel({ project, update }: { project: Project; update: (u: (p: Project) => Project) => void }) {
  const { rubric, rows } = project;
  const failures = useMemo(() => rows.filter((r) => effectiveStatus(r, rubric).status === "fail"), [rows, rubric]);
  const unassigned = failures.filter((r) => !r.categoryId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [focusRowId, setFocusRowId] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function clearSelection() { setSelected(new Set()); }

  function assignTo(catId: string | null, ids: string[]) {
    update((p) => ({ ...p, rows: p.rows.map((r) => (ids.includes(r.id) ? { ...r, categoryId: catId } : r)) }));
    clearSelection();
  }

  function createCategoryFromSelection() {
    const ids = Array.from(selected);
    const name = newCatName.trim() || "Untitled category";
    const cat: FailureCategory = { id: uid(), name, description: newCatDesc.trim() || undefined };
    update((p) => ({
      ...p,
      rubric: { ...p.rubric, categories: [...p.rubric.categories, cat] },
      rows: p.rows.map((r) => (ids.includes(r.id) ? { ...r, categoryId: cat.id } : r)),
    }));
    setCreateOpen(false); setNewCatName(""); setNewCatDesc(""); clearSelection();
    toast.success(`Created "${cat.name}" with ${ids.length} row${ids.length === 1 ? "" : "s"}`);
  }

  if (rows.length === 0) {
    return <EmptyHint title="No data yet" subtitle="Import a CSV in the Data step." />;
  }
  if (failures.length === 0) {
    return <EmptyHint title="No failures to cluster" subtitle="Score some rows as FAIL first." />;
  }

  const selectedCount = selected.size;
  const focusedRow = focusRowId ? rows.find((r) => r.id === focusRowId) : null;

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-7 space-y-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <SectionHeader title="Unassigned failures" subtitle={`${unassigned.length} of ${failures.length} failures still need a category.`} />
            <div className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={unassigned.length > 0 && unassigned.every((r) => selected.has(r.id))}
                onCheckedChange={(c) => {
                  if (c) setSelected(new Set(unassigned.map((r) => r.id)));
                  else clearSelection();
                }}
              />
              <span className="text-muted-foreground">Select all</span>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {unassigned.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                All failures are categorized. 🎉
              </p>
            )}
            {unassigned.map((r) => (
              <FailureCard key={r.id} row={r}
                checked={selected.has(r.id)} onToggle={() => toggle(r.id)}
                focused={focusRowId === r.id} onFocus={() => setFocusRowId(r.id)}
                rubric={rubric} categories={rubric.categories}
                onAssign={(catId) => assignTo(catId, [r.id])}
              />
            ))}
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="sticky bottom-4 z-10 rounded-xl border border-foreground/20 bg-foreground text-background shadow-lg">
            <div className="flex items-center gap-3 px-4 py-3 text-sm">
              <Badge variant="secondary" className="font-mono">{selectedCount} selected</Badge>
              <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
                <Sparkles className="h-3.5 w-3.5" />New category from selection
              </Button>
              <Select onValueChange={(v) => assignTo(v, Array.from(selected))}>
                <SelectTrigger className="h-8 w-[220px] border-background/20 bg-background/10 text-background">
                  <SelectValue placeholder="Assign to existing…" />
                </SelectTrigger>
                <SelectContent>
                  {rubric.categories.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No categories yet</div>}
                  {rubric.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="ml-auto text-background hover:bg-background/10" onClick={clearSelection}>Clear</Button>
            </div>
          </div>
        )}
      </div>

      <div className="col-span-5 space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader title="Failure categories" subtitle="Cluster results by root cause." />
          <Button size="sm" variant="outline" onClick={() => { setCreateOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />New
          </Button>
        </div>

        <div className="space-y-2">
          {rubric.categories.map((c) => {
            const assigned = failures.filter((r) => r.categoryId === c.id);
            return (
              <CategoryColumn key={c.id} cat={c} assigned={assigned}
                onRename={(n) => update((p) => ({ ...p, rubric: { ...p.rubric, categories: p.rubric.categories.map((x) => (x.id === c.id ? { ...x, name: n } : x)) } }))}
                onDescribe={(d) => update((p) => ({ ...p, rubric: { ...p.rubric, categories: p.rubric.categories.map((x) => (x.id === c.id ? { ...x, description: d } : x)) } }))}
                onUnassign={(rowId) => assignTo(null, [rowId])}
                onDelete={() => {
                  if (!confirm(`Delete category "${c.name}"? Assigned rows become unassigned.`)) return;
                  update((p) => ({
                    ...p,
                    rubric: { ...p.rubric, categories: p.rubric.categories.filter((x) => x.id !== c.id) },
                    rows: p.rows.map((r) => (r.categoryId === c.id ? { ...r, categoryId: null } : r)),
                  }));
                }}
                onFocusRow={(id) => setFocusRowId(id)}
              />
            );
          })}
          {rubric.categories.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No categories yet. Select a few similar failures on the left and click <b>New category from selection</b>.
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New failure category</DialogTitle>
            <DialogDescription>{selectedCount > 0 ? `${selectedCount} selected row${selectedCount === 1 ? "" : "s"} will be assigned to this category.` : "You can assign rows to it later."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input className="mt-1" autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. Hallucinated content" />
            </div>
            <div>
              <Label className="text-xs">Description / root cause</Label>
              <Textarea className="mt-1 h-24" value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="What pattern do these failures share? What's the likely fix?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createCategoryFromSelection}>Create{selectedCount > 0 ? ` & assign ${selectedCount}` : ""}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!focusedRow} onOpenChange={(o) => !o && setFocusRowId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Failure detail</DialogTitle>
          </DialogHeader>
          {focusedRow && (
            <div className="space-y-3">
              <PreviewBlock label="Input" value={focusedRow.input} />
              <PreviewBlock label="Ground truth" value={focusedRow.groundTruth} />
              <PreviewBlock label="Prediction" value={focusedRow.prediction} accent />
              {focusedRow.notes && <PreviewBlock label="Notes" value={focusedRow.notes} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FailureCard({
  row, checked, onToggle, focused, onFocus, categories, onAssign, rubric,
}: {
  row: Row; checked: boolean; onToggle: () => void;
  focused: boolean; onFocus: () => void;
  categories: FailureCategory[]; onAssign: (catId: string | null) => void;
  rubric: Rubric;
}) {
  const reasons = effectiveStatus(row, rubric).reasons;
  return (
    <div className={cn(
      "group flex items-start gap-3 rounded-lg border bg-surface-2 p-3 transition-colors",
      checked ? "border-foreground/40 ring-1 ring-foreground/20" : "border-border hover:border-foreground/30"
    )}>
      <Checkbox className="mt-1" checked={checked} onCheckedChange={onToggle} />
      <button onClick={onFocus} className="min-w-0 flex-1 text-left">
        <div className="line-clamp-1 text-xs font-medium text-muted-foreground">{row.input || <em>no input</em>}</div>
        <div className="mt-1 line-clamp-2 text-sm text-foreground">{row.prediction || <em className="text-muted-foreground">no prediction</em>}</div>
        {row.notes && <div className="mt-1 line-clamp-1 text-[11px] italic text-muted-foreground">“{row.notes}”</div>}
        {reasons.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {reasons.map((r, i) => <Badge key={i} variant="outline" className="font-mono text-[10px]">{r}</Badge>)}
          </div>
        )}
      </button>
      <Select value={row.categoryId ?? "none"} onValueChange={(v) => onAssign(v === "none" ? null : v)}>
        <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue placeholder="Assign…" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Unassigned —</SelectItem>
          {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function CategoryColumn({
  cat, assigned, onRename, onDescribe, onUnassign, onDelete, onFocusRow,
}: {
  cat: FailureCategory; assigned: Row[];
  onRename: (n: string) => void; onDescribe: (d: string) => void;
  onUnassign: (rowId: string) => void; onDelete: () => void;
  onFocusRow: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <Input value={cat.name} onChange={(e) => onRename(e.target.value)} className="h-8 border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0" />
        <Badge variant="secondary" className="font-mono text-[10px]">{assigned.length}</Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="p-3">
        <Input value={cat.description ?? ""} onChange={(e) => onDescribe(e.target.value)} placeholder="Root cause / fix hint" className="h-7 text-xs" />
        <button className="mt-2 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setExpanded((x) => !x)}>
          {expanded ? "Hide" : "Show"} {assigned.length} row{assigned.length === 1 ? "" : "s"}
        </button>
        {expanded && (
          <ul className="mt-2 space-y-1.5">
            {assigned.map((r) => (
              <li key={r.id} className="flex items-start gap-2 rounded-md border border-border bg-surface-2 p-2 text-xs">
                <button onClick={() => onFocusRow(r.id)} className="min-w-0 flex-1 text-left">
                  <div className="line-clamp-1 text-foreground">{r.prediction || <em className="text-muted-foreground">no prediction</em>}</div>
                </button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => onUnassign(r.id)}><X className="h-3 w-3" /></Button>
              </li>
            ))}
            {assigned.length === 0 && <li className="text-[11px] text-muted-foreground">No rows yet.</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

function PreviewBlock({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={cn("mb-1 text-[10px] font-semibold uppercase tracking-wider", accent ? "text-accent" : "text-muted-foreground")}>{label}</div>
      <div className="whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-3 text-sm">{value || <em className="text-muted-foreground">empty</em>}</div>
    </div>
  );
}

function EmptyHint({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
    </div>
  );
}

/* ---------- SUMMARY ---------- */

function SummaryPanel({ project }: { project: Project }) {
  const { rubric, rows } = project;
  const dimAvgs = rubric.dimensions.map((d) => {
    const scored = rows.map((r) => r.scores[d.id]).filter((v): v is number => typeof v === "number");
    const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
    return { name: d.name, avg, count: scored.length, max: d.max };
  });
  const failures = rows.filter((r) => effectiveStatus(r, rubric).status === "fail");
  const catCounts = rubric.categories.map((c) => ({
    name: c.name,
    count: failures.filter((r) => r.categoryId === c.id).length,
  }));
  const unassignedFailures = failures.filter((r) => !r.categoryId).length;
  const pass = rows.filter((r) => effectiveStatus(r, rubric).status === "pass").length;
  const fail = failures.length;
  const passRate = rows.length ? (pass / rows.length) * 100 : 0;
  const maxCat = Math.max(1, ...catCounts.map((c) => c.count), unassignedFailures);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-4 rounded-xl border border-border bg-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pass rate</div>
        <div className="mt-2 font-mono text-5xl font-semibold tabular-nums">{passRate.toFixed(0)}<span className="text-2xl text-muted-foreground">%</span></div>
        <div className="mt-1 text-xs text-muted-foreground">{pass} pass · {fail} fail · {rows.length} total</div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-success" style={{ width: `${passRate}%` }} />
        </div>
      </div>

      {rubric.mode === "dimensional" && (
        <div className="col-span-8 rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Average score by dimension</div>
          <div className="mt-4 space-y-3">
            {dimAvgs.length === 0 && <div className="text-xs text-muted-foreground">No dimensions defined.</div>}
            {dimAvgs.map((d) => (
              <div key={d.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-foreground">{d.name}</span>
                  <span className="font-mono text-muted-foreground">{d.avg.toFixed(2)} / {d.max} <span className="opacity-50">· n={d.count}</span></span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-accent" style={{ width: `${d.max ? (d.avg / d.max) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={cn("rounded-xl border border-border bg-card p-5", rubric.mode === "dimensional" ? "col-span-12" : "col-span-8")}>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Failure distribution</div>
        <div className="mt-4 space-y-2">
          {catCounts.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <div className="w-40 truncate text-xs text-foreground">{c.name}</div>
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-destructive" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                </div>
              </div>
              <div className="w-8 text-right font-mono text-xs text-muted-foreground">{c.count}</div>
            </div>
          ))}
          {unassignedFailures > 0 && (
            <div className="flex items-center gap-3">
              <div className="w-40 truncate text-xs italic text-muted-foreground">Unassigned</div>
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-muted-foreground/40" style={{ width: `${(unassignedFailures / maxCat) * 100}%` }} />
                </div>
              </div>
              <div className="w-8 text-right font-mono text-xs text-muted-foreground">{unassignedFailures}</div>
            </div>
          )}
          {catCounts.length === 0 && unassignedFailures === 0 && (
            <div className="text-xs text-muted-foreground">No failures yet — or none clustered.</div>
          )}
        </div>
      </div>
    </div>
  );
}
