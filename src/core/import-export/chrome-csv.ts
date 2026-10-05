import { CipherRepromptType, CipherType } from "@/core/vault/enums";
import type { CipherView } from "@/core/vault/models";

import { parseCsv, parseCsvRecords } from "./csv";
import { ImportError, type ParsedVault } from "./types";

/** Chrome exports name,url,username,password,note; older exports omit note. */
export function looksLikeChromeCsv(text: string): boolean {
  const header = parseCsv(text).find((row) => row.some((cell) => cell.trim() !== ""));
  const columns = new Set(header?.map((name) => name.trim().toLowerCase()));
  return ["url", "username", "password"].every((name) => columns.has(name));
}

export function parseChromeCsv(text: string): ParsedVault {
  if (!looksLikeChromeCsv(text)) {
    throw new ImportError("Chrome 密码 CSV 必须包含 url、username 和 password 列。");
  }

  const now = new Date().toISOString();
  const ciphers = parseCsvRecords(text).map((raw): CipherView => {
    const record = Object.fromEntries(
      Object.entries(raw).map(([name, value]) => [name.toLowerCase(), value]),
    );
    const uri = (record["url"] ?? "").trim();
    const notes = record["note"] ?? record["notes"];

    return {
      id: crypto.randomUUID(),
      type: CipherType.Login,
      name: record["name"] || uri || "未命名条目",
      favorite: false,
      reprompt: CipherRepromptType.None,
      creationDate: now,
      revisionDate: now,
      ...(notes == null || notes === "" ? {} : { notes }),
      login: {
        // Passwords and usernames are literal values, including whitespace.
        username: record["username"] ?? "",
        password: record["password"] ?? "",
        ...(uri === "" ? {} : { uris: [{ uri }] }),
      },
    };
  });

  return { ciphers, folders: [], degradedCollections: 0 };
}
