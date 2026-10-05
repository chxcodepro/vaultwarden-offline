# Agent Note: Chrome password CSV import preserves autofill credentials

Status: implemented

## Problem

Every file named .csv is routed to the Bitwarden importer. Chrome exports
url, username and password rather than login_uri, login_username and
login_password. The old route imports item names but silently drops login
credentials and URLs. Those entries cannot match websites for autofill, while
newly saved logins continue to work.

## Decision

CSV formats are detected by parsed column names, not the file extension.
ChromeCsv has a separate importer reusing the existing RFC 4180 parser. It
requires url, username and password columns, accepts optional name and note
(also notes), and normalizes header casing without altering secret values.
A Chrome URL remains a single URI even when it contains commas. Unsupported
CSV headers fail explicitly before any vault mutation.

Existing encrypted storage, merge rules and website matching stay unchanged.
Reimporting the source Chrome CSV adds complete credentials. Previously broken
entries are preserved, not automatically overwritten or deleted: the original
fields are absent and cannot be reconstructed from those entries.

## Alternatives considered

- Add Chrome aliases inside the Bitwarden parser: fewer new lines, but that
  couples two different schemas and incorrectly splits Chrome URLs containing
  commas using Bitwarden's multi-URI field convention.
- Ask users to rewrite CSV headers: avoids another importer, but shifts a
  mechanical compatibility task to users and still leaves silent acceptance of
  arbitrary .csv files unresolved.
- Repair name-only entries automatically on reimport: hides old incomplete
  duplicates, but cannot distinguish genuinely incomplete user entries from
  those created by this bug. Existing records are not deleted implicitly.

## Consequences

Chrome imports now preserve the data required by the existing autofill engine.
The filename alone no longer enables importing unrelated CSV formats; this is
an intentional stricter boundary. Chrome CSV has no native vault IDs, folders,
TOTP or passkey payloads, so those are not invented.

Regression tests reproduce the original missing fields before the fix, then
cover required columns, old exports, BOM, column order, quotes, multiline
secrets, notes, rejected schemas, Bitwarden compatibility, safe reimport and
website matching after a Never-mode restart. Browser verification uses a
synthetic CSV and the existing standard login fixture in an isolated profile.
The menu displays the imported account and fills both fields before and after
a complete browser restart without a master-password prompt. All 481 tests
pass (7 optional-fixture tests skip); TypeScript, Svelte and offline build
checks pass.

History audit: the existing Never-lock note concerns key lifetime and is
unrelated to CSV schema detection; it is not superseded by this decision.
