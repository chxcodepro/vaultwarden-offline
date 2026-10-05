import { describe, expect, it } from "vitest";

import { findAllMatchingLoginCiphers } from "@/background/context-menu";
import { KdfType } from "@/core/crypto";
import { VaultTimeoutType } from "@/core/state/settings";
import { createMemoryStorage } from "@/core/state/storage.port";
import { VaultStatus } from "@/core/state/vault-status";
import { CipherType } from "@/core/vault/enums";
import { loadVault } from "@/core/vault/vault-repository";
import { createVault, getStatus, readVaultData, saveSettings } from "@/core/vault/vault.service";

import { parseBitwardenCsv } from "./bitwarden-csv";
import { serializeCsv } from "./csv";
import { mergeIntoVault, parseImport, probeImport } from "./import.service";
import { ImportError } from "./types";

const CHROME_CSV =
  "name,url,username,password,note\r\n" +
  "Example,https://example.test/login,test-user,test-password,Imported note\r\n";

describe("Chrome password CSV import", () => {
  it("detects Chrome columns even when the file is named .csv", () => {
    expect(probeImport(CHROME_CSV, "Chrome Passwords.csv")).toMatchObject({
      format: "chrome-csv",
      requiresPassword: false,
    });
  });

  it("maps website, username, password and note into a login", async () => {
    const parsed = await parseImport(CHROME_CSV, undefined, "Chrome Passwords.csv");

    expect(parsed.ciphers).toHaveLength(1);
    expect(parsed.ciphers[0]).toMatchObject({
      type: CipherType.Login,
      name: "Example",
      notes: "Imported note",
      login: {
        username: "test-user",
        password: "test-password",
        uris: [{ uri: "https://example.test/login" }],
      },
    });
    expect(parsed.folders).toEqual([]);
  });

  it("accepts Chrome's older four-column export", async () => {
    const parsed = await parseImport(
      "name,url,username,password\nExample,https://example.test,user,password\n",
    );

    expect(parsed.ciphers[0]?.login?.password).toBe("password");
    expect(parsed.ciphers[0]).not.toHaveProperty("notes");
  });

  it("accepts the required three columns and uses the URL as a missing name", async () => {
    const parsed = await parseImport("url,username,password\nhttps://example.test,user,password\n");

    expect(parsed.ciphers[0]?.name).toBe("https://example.test");
    expect(parsed.ciphers[0]?.login?.username).toBe("user");
  });

  it("handles BOM, quoted and reordered column names, blank lines and case", async () => {
    const parsed = await parseImport(
      '\ufeff\r\n" PASSWORD ","URL","USERNAME","NAME"\r\nsecret,https://example.test,user,Example\r\n',
      undefined,
      "passwords.csv",
    );

    expect(parsed.ciphers[0]).toMatchObject({
      name: "Example",
      login: { username: "user", password: "secret", uris: [{ uri: "https://example.test" }] },
    });
  });

  it("preserves whitespace and CSV special characters without splitting a URL at commas", async () => {
    const username = ' user,"name" ';
    const password = ' pass,"word"\nnext line ';
    const note = "line one,\r\nline two";
    const uri = "https://example.test/login?return=a,b";
    const text = serializeCsv(["name", "url", "username", "password", "note"], [
      { name: "Example", url: uri, username, password, note },
    ]);

    const parsed = await parseImport(text);

    expect(parsed.ciphers[0]?.login).toEqual({ username, password, uris: [{ uri }] });
    expect(parsed.ciphers[0]?.notes).toBe(note);
  });

  it("also preserves a notes column from Google Password Manager exports", async () => {
    const parsed = await parseImport(
      "name,url,username,password,notes\nExample,https://example.test,user,password,My note\n",
    );

    expect(parsed.ciphers[0]?.notes).toBe("My note");
  });

  it("retains an empty username and password as empty values", async () => {
    const parsed = await parseImport("name,url,username,password\nExample,https://example.test,,\n");

    expect(parsed.ciphers[0]?.login).toEqual({
      username: "",
      password: "",
      uris: [{ uri: "https://example.test" }],
    });
  });

  it.each([
    "name,url,username\nExample,https://example.test,user\n",
    "name,other\nExample,something\n",
    "url,username,password_backup\nhttps://example.test,user,secret\n",
  ])("rejects unsupported CSV headers instead of silently importing partial logins", async (text) => {
    expect(() => probeImport(text, "passwords.csv")).toThrow(ImportError);
    await expect(parseImport(text, undefined, "passwords.csv")).rejects.toThrow(/CSV/);
  });

  it("keeps recognizing Bitwarden CSV columns", async () => {
    const text = "name,login_uri,login_username,login_password\nExample,https://example.test,user,secret\n";

    expect(probeImport(text, "export.csv").format).toBe("bitwarden-csv");
    expect((await parseImport(text)).ciphers[0]?.login?.password).toBe("secret");
  });

  it("recognizes quoted Bitwarden headers too", () => {
    expect(probeImport('"name","login_password"\nExample,secret\n').format).toBe("bitwarden-csv");
  });

  it("imported credentials remain available to autofill after a Never-mode restart", async () => {
    const storage = createMemoryStorage();
    await createVault(storage, "local-master123", {
      kdf: { type: KdfType.PBKDF2_SHA256, iterations: 5_000 },
    });
    await mergeIntoVault(storage, await parseImport(CHROME_CSV));
    await saveSettings(storage, { vaultTimeout: VaultTimeoutType.Never });

    const restarted = { local: storage.local, session: createMemoryStorage().session };
    expect(await getStatus(restarted)).toBe(VaultStatus.Unlocked);
    const matches = await findAllMatchingLoginCiphers(restarted, "https://example.test/login");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.login?.username).toBe("test-user");
    expect(matches[0]?.login?.password).toBe("test-password");
    expect(await findAllMatchingLoginCiphers(restarted, "https://unrelated.test")).toEqual([]);
    expect(JSON.stringify(await readVaultData(storage))).not.toContain("test-password");
  });

  it("reimporting adds complete credentials without deleting previously broken entries", async () => {
    const storage = createMemoryStorage();
    await createVault(storage, "local-master123", {
      kdf: { type: KdfType.PBKDF2_SHA256, iterations: 5_000 },
    });
    await mergeIntoVault(storage, parseBitwardenCsv(CHROME_CSV));
    const result = await mergeIntoVault(storage, await parseImport(CHROME_CSV));

    expect(result.added).toBe(1);
    expect((await loadVault(storage)).ciphers).toHaveLength(2);
    expect(await findAllMatchingLoginCiphers(storage, "https://example.test")).toHaveLength(1);
  });
});
