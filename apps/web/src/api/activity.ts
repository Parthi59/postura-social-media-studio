import { api } from "./client";
import type { ActivityEvent } from "../types";

export async function getActivity(): Promise<ActivityEvent[]> {
  const data = await api<ActivityEvent[]>("/api/activity");

  return Array.isArray(data) ? data : [];
}