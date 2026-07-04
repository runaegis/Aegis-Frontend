# Shadow Mode — frontend contract + backend spec

Shadow Mode is the observe-only onboarding path: a new customer points their agent
at Aegis, nothing is ever blocked, and after some traffic they see a report of what
Aegis *would* have done — then flip to enforcement. It is the safest possible way to
land a design partner (their prod agents are never at risk during evaluation).

This PR ships the **entire frontend** against a defined contract and renders fully on
the demo workspace today. The backend is small: a mode flag + an observe branch.
The report needs **no new endpoint** for v1 — it is derived client-side from the
`session_actions` the audit log already stores.

## What the frontend already does

- **IA:** a `Shadow` tab on every room (`/dashboard/rooms/[id]/shadow`), plus the
  `enforcement_mode` field on the room model (`observe` | `warn` | `enforce`,
  defaulting to `observe`).
- **Enforcement ramp:** `EnforcementModeControl` (observe → warn → enforce). Changing
  it calls `api.setRoomEnforcementMode(roomId, mode)`.
- **Report:** `buildShadowReport()` (`lib/shadowReport.ts`) turns a room's recorded
  actions (`getSessionsByRoomId`) into the stat row, decision mix, tool distribution,
  and the ranked "moments that mattered". Same code path renders demo and real data.
- **Onboarding:** a room with no traffic shows the "observing, waiting for first
  action" state with a Connect CTA; once actions exist it shows the report.
- **Export:** a client-side JSON evidence pack (works today). A richer PDF pack can
  reuse the existing audit export later.

## What the backend needs (Jenil)

### 1. `rooms.enforcement_mode` column
`enforce | warn | observe`, **default `observe`** for new rooms. Add to the room model
and return it from `GET /room/{id}` (the frontend reads `room.enforcement_mode`).

### 2. `PATCH /room/{id}/enforcement-mode`
Body `{ "mode": "observe" | "warn" | "enforce" }`. Auth: room owner/admin only. This is
the one new endpoint the frontend calls.

### 3. The observe branch in `call_tool_handler`
This is the core change. Today the handler classifies → decides → **enforces**. Add a
mode gate around the *enforcement*, not the classification:

- **`enforce` (today's behavior):** classify, decide, apply (block / rewrite / pause).
- **`observe`:** classify and decide exactly as today, **persist the would-be decision**
  to `session_actions` (same `decision` / `blast_radius` / `policy` fields the audit log
  already writes), then **always forward the original call upstream** — never block,
  rewrite, or pause. Nothing the agent does is changed.
- **`warn`:** same as observe (forward upstream), but include the would-be decision in
  the tool response text so the agent sees the warning without being stopped.

Because observe records the *would-be* decision using the existing persistence path, the
Shadow Report is real the moment an observed room has traffic — no extra storage, no new
aggregate endpoint. (An optional `GET /room/{id}/shadow-report?window=7d` aggregate is a
scale optimization for later; the client computes it fine from `getSessionsByRoomId`
today.)

### Note on REWRITE in observe
In observe mode Aegis cannot actually rewrite (it must forward the original action). The
report shows these as "would have been rewritten" — the diff/preview is informational.
That is correct and expected.

## Why this is the right first customer surface

Shadow Mode tolerates the governance-correctness bugs from the codebase review
(fail-open classifier, the SQL `_RISK_ORDER` bypass) — in observe mode a misclassification
is just a slightly-off report line, never a wrong prod action. It still needs the
credential/auth P0s (the customer's tokens flow through the proxy). So it is the fastest
path to a live design partner: ship the observe branch + the auth P0s, and a partner can
run their real agents through Aegis with zero risk.
