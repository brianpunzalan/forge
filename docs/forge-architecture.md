# Forge — Architecture Spec (POC)

Status: decisions locked after design interview. Single-user, local, BYOK. UI-only generation.

> Flow diagrams: see [`forge-flows.md`](./forge-flows.md).

## Product scope

Forge is a software factory that generates **UI-only** applications using the Pi coding agent
(`@earendil-works/pi-coding-agent` v1.1.0). Generated output is scoped to reusable UI
(component-library-friendly), so backend-requiring requests are **mocked client-side**.

## Integration model

> **Revised during build.** Pi runs **in-process (a1)**, not via `RpcClient` (a2). Gondolin's
> `VM` object is **process-local** — whoever calls `VM.create()` is the only process that can
> `vm.exec` / `vm.fs` / `vm.enableIngress()`. Since the control plane must own the preview
> (dev server + ingress + teardown), it must also own the VM, which forces pi into the same
> process. "Pi process isolation" moved to the deferred ledger.

- One chat = one **pi `AgentSession` (in-process)** + **one gondolin VM (control-plane-owned)**
  + one workspace directory + one Pi session JSONL.
- Events are the in-process `AgentSessionEvent`s, forwarded verbatim over SSE (with `details.patch`
  stripped). The delta-only `JsonAgentSessionEvent` wire optimization is deferred.
- Control plane (Fastify) holds BYOK model keys. The guest VM never sees keys.

## Workspace & sandbox

- **Host-backed workspace (choice A).** Per-session host dir is the source of truth for files;
  mounted read-write at `/workspace` inside the VM via `RealFSProvider`.
- Gondolin extension re-registers `read`/`write`/`edit`/`bash` to execute inside the VM.
- **Invariant — fail closed:** only sandboxed tools are enabled. No host `grep`/`find`/`ls`.
  If the extension fails to load, abort session creation (default tools run on the host).
- **Invariant — per-session cwd:** the sandbox extension is built as an inline factory closing
  over that session's workspace dir, so `read`/`write`/`edit`/`bash` operate on the right
  `/workspace` mount.
- **Guest provisioning:** the default Alpine guest has no Node. On first VM boot the control
  plane runs `apk add nodejs npm` + `npm i -g pnpm` (idempotent). This requires
  `dl-cdn.alpinelinux.org` in the egress allowlist; a prebuilt image with Node is a later
  optimization.

## Network policy

- Egress allowlist: `registry.npmjs.org` + `dl-cdn.alpinelinux.org` (guest provisioning only).
  Model provider host is **not** allowed.
- DNS mode: `synthetic` (default). Guest resolves synthetic IPs; host resolves + connects.
- Preview ingress exposes only `/ :5173` (single route) — emergent "UI-only" enforcement.

## Events & streaming

- In-process `AgentSessionEvent`s forwarded verbatim over SSE, one monotonic **per-session `seq`**
  on every event (delta-only `JsonAgentSessionEvent` wire optimization deferred).
- Streaming done signal = `agent_settled` (not `agent_end`/`turn_end`).
- Deltas (`text_delta`, `thinking_delta`, `toolcall_delta`, `tool_execution_update`) are
  streamed live and kept only in an **in-memory ring buffer** per live session. Not persisted.
- Authoritative events (`message_*`, `tool_execution_*`, `turn_*`, `agent_*`, `queue_update`,
  compaction/retry, `thinking_level_changed`, `session_info_changed`) are persisted.

## Persistence

| Artifact | Store |
|---|---|
| Session metadata | Postgres `sessions` |
| Authoritative events (transcript) | Postgres `session_events` |
| Resumable agent state | Pi session JSONL on disk (controlled `--session-dir`) |
| Generated source code | Host workspace dir (not in any DB) |

- **No Redis in the POC.** Live fan-out and the recent-delta buffer are in-process memory.
- Postgres never stores pointers into volatile stores (no "Redis keys" columns).
- Resume = new `AgentSession` over `SessionManager.open(jsonlPath)`; never reconstruct agent
  state from Postgres rows (loses tree/tool results/compaction metadata).

### Schema (minimum)

```sql
sessions(
  id uuid pk, workspace_dir text, session_file_path text,
  status text, model text, last_seq bigint, created_at, updated_at
);
session_events(
  id bigserial, session_id fk, seq bigint, type text, payload jsonb,
  created_at, unique(session_id, seq)
);
```

- Per-event async insert of authoritative events; flush at `agent_settled`.
- Large/truncated bash results: store `full_output_path`, cap inline content (not 1 MiB in JSONB).
- Failure semantics: at-most-once with a small loss window (acceptable for POC).

## API & transport

- `POST /sessions` — create (workspace + pi `AgentSession` + Postgres row; VM is lazy).
- `POST /sessions/:id/prompt` — user input. Mid-run: default `followUp`, explicit `steer` path.
- `GET /sessions/:id/events` — SSE. Replays authoritative events from cursor
  (`Last-Event-ID`), then attaches to live deltas. No separate transcript endpoint.
