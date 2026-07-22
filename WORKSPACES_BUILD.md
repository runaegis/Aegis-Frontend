# Agent Workspace — frontend build handoff

Written for an agent picking this up cold. Read the whole file before editing;
several of the constraints below are non-obvious and at least four of them
caused real bugs during the build.

---

## 1. What this is

A redesigned frontend for the **Agent Workspace** feature: a room where several
AI agents coordinate on one goal, with tasks, an agent roster, shared files, and
one-time agent-key issuance. It is a **frontend-only** build against an existing
API contract. **No backend changes were made or are required.**

Status: complete and working end to end against an in-memory demo layer. Not
merged, not pushed, not reviewed.

---

## 2. Where the code lives — read this first

The build is **not in the repo**. It lives in an ephemeral scratchpad copy:

```
/private/tmp/claude-501/-Users-ahaaniqbal-Aegis-Redesign/011d3e94-ecac-46ec-9cdd-f533c5003ce1/scratchpad/fe-workspaces
```

That path is a full copy of `runaegis/Aegis-Frontend` checked out at Jenil's
`workspaces` branch (commit `281be04`), plus this feature on top.

**This directory can be wiped.** The first job of whoever picks this up is
probably to move it somewhere durable:

```bash
# from a clean clone of runaegis/Aegis-Frontend, on a branch off `workspaces`
git checkout workspaces
git checkout -b feat/workspace-redesign
# copy the feature files listed in §4 over, then commit
```

### Running it

A dev-server entry already exists in `.claude/launch.json` at the project root
(`/Users/ahaaniqbal/Aegis Redesign/.claude/launch.json`):

```json
{
  "name": "workspaces-preview",
  "runtimeExecutable": "bash",
  "runtimeArgs": ["-c", "cd '<scratchpad>/fe-workspaces' && npm run dev -- --webpack -p 3021"],
  "port": 3021
}
```

Then open:

- `http://localhost:3021/dashboard/workspaces?demo=1` — the list
- `http://localhost:3021/workspaces/ws-analytics-api` — a populated room
- `http://localhost:3021/workspaces/ws-docs-refresh` — an empty room (exercises zero-states)

`--webpack` is deliberate: Next 16 defaults to Turbopack and every other preview
entry in this repo pins webpack.

---

## 3. Non-negotiable constraint: do not disrupt Jenil's work

Jenil owns the Agent Workspace backend and shipped the original frontend at
`runaegis/Aegis-Frontend@workspaces`. The rule for this build was that his work
must remain untouched, and it has been:

- **`app/workspaces/page.tsx` (his 1,633-line page) is untouched** and still
  renders at `/workspaces`. You can A/B it against the new room on the same
  server.
- The new routes are **additive**, so there are **zero file collisions** with his
  branch. This can land as a clean diff.
- The real clone at `Aegis-Frontend/` has **no tracked changes**.
- Remote branch `workspaces` HEAD is still `281be04`.

Verify at any time:

```bash
cd "/Users/ahaaniqbal/Aegis Redesign/Aegis-Frontend" && git status --porcelain
gh api repos/runaegis/Aegis-Frontend/branches/workspaces --jq '.commit.sha[0:7]'
```

---

## 4. File inventory

### New routes (additive)

| Path | Notes |
|---|---|
| `app/dashboard/workspaces/page.tsx` | Workspace list, **inside** the dashboard shell |
| `app/workspaces/[id]/page.tsx` | The room, **full-bleed**, outside the shell. Server component. |

`app/workspaces/page.tsx` and `app/workspaces/layout.tsx` are **Jenil's — do not edit.**

### New components — `components/workspaces/` (3,266 lines)

| File | Lines | Role |
|---|---|---|
| `WorkspaceRoom.tsx` | 460 | Room orchestrator: data, mutations, layout, keyboard, theme |
| `AgentChat.tsx` | 452 | Unified timeline: messages + lifecycle events |
| `Composer.tsx` | 377 | Message input, @mention autocomplete, reply context |
| `WorkspacesList.tsx` | 242 | Dense list rows |
| `agent-visuals.tsx` | 241 | Agent identity: hue context, glyphs, mention rendering |
| `TaskChecklist.tsx` | 206 | Tasks grouped by status |
| `AgentRoster.tsx` | 210 | Roster, invite, rotate, revoke |
| `RoomSidebar.tsx` | 162 | Room switcher with progress + rosters |
| `shortcuts.tsx` | 153 | Keyboard layer + shortcuts dialog + `Kbd` |
| `InlineEdit.tsx` | 150 | Click-to-edit title and goal |
| `Dialog.tsx` | 132 | Shared modal shell |
| `FilesPanel.tsx` | 105 | Files shared in the room |
| `AgentKeyDialog.tsx` | 103 | Copy-once agent key + MCP config |
| `CreateWorkspaceDialog.tsx` | 102 | New workspace form |
| `RoomSummary.tsx` | 88 | Always-visible progress + stat tiles |
| `WorkspaceDemoGate.tsx` | 38 | Installs the demo API before children render |
| `PanelEmpty.tsx` | 30 | Shared empty state for rail panels |
| `rail-footer.ts` | 15 | The `RAIL_FOOTER` alignment constant — see §8 |

