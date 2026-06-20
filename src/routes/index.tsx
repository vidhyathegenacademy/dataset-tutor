import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Plus, Upload, Download, Trash2, FlaskConical, Settings2, FileText, Check, X,
  ChevronRight, FilePlus2, GripVertical, BarChart3,
} from "lucide-react";
import { parseCsv, buildRows, rowsToCsv, type ColumnMap } from "@/lib/csv";
import {
  defaultRubric, effectiveStatus, uid,
  type Project, type Rubric, type Row, type Dimension, type FailureCategory, type FailRule,
} from "@/lib/eval-types";
import { loadAll, saveAll, getActiveId, setActiveId, newProject } from "@/lib/eval-storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EvalLoop — Systematic LLM Output Evaluation" },
      { name: "description", content: "Score, annotate, and triage any LLM dataset against a custom rubric. PASS/FAIL logic, failure categories, exports." },
      { property: "og:title", content: "EvalLoop — Systematic LLM Output Evaluation" },
      { property: "og:description", content: "Score, annotate, and triage any LLM dataset against a custom rubric." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  component: App,
});

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActive] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

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
        projects={projects}
        activeId={activeId}
        onSelect={setActive}
        onCreate={createProject}
        onDelete={deleteProject}
      />
      {active ? (
        <Workspace project={active} update={updateActive} />
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
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
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
              <Input autoFocus placeholder="e.g. Social media post — sprint 24" value={newName}
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
        <div className="ml-auto text-xs text-muted-foreground">
          Local-only. Data lives in your browser.
        </div>
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
        <h1 className="mt-6 text-center text-3xl font-semibold tracking-tight">Build an evaluation loop for any LLM dataset</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
          Upload a CSV of inputs, ground truth, and predictions. Define a custom rubric, score each row,
          tag failures, and export annotated results — all in the browser.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button onClick={() => onCreate("Untitled evaluation")}>
            <FilePlus2 className="h-4 w-4" />Create your first evaluation
          </Button>
        </div>
        <div className="mt-10 grid grid-cols-3 gap-3 text-xs">
          {[
            { icon: Upload, t: "Bring your own data", d: "CSV with any column names — map them to input / ground truth / prediction." },
            { icon: Settings2, t: "Custom rubric", d: "Define scoring dimensions, PASS/FAIL rules, and failure taxonomy." },
            { icon: Download, t: "Export annotations", d: "Download an annotated CSV ready for analysis or judge training." },
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

function Workspace({ project, update }: { project: Project; update: (u: (p: Project) => Project) => void }) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(project.rows[0]?.id ?? null);
  const [filter, setFilter] = useState<"all" | "pass" | "fail" | "incomplete">("all");

  useEffect(() => {
    if (!project.rows.find((r) => r.id === selectedRowId)) {
      setSelectedRowId(project.rows[0]?.id ?? null);
    }
  }, [project.rows, selectedRowId]);

  const stats = useMemo(() => {
    let pass = 0, fail = 0, inc = 0;
    for (const r of project.rows) {
      const s = effectiveStatus(r, project.rubric).status;
      if (s === "pass") pass++; else if (s === "fail") fail++; else inc++;
    }
    return { pass, fail, inc, total: project.rows.length };
  }, [project.rows, project.rubric]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-4">
      <Tabs defaultValue="annotate" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="annotate"><FileText className="mr-1.5 h-3.5 w-3.5" />Annotate</TabsTrigger>
            <TabsTrigger value="rubric"><Settings2 className="mr-1.5 h-3.5 w-3.5" />Rubric</TabsTrigger>
            <TabsTrigger value="data"><Upload className="mr-1.5 h-3.5 w-3.5" />Data</TabsTrigger>
            <TabsTrigger value="summary"><BarChart3 className="mr-1.5 h-3.5 w-3.5" />Summary</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 text-xs">
            <StatPill label="Pass" value={stats.pass} tone="success" />
            <StatPill label="Fail" value={stats.fail} tone="destructive" />
            <StatPill label="Pending" value={stats.inc} tone="muted" />
            <StatPill label="Total" value={stats.total} tone="default" />
          </div>
        </div>

        <TabsContent value="annotate" className="m-0">
          {project.rows.length === 0 ? (
            <EmptyDataPrompt />
          ) : (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4">
                <RowList
                  rows={project.rows}
                  rubric={project.rubric}
                  selectedId={selectedRowId}
                  onSelect={setSelectedRowId}
                  filter={filter}
                  setFilter={setFilter}
                />
              </div>
              <div className="col-span-8">
                {selectedRowId ? (
                  <RowDetail
                    row={project.rows.find((r) => r.id === selectedRowId)!}
                    rubric={project.rubric}
                    onChange={(updated) =>
                      update((p) => ({ ...p, rows: p.rows.map((r) => (r.id === updated.id ? updated : r)) }))
                    }
                    onNext={() => {
                      const idx = project.rows.findIndex((r) => r.id === selectedRowId);
                      if (idx >= 0 && idx < project.rows.length - 1) setSelectedRowId(project.rows[idx + 1].id);
                    }}
                  />
                ) : (
                  <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                    Select a row to annotate
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rubric" className="m-0">
          <RubricEditor rubric={project.rubric} onChange={(r) => update((p) => ({ ...p, rubric: r }))} />
        </TabsContent>

        <TabsContent value="data" className="m-0">
          <DataPanel project={project} update={update} />
        </TabsContent>

        <TabsContent value="summary" className="m-0">
          <SummaryPanel project={project} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: "success" | "destructive" | "muted" | "default" }) {
  const map: Record<string, string> = {
    success: "bg-success/10 text-success border-success/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    muted: "bg-muted text-muted-foreground border-border",
    default: "bg-surface-2 text-foreground border-border",
  };
  return (
    <div className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono", map[tone])}>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}

function EmptyDataPrompt() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
      <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
      <div className="mt-3 text-sm font-medium">No data yet</div>
      <div className="mt-1 text-xs text-muted-foreground">Open the Data tab to import a CSV or add rows manually.</div>
    </div>
  );
}

function RowList({
  rows, rubric, selectedId, onSelect, filter, setFilter,
}: {
  rows: Row[]; rubric: Rubric; selectedId: string | null;
  onSelect: (id: string) => void;
  filter: "all" | "pass" | "fail" | "incomplete";
  setFilter: (f: "all" | "pass" | "fail" | "incomplete") => void;
}) {
  const filtered = rows.filter((r) => filter === "all" || effectiveStatus(r, rubric).status === filter);
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-1 border-b border-border p-2">
        {(["all", "pass", "fail", "incomplete"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs capitalize" onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>
      <ScrollArea className="h-[calc(100vh-220px)]">
        <ul className="divide-y divide-border">
          {filtered.map((r, i) => {
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
  const map = {
    pass: "bg-success",
    fail: "bg-destructive",
    incomplete: "bg-muted-foreground/40",
  } as const;
  return <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", map[status])} />;
}

function RowDetail({
  row, rubric, onChange, onNext,
}: { row: Row; rubric: Rubric; onChange: (r: Row) => void; onNext: () => void }) {
  const s = effectiveStatus(row, rubric);
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

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scoring</div>
          <div className="font-mono text-xs text-muted-foreground">
            Total: <span className="text-foreground">{rubric.dimensions.reduce((a, d) => a + (row.scores[d.id] ?? 0), 0)}</span>
            <span className="opacity-60"> / {rubric.dimensions.reduce((a, d) => a + d.max, 0)}</span>
          </div>
        </div>
        <div className="space-y-3">
          {rubric.dimensions.map((d) => (
            <DimensionScorer
              key={d.id}
              dim={d}
              value={row.scores[d.id] ?? null}
              onChange={(v) => onChange({ ...row, scores: { ...row.scores, [d.id]: v } })}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Failure category</div>
          <Select
            value={row.categoryId ?? "none"}
            onValueChange={(v) => onChange({ ...row, categoryId: v === "none" ? null : v })}
          >
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {rubric.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manual override</div>
          <div className="mt-1 flex gap-1.5">
            {(["pass", "fail"] as const).map((v) => (
              <Button key={v} size="sm" variant={row.manualStatus === v ? (v === "pass" ? "default" : "destructive") : "outline"}
                className="h-7 flex-1 text-xs capitalize"
                onClick={() => onChange({ ...row, manualStatus: row.manualStatus === v ? null : v })}>
                {v === "pass" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{v}
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</Label>
          <Textarea
            className="mt-2 h-[110px] resize-none text-sm"
            placeholder="Why did this fail? What pattern do you see?"
            value={row.notes ?? ""}
            onChange={(e) => onChange({ ...row, notes: e.target.value })}
          />
        </div>
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
      <Textarea
        className="min-h-[140px] resize-none border-0 bg-transparent p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: "pass" | "fail" | "incomplete" }) {
  if (status === "pass") return <Badge className="bg-success text-success-foreground hover:bg-success">PASS</Badge>;
  if (status === "fail") return <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">FAIL</Badge>;
  return <Badge variant="outline">PENDING</Badge>;
}

function DimensionScorer({ dim, value, onChange }: { dim: Dimension; value: number | null; onChange: (v: number | null) => void }) {
  const options = Array.from({ length: dim.max - dim.min + 1 }, (_, i) => dim.min + i);
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{dim.name}</div>
        {dim.description && <div className="text-xs text-muted-foreground">{dim.description}</div>}
      </div>
      <div className="flex items-center gap-1">
        {options.map((n) => (
          <button
            key={n}
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              "h-8 w-8 rounded-md border text-xs font-medium transition-all",
              value === n
                ? "border-accent bg-accent text-accent-foreground shadow-sm"
                : "border-border bg-surface text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >{n}</button>
        ))}
      </div>
    </div>
  );
}

function RubricEditor({ rubric, onChange }: { rubric: Rubric; onChange: (r: Rubric) => void }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-6 rounded-xl border border-border bg-card p-4">
        <SectionHeader title="Scoring dimensions" subtitle="Define what to measure on each output." />
        <div className="mt-3 space-y-2">
          {rubric.dimensions.map((d, i) => (
            <DimensionRow key={d.id} dim={d}
              onChange={(nd) => onChange({ ...rubric, dimensions: rubric.dimensions.map((x) => (x.id === d.id ? nd : x)) })}
              onRemove={() => {
                const id = d.id;
                onChange({
                  ...rubric,
                  dimensions: rubric.dimensions.filter((x) => x.id !== id),
                  failRules: rubric.failRules.filter((r) => !(r.kind === "dimension_lt" && r.dimensionId === id)),
                });
              }}
              canRemove={rubric.dimensions.length > 1}
              index={i}
            />
          ))}
          <Button variant="outline" size="sm" onClick={() => onChange({
            ...rubric,
            dimensions: [...rubric.dimensions, { id: uid(), name: "New dimension", description: "", min: 1, max: 5 }],
          })}><Plus className="h-3.5 w-3.5" />Add dimension</Button>
        </div>
      </div>

      <div className="col-span-6 space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader title="PASS / FAIL rules" subtitle="A row fails if ANY rule below is triggered." />
          <div className="mt-3 space-y-2">
            {rubric.failRules.map((rule) => (
              <FailRuleRow key={rule.id} rule={rule} dims={rubric.dimensions}
                onChange={(nr) => onChange({ ...rubric, failRules: rubric.failRules.map((r) => (r.id === rule.id ? nr : r)) })}
                onRemove={() => onChange({ ...rubric, failRules: rubric.failRules.filter((r) => r.id !== rule.id) })}
              />
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onChange({
                ...rubric,
                failRules: [...rubric.failRules, { id: uid(), kind: "dimension_lt", dimensionId: rubric.dimensions[0]?.id ?? "", value: 4 }],
              })}><Plus className="h-3.5 w-3.5" />Dimension rule</Button>
              <Button variant="outline" size="sm" onClick={() => onChange({
                ...rubric,
                failRules: [...rubric.failRules, { id: uid(), kind: "total_lt", value: 20 }],
              })}><Plus className="h-3.5 w-3.5" />Total rule</Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader title="Failure categories" subtitle="Taxonomy used to triage failed rows." />
          <div className="mt-3 space-y-2">
            {rubric.categories.map((c) => (
              <CategoryRow key={c.id} cat={c}
                onChange={(nc) => onChange({ ...rubric, categories: rubric.categories.map((x) => (x.id === c.id ? nc : x)) })}
                onRemove={() => onChange({ ...rubric, categories: rubric.categories.filter((x) => x.id !== c.id) })}
              />
            ))}
            <Button variant="outline" size="sm" onClick={() => onChange({
              ...rubric,
              categories: [...rubric.categories, { id: uid(), name: "New category", description: "" }],
            })}><Plus className="h-3.5 w-3.5" />Add category</Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Reset rubric to defaults?")) onChange(defaultRubric()); }}>Reset to defaults</Button>
        </div>
      </div>
    </div>
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

function DimensionRow({ dim, onChange, onRemove, canRemove, index }: { dim: Dimension; onChange: (d: Dimension) => void; onRemove: () => void; canRemove: boolean; index: number }) {
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
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" disabled={!canRemove} onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

function FailRuleRow({ rule, dims, onChange, onRemove }: { rule: FailRule; dims: Dimension[]; onChange: (r: FailRule) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-2.5 text-sm">
      <span className="font-mono text-xs text-muted-foreground">FAIL if</span>
      {rule.kind === "dimension_lt" ? (
        <>
          <Select value={rule.dimensionId} onValueChange={(v) => onChange({ ...rule, dimensionId: v })}>
            <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
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

function CategoryRow({ cat, onChange, onRemove }: { cat: FailureCategory; onChange: (c: FailureCategory) => void; onRemove: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 p-2.5">
      <div className="grid flex-1 grid-cols-12 gap-2">
        <Input className="col-span-4 h-8" value={cat.name} onChange={(e) => onChange({ ...cat, name: e.target.value })} />
        <Input className="col-span-8 h-8" value={cat.description ?? ""} onChange={(e) => onChange({ ...cat, description: e.target.value })} placeholder="Root cause and fix hint" />
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

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
      input: headers.find((h) => /input|prompt|topic/i.test(h)) ?? headers[0] ?? "",
      groundTruth: headers.find((h) => /ground|truth|expected|reference/i.test(h)) ?? headers[1] ?? "",
      prediction: headers.find((h) => /pred|output|model|response|completion/i.test(h)) ?? headers[2] ?? "",
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
"AI safety in production","Reliable AI requires evaluation loops, not vibes. Here is how we ship.","Just shipped some AI! It's super cool and revolutionary. #AI #ML #Innovation"
"Vector databases","Picking the right vector DB depends on filter cardinality and recall targets.","Vector databases are databases for vectors. They store vectors. Vectors are important."
"Prompt engineering","Prompts are interfaces. Treat their iteration like product work — with evals.","Master these 10 prompt hacks and 10x your productivity! Number 7 will shock you 🚀🚀🚀"
"RAG vs fine-tuning","Use RAG for fresh facts; fine-tune for stable behavior. Most teams need both.","RAG is just retrieval. Fine-tuning is just training. Both work great in all cases."
"LLM cost optimization","Cache aggressively, route by complexity, and measure cost per resolved task.","To save money on LLMs, just use a cheaper model. That's literally it."`;
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
        <Textarea
          className="mt-3 h-44 font-mono text-xs"
          placeholder="Or paste CSV text here…"
          value={csvText}
          onChange={(e) => previewCsv(e.target.value)}
        />
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
          <SectionHeader title="Export annotations" subtitle="Download an annotated CSV with scores, status, category, and notes." />
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={downloadCsv} disabled={project.rows.length === 0}><Download className="h-3.5 w-3.5" />Download .csv</Button>
            <span className="text-xs text-muted-foreground">{project.rows.length} rows</span>
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

function SummaryPanel({ project }: { project: Project }) {
  const { rubric, rows } = project;
  const dimAvgs = rubric.dimensions.map((d) => {
    const scored = rows.map((r) => r.scores[d.id]).filter((v): v is number => typeof v === "number");
    const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
    return { name: d.name, avg, count: scored.length, max: d.max };
  });
  const catCounts = rubric.categories.map((c) => ({
    name: c.name,
    count: rows.filter((r) => r.categoryId === c.id).length,
  }));
  const pass = rows.filter((r) => effectiveStatus(r, rubric).status === "pass").length;
  const fail = rows.filter((r) => effectiveStatus(r, rubric).status === "fail").length;
  const passRate = rows.length ? (pass / rows.length) * 100 : 0;

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

      <div className="col-span-8 rounded-xl border border-border bg-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Average score by dimension</div>
        <div className="mt-4 space-y-3">
          {dimAvgs.map((d) => (
            <div key={d.name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-foreground">{d.name}</span>
                <span className="font-mono text-muted-foreground">{d.avg.toFixed(2)} / {d.max} <span className="opacity-50">· n={d.count}</span></span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-accent" style={{ width: `${(d.avg / d.max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-12 rounded-xl border border-border bg-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Failure breakdown</div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {catCounts.map((c) => (
            <div key={c.name} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="text-xs text-muted-foreground">{c.name}</div>
              <div className="mt-1 font-mono text-2xl font-semibold">{c.count}</div>
            </div>
          ))}
          {catCounts.length === 0 && <div className="text-xs text-muted-foreground">No categories defined.</div>}
        </div>
      </div>
    </div>
  );
}
