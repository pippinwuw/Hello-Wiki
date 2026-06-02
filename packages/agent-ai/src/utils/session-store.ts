import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AgentHistoryMessage } from "../agent/schemas.js";

export type SessionEvent =
  | {
      type: "user" | "assistant";
      sessionId: string;
      workspaceId: string;
      content: string;
      timestamp: number;
    }
  | {
      type: "toolResult";
      sessionId: string;
      workspaceId: string;
      toolName: string;
      result: unknown;
      timestamp: number;
    };

export type SessionStore = {
  readHistory(sessionId: string): Promise<AgentHistoryMessage[]>;
  append(event: SessionEvent): Promise<void>;
};

const DEFAULT_SESSION_DIR = path.resolve(process.cwd(), "data", "agent-sessions");

function safeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export class JsonlSessionStore implements SessionStore {
  constructor(private readonly baseDir = process.env.AGENT_AI_SESSION_DIR ?? DEFAULT_SESSION_DIR) {}

  async readHistory(sessionId: string): Promise<AgentHistoryMessage[]> {
    let content = "";
    try {
      content = await readFile(this.sessionPath(sessionId), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as SessionEvent)
      .filter(isChatEvent)
      .map((event) => ({
        role: event.type,
        content: event.content,
        timestamp: event.timestamp,
      }));
  }

  async append(event: SessionEvent): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    const filePath = this.sessionPath(event.sessionId);
    await writeFile(filePath, `${JSON.stringify(event)}\n`, { flag: "a" });
  }

  private sessionPath(sessionId: string): string {
    return path.join(this.baseDir, `${safeSessionId(sessionId)}.jsonl`);
  }
}

function isChatEvent(
  event: SessionEvent,
): event is Extract<SessionEvent, { type: "user" | "assistant" }> {
  return event.type === "user" || event.type === "assistant";
}