### Other new files

- `lib/workspace-preview.ts` (459 lines) — in-memory demo API, see §6

### Shared files touched (only these two)

1. **`components/layout/Sidebar.tsx`** — added a `Workspaces` nav entry
   (`MessagesSquare` icon) to the Workspace group.
2. **`app/layout.tsx`** — extended the FOUC theme script's path gate. See §8.4.
   This one is behavioural; do not revert it without reading that section.

---

## 5. The API contract

Defined in `lib/api.ts` on the `workspaces` branch. **Preserve it exactly** —
the whole point is that this drops onto Jenil's backend with no server changes.

Types: `WorkspaceRecord`, `WorkspaceSummary`, `WorkspaceAgent`,
`WorkspaceMessage`, `WorkspaceFileRef`, `WorkspaceTaskPointer`,
`WorkspaceDetail`, `WorkspaceAgentKeyResponse`.

**11 of 12 methods are wired:**

`getWorkspaces`, `createWorkspace`, `getWorkspace`, `updateWorkspace`,
`createWorkspaceAgent`, `updateWorkspaceAgent`, `rotateWorkspaceAgentKey`,
`createWorkspaceMessage`, `createWorkspacePointer`, `updateWorkspacePointer`,
`deleteWorkspacePointer`.

**Not used: `getWorkspacePointers`** — `getWorkspace` already returns `pointers`
on the detail, so a separate fetch would be redundant. If you add a view that
needs pointers without the full detail, that method is there.

### Schema gaps the UI works around

- **No `reply_to_message_id`.** Reply relationships are *derived* from
  `mentioned_member_ids`. See §8.5.
- **`WorkspaceSummary` has no `done_count` and no roster.** The room switcher
  needs both, which forces an N+1. See §8.6.

---

## 6. The demo data layer

`lib/workspace-preview.ts` monkey-patches the `api` object with an in-memory
implementation, mirroring the existing `lib/preview-data.ts` pattern.

- **Mutable, not fixtures.** Creating a workspace, posting a message, issuing a
  key, and moving a task all genuinely work.
- Simulated ~260ms latency so loading states are real.
- Seeds three workspaces: a populated one, a quieter one, and an empty one.
- Installed by `WorkspaceDemoGate` via a `useState` initialiser, which runs
  during the parent's first render — i.e. before children mount and call the API.

Both new pages wrap their content in `<WorkspaceDemoGate>`. **To point at the
real backend, stop rendering that gate.** Nothing else changes; every component
talks to `api.*` directly.

The `Sample data` chip in the list and room headers exists so demo data is never
mistaken for real data. Keep it until the gate is removed.

---

## 7. Design system rules

- **Tokens only.** Colours, radii, and spacing come from `app/globals.css`
  (AlignUI-style: `--bg-app`, `--bg-surface`, `--text-strong`,
  `--stroke-soft-200`, `--primary-base`, `--success`/`--error`/`--warning`/
  `--feature`/`--info`). No hard-coded hexes outside the rgba tints that mirror
  the existing `Badge` component.
