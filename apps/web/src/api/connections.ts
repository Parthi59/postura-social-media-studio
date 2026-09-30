import { api } from "./client";
import type { Connection } from "../types";

type ConnectionsResponse =
  | Connection[]
  | {
      connections?: Connection[];
    };

export async function getConnections(): Promise<Connection[]> {
  const data = await api<ConnectionsResponse>("/api/connections");

  if (Array.isArray(data)) {
    return data;
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray(data.connections)
  ) {
    return data.connections;
  }

  return [];
}

export function isPlatformConnected(
  connections: Connection[],
  platform: Connection["platform"]
): boolean {
  return connections.some(
    connection =>
      connection.platform === platform &&
      connection.connected
  );
}