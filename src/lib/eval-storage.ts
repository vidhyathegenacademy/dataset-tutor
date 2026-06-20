import type { Project } from "./eval-types";
import { defaultRubric, uid } from "./eval-types";

const KEY = "eval-projects-v1";
const ACTIVE = "eval-active-project-v1";

export function loadAll(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

export function saveAll(projects: Project[]) {
  localStorage.setItem(KEY, JSON.stringify(projects));
}

export function getActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE);
}
export function setActiveId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE, id);
  else localStorage.removeItem(ACTIVE);
}

export function newProject(name: string): Project {
  return {
    id: uid(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rubric: defaultRubric(),
    rows: [],
  };
}