- Abort = `abort()` + `clearQueue()`. Single writer per session: second writer → `409`.
- Auth: shared token in HttpOnly cookie (EventSource can't send custom headers). Preview ports
  unauthenticated, loopback-bound.

## Chat UI

- Streaming text; thinking in a collapsible block behind a spinner (buffer `thinking_delta`).
- All tool calls rendered: `bash` → live terminal (streamed stdout/stderr + exit code),
  `edit` → diff, `write`/`read`/`grep`/`find`/`ls` → panels. Strip `details.patch`.
- Queue banner renders `queue_update` (`steering`/`followUp` queues) with a Steer button.
- Linear chat = flat projection of the active branch (tree is the data model; flat is the view).
- Stop button + Esc → abort (clears queue).

## Preview

- Control plane owns the dev server + ingress route. Agent only writes code.
- Start: background in guest (`nohup <pm> dev ... > /tmp/dev.log 2>&1 & echo $!`), poll
  `curl -sf 127.0.0.1:5173`, emit `preview_ready`. Teardown: kill PID, `preview_stopped`.
- Convention: `pnpm dev`; fallback `pnpm vite --host 0.0.0.0 --port 5173`; else
  `preview_unavailable` + surface error.
- Browser reaches preview via **per-session `localhost:PORT`** proxy (HTTP + WS for HMR).
  Path-prefix proxying is rejected (breaks Vite absolute URLs + HMR).

## Code preview

- Host `fs.watch` (recursive) + debounce → `files_changed` SSE events; full `file_tree`
  snapshot at `agent_settled`.
- Exclusions: `node_modules`, `.git`, `dist`, `.vite`, build output, `*.log`, `/tmp/*`.
  Binary → list-only badge; text >200KB → truncated with note.
- Read-only is a UI affordance (no edit controls), not enforcement.
- Freshness: eventual ("code pane reflects disk as of last debounce; preview reflects last HMR").

## Lifecycle & failure modes

- Create → workspace + in-process pi `AgentSession` + Postgres row (VM created lazily on first tool use).
- Teardown = explicit stop or idle TTL; **non-destructive** (`vm.close()` + `session.dispose()`;
  workspace + JSONL survive).
- Resume = new `AgentSession` over `SessionManager.open(jsonlPath)` + new VM + **deterministic
  dev-server restart** (user does not re-prompt).
- VM crash: **respawn + retry, then degrade.** On `vm.exec` failure, discard the dead VM and
  lazily re-create it (fresh boot + remount workspace) so the next tool/turn retries; after N
  failed attempts (default 2 retries), mark the session `degraded` and require restart/resume.
- Control-plane restart: sessions become `stopped` (resumable from Postgres + disk), not `live`.
- Concurrency: 1–3 live sessions for local POC.

## UI-only enforcement (soft)

1. System prompt: UI-only, no backend/DB/API; backend asks are mocked client-side.
2. Egress allowlist (`registry.npmjs.org` + Alpine mirror) — no server deps/network.
3. Single exposed port (`/ :5173`) — a backend on another port is not previewable.

## Deferred ledger (future development, in rough priority order)

1. Checkpoint/restore UI (event log is persisted; tree-navigation UI deferred).
2. Redis — for multi-process: session→owner registry + cross-process delta buffer.
3. Multi-process control plane / multi-machine data plane (gondolin as a service + placement).
4. Spend caps, loop prevention, token budgets, per-user rate limits.
5. Multi-user auth / per-user BYOK / session isolation.
6. Session tree UI beyond flat active-branch projection (fork/steer history).
7. Subdomain-per-session preview URLs (vs. `localhost:PORT`).
8. Durable delta persistence (in-memory ring buffer only for now).
9. Secret scrubbing / truncation of tool output over SSE.
10. Compaction/retry event rendering (events exist; UI surfacing deferred).
11. Pi process isolation (`RpcClient` subprocess) — blocked on gondolin exposing a cross-process
    VM handle; would otherwise need an HTTP exec bridge into the control-plane-owned VM.
12. Prebuilt guest image with Node/pnpm (avoid per-boot `apk add`).

## Done slice (POC milestone)

1. Home prompt → POST → workspace + in-process pi session + gondolin VM (lazy boot).
2. SSE streams `AgentSessionEvent` → chat renders text, thinking, tool panels, queue
   banner + steer, Stop (abort + clear queue).
3. Agent writes UI-only app → control plane starts `pnpm dev`, writes ingress route, emits
   `preview_ready` → iframe at `localhost:PORT`.
4. Code pane via `fs.watch` shows source, read-only.
5. Single writer (409), multi-reader SSE, single `seq`, replay from Postgres, authoritative
   events persisted.
6. Non-destructive teardown; resume restarts the dev server deterministically.

## Environment

- `@earendil-works/pi-coding-agent` pinned to `1.1.0` (Node >= 22.19.0).
