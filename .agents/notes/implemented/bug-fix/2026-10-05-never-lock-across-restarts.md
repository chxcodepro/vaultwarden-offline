# Agent Note: Never-lock policy across browser restarts

Status: implemented

## Problem

The Never timeout disables inactivity locking, but the UserKey lives only in
browser session storage. Browser restarts therefore lock the vault regardless
of this choice, making the Never option unable to satisfy persistent access.

## Decision

Only the existing Never policy remembers the plaintext UserKey in local
storage. Defaults remain a 15-minute timeout. The remembered record binds the
key to the current wrappedUserKey; password changes refresh this binding.
Status and repository key reads use the remembered key only when session
storage is empty and Never is still selected. Reads do not restore session
state, so a delayed read cannot rewrite a key after a concurrent manual lock.

Manual locking removes the remembered key before clearing session secrets and
pending fill intents. Switching policies deletes the remembered key but retains
the current browser session, including when the key originated from local
storage after a restart. Creation, master-password unlock and PIN unlock honor
the selected policy. Pending fill intents never persist across restarts.

Chromium local storage access is restricted to trusted extension contexts before
writing the key. Firefox does not expose setAccessLevel. The settings warning
and bilingual privacy policy disclose the plaintext key and device-access risk.

## Alternatives considered

- Keep session-only storage: strongest existing at-rest boundary, but it cannot
  implement the requested access across browser restarts, even under Never.
- Persist every unlock and remove locking globally: removes repeated prompts
  without configuration, but silently weakens all existing lock policies and
  manual-lock behavior. Only explicit Never opts into the weaker boundary.
- Add a separate remember-unlock preference: allows restart retention with
  inactivity locking, but adds another interacting policy and does not fix the
  existing Never semantics as directly.

## Consequences

Never supports restart access without storing passwords or changing ciphertext
formats. Reading browser profile storage is sufficient to decrypt the vault
while the remembered key exists. Deleting the key is logical removal, not a
promise of secure erasure from filesystem backups. Device-bound protection
requires an OS-backed key store/native companion and is outside this change.

Tests replace session storage while retaining local storage to simulate browser
restart. Coverage includes opt-in, default locking, manual lock, policy changes,
PIN unlock, password changes, malformed keys, vault replacement and Chromium
access restrictions. Verification commands are `npm test`, `npm run check`,
`npm run check:svelte`, and `npm run build`.

History audit: no existing proposed, implemented or rejected agent notes exist
in this repository, so there are no overlapping decisions to reconcile.