- **Brand orange is for primary CTAs and active state only.** Never decorative.
- **Borders and tonal shifts, not shadows,** for hierarchy inside the room
  (Linear's approach). The one raised surface is the list container.
- **Colour is identity, not decoration.** Agent hue appears in text and status
  dots; surfaces stay neutral. An earlier version filled every glyph and mention
  with saturated tint and it read as a rainbow.
- **No em dashes in UI copy.**
- Reuse `components/ui/*` (`Button`, `Badge`, `Input`, `Card`, `EmptyState`,
  `ErrorBanner`, `Skeleton`, `ConfirmDialog`, `CopyButton`, `RelativeTime`)
  rather than rebuilding.

---

## 8. Gotchas that will bite you

These are real bugs that happened, not hypotheticals.

### 8.1 `cn()` is NOT tailwind-merge

`lib/utils.ts`:

```ts
export function cn(...classes) { return classes.filter(Boolean).join(' '); }
```

It is a plain join. **Conflicting Tailwind classes do not resolve** — both land
in the class list and CSS order decides, unpredictably. Passing
`className="w-auto"` to override a base `w-full` silently fails.

**Rule:** decide a conflicting property once (branch on a prop) rather than
layering an override. Example in `InlineEdit.tsx`, which picks
`multiline ? 'block w-full' : 'inline-block max-w-full truncate'`.

### 8.2 Next 16 removed synchronous `params`

`params` is async-only; sync access is fully removed. That is why
`app/workspaces/[id]/page.tsx` is a **server component** that awaits `params`
and passes the id to the client room:

```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkspaceDemoGate><WorkspaceRoom workspaceId={id} /></WorkspaceDemoGate>;
}
```

`AGENTS.md` in this repo also warns that this Next version differs from training
data and tells you to read `node_modules/next/dist/docs/`. That warning is real.

### 8.3 The composer auto-grow must re-measure on the next frame

The textarea measures its own content to grow. `scrollHeight` is the max of
content height and client height, so measuring against `height: auto` on a flex
child can **latch the field open at its 160px ceiling**. This happened twice:
once on mount, once when the reply strip appeared in the same commit.

The working version collapses to `0px` before measuring, short-circuits the
empty case to a fixed base height, and **re-measures inside
`requestAnimationFrame`** so a stale first-pass layout self-corrects. Do not
"simplify" this back to a single `auto` measurement.

### 8.4 Theme is path-gated in `app/layout.tsx`

The inline FOUC script applies `data-theme` only on certain paths. It originally
returned early for anything outside `/dashboard` and `/onboarding` — which meant
the room at `/workspaces/[id]` **always rendered light**, even for a user who had
chosen dark, and had no toggle because the theme control lives in the dashboard's
profile menu.

The gate now includes `/workspaces`. `aegis_sidebar_collapsed` stays
dashboard-only because only the dashboard has that sidebar.

The room also has its own theme toggle in the rail footer, using the exported
`useTheme()` hook from `components/ui/ThemeToggle` so persistence stays on the
canonical `aegis_theme` key.

**If you add more routes outside `/dashboard`, extend this gate too.**

### 8.5 Reply threading is derived, not stored

There is no `reply_to_message_id`. `buildAnswerMap()` in `AgentChat.tsx` infers
it: message B answers A when **B mentions A's sender AND A mentioned B's sender**.
Anything ambiguous is left unlinked rather than given a wrong parent.

Two deliberate suppressions, both to avoid noise:

1. If the parent is the **immediately preceding** message, no quote is drawn —
   you can already see it.
2. Each parent is quoted **at most once**, so follow-ups don't re-quote the same
   message.

If the backend ever adds a real reply field, replace this function and delete the
suppressions.

### 8.6 The room switcher does an N+1

`WorkspaceSummary` carries counts but not rosters or done-counts, so
`WorkspaceRoom.load()` fetches each sibling's detail to render agent glyphs and
progress in the left rail. The current workspace reuses the detail already in
hand; failures degrade to counts rather than breaking the row.

Three requests at demo scale, but it would not be at fifty workspaces. **The
right fix is server-side:** return `done_count` and a small roster preview on the
summary, then delete the extra fetches.

### 8.7 Agent hue must come from roster order, not a hash

Hashing handles to hues collides — `@backend` and `@frontend` both landed on
green and became indistinguishable. Hue is now assigned by **position in the
roster** via `AgentHueProvider`, with the hash kept only as a fallback for
handles no longer in the roster.

**The provider must wrap its consumers.** A component cannot read the context it
renders itself. That is why `AgentHandle` exists as a small component instead of
`WorkspaceRoom` resolving hue inline.

### 8.8 Verification traps

- **`curl` returning 200 does not mean it compiles.** Next dev serves the page
  shell with a 200 while the client module fails. Check the **browser console**.
- **The console buffer does not clear on navigation.** Errors from an
  intermediate save (e.g. adding a component's usage before its import) persist
  and look current. Confirm against the **live DOM** and the **file on disk**
  before chasing a ghost. This wasted time repeatedly.

---

## 9. Layout contracts

### The bottom rule (`rail-footer.ts`)

The room has two bottom bars side by side: the composer (centre) and the rail
footer (right). If their heights differ, the horizontal rule across the room
breaks.

```
composer 103px  ==  tab footer 69px (RAIL_FOOTER) + shortcuts/theme row 34px
```

Every rail tab uses the shared `RAIL_FOOTER` class so the rule holds whichever
tab is open. The no-agents composer is also pinned to 103px for the same reason.
**If you change either side, change both** and re-measure.

### The timeline rail

`AgentChat` draws a vertical rail through the entry nodes. It sits inside a
**content-sized wrapper** so it spans exactly the entries — an earlier version
was positioned against the scroller and drew a long line into empty space in
sparse rooms. Its `left-[27px]` matches the node centres relative to that
wrapper.

### Responsive

- `< lg` — left rail hidden
- `< xl` — right rail becomes a drawer with a backdrop, opened from the header
- `< sm` — composer reflows so the field takes full width

---

## 10. What is NOT done

Honest list of gaps:

- **File attachment is a stub.** The paperclip adds a fake `WorkspaceFileRef`; no
  real upload. Wire to whatever storage the backend exposes.
- **No pagination anywhere.** Messages, tasks, and workspaces all render in full.
- **No realtime.** State refreshes by refetching after each mutation. There is no
  socket or polling, so a second participant's message will not appear until
  something else triggers a load.
- **Task edit is status-only.** `updateWorkspacePointer` supports title,
  description, and `sort_order`, but the UI only cycles status and deletes. Drag
  reordering is unbuilt despite `sort_order` existing.
- **Cross-org invite (AEG-29 P3) is not built.** Agent keys are issued, but there
  is no guest/external-tenant flow.
- **No tests.** Nothing automated; all verification was manual browser driving.
- **Demo layer is always on** in this build (see §6).

---

## 11. Verification checklist

Manual, in a browser. There are no automated tests.

1. **List** — rows render; create a workspace; empty and loading states.
2. **Room, populated** (`ws-analytics-api`) — timeline shows messages *and*
   lifecycle events (created / joined / task added / completed); directed headers
   read `@sender → @target`; exactly one derived reply quote appears.
3. **Composer** — type `@sec`, autocomplete filters, Enter accepts, Enter sends,
   Shift+Enter newlines.
4. **Message actions** — hover a message: `Reply` prefills the mention and shows
   the context strip; `Task` creates a truncated task.
5. **Tasks** — add; click the status dot to cycle pending → review → done;
   grouping and the progress bar update.
6. **Agents** — invite; the key dialog shows once with the `.mcp.json` snippet;
   rotate; revoke moves the agent to Removed.
7. **Inline edit** — click the title and the goal; Escape reverts, blur commits.
8. **Keyboard** — `t`, `i`, `/`, `?`, `Esc`. Confirm they do **not** fire while
   typing in a field.
9. **Empty room** (`ws-docs-refresh`) — zero-states everywhere; composer replaced
   by the invite prompt; bottom rule still aligned.
10. **Theme** — toggle in the rail footer; reload and confirm it persists; confirm
    the choice carries to `/dashboard/workspaces` and back.
11. **Responsive** — mobile, tablet, desktop; open the drawer below `xl`.
12. **Regression** — `/workspaces` still renders Jenil's original page.
13. **Console clean**, and `git status` clean in the real clone.

Useful measurement snippet (run in the browser console):

```js
// bottom-rule alignment: expect railStack === composerH and topDelta === 0
```

---

## 12. Suggested next steps

Roughly in order of value:

1. **Move the code somewhere durable** and open a PR off `workspaces` (§2).
2. **Ask the backend for `done_count` + roster preview on `WorkspaceSummary`**,
   then delete the N+1 (§8.6).
3. **Real file upload** to replace the stub.
4. **Realtime or polling** — the multi-agent story is weak without it, since the
   whole premise is several agents posting concurrently.
5. **Task title/description editing and drag reordering** (`sort_order` is
   already in the contract).
6. Decide whether `reply_to_message_id` should become a real field; if so,
   replace the derivation in §8.5.

---

## 13. Provenance

Built against `runaegis/Aegis-Frontend@workspaces` (`281be04`, Jenil Parmar).
Design direction researched from Linear, GitHub, Slack, ClickUp, Threads,
Dialpad, WhatsApp, Microsoft Teams, Cohere, Appwrite, and Anam via Refero and
Mobbin. Every visual decision traces to one of those or to the existing token
system; none of it is invented taste.
