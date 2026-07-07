// Local AI, via a user-installed Ollama instance — see src-tauri/src/ai.rs for the
// install/serve/model lifecycle this wraps. Not part of `FsBackend`: it isn't a
// filesystem backend, and it's only ever available under Tauri (there's nothing
// sensible to mock in a plain-browser dev session, so every call here is a no-op/throw
// when `isTauri()` is false).
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "../fs";

export interface AiStatus {
  installed: boolean;
  running: boolean;
}

export interface AiModel {
  name: string;
  size: number;
}

export interface AiPullProgress {
  status: string;
  completed?: number;
  total?: number;
}

const NOT_TAURI = "Local AI is only available in the desktop app";

export async function aiStatus(): Promise<AiStatus> {
  if (!isTauri()) return { installed: false, running: false };
  return invoke<AiStatus>("ai_status");
}

export async function aiInstall(onLog: (line: string) => void): Promise<void> {
  if (!isTauri()) throw new Error(NOT_TAURI);
  let unlisten: UnlistenFn | undefined;
  try {
    unlisten = await listen<string>("ai-install-log", (e) => onLog(e.payload));
    await invoke("ai_install");
  } finally {
    unlisten?.();
  }
}

export async function aiStartServer(): Promise<void> {
  if (!isTauri()) throw new Error(NOT_TAURI);
  await invoke("ai_start_server");
}

export async function aiStopServer(): Promise<void> {
  if (!isTauri()) throw new Error(NOT_TAURI);
  await invoke("ai_stop_server");
}

export async function aiListModels(): Promise<AiModel[]> {
  if (!isTauri()) return [];
  return invoke<AiModel[]>("ai_list_models");
}

export async function aiPullModel(name: string, onProgress: (p: AiPullProgress) => void): Promise<void> {
  if (!isTauri()) throw new Error(NOT_TAURI);
  let unlisten: UnlistenFn | undefined;
  try {
    unlisten = await listen<AiPullProgress>("ai-pull-progress", (e) => onProgress(e.payload));
    await invoke("ai_pull_model", { name });
  } finally {
    unlisten?.();
  }
}

export async function aiDeleteModel(name: string): Promise<void> {
  if (!isTauri()) throw new Error(NOT_TAURI);
  await invoke("ai_delete_model", { name });
}

export async function aiGenerate(model: string, prompt: string): Promise<string> {
  if (!isTauri()) throw new Error(NOT_TAURI);
  return invoke<string>("ai_generate", { model, prompt });
}

/** Pulls the first JSON object/array out of a model's response — local models often wrap
 *  structured output in a markdown code fence or add a sentence of prose around it. */
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(close);
  if (end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
