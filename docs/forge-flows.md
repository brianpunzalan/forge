# Forge — Flow Diagrams

Companion to [`forge-architecture.md`](./forge-architecture.md). All main flows, rendered with Mermaid.

## 1. Component overview

```mermaid
flowchart LR
    subgraph Browser["Browser"]
        ChatUI["Chat UI"]
        Preview["Preview iframe"]
        CodePane["Code pane"]
    end

    subgraph CP["Fastify control plane (host)"]
        API["HTTP + SSE API"]
        Fanout["Event fan-out + seq"]
        Ring["In-memory delta ring buffer"]
        Lifecycle["Session lifecycle manager"]
        Agent["AgentSession (in-process)"]
    end

    subgraph DP["Data plane (same host, POC)"]
        PI["pi AgentSession (in-process)"]
        VM["Gondolin VM (QEMU)"]
        WS["Workspace dir (host)"]
    end

    DB[("Postgres")]
    JSONL[("Pi session JSONL")]

    ChatUI <-->|"POST + SSE (cookie)"| API
    Preview -->|"HTTP + WS (HMR)"| API
    CodePane -->|"files_changed (SSE)"| API

    API --> Fanout --> Ring
    API --> Lifecycle --> Wrapper --> PI
    PI -->|"vm.exec (sandboxed tools)"| VM
    VM -->|"mount rw at /workspace"| WS
    PI --> JSONL
    API -->|"fs.watch"| WS
    Fanout -->|"authoritative events"| DB
    API -->|"replay on open"| DB
```

## 2. Session creation

```mermaid
sequenceDiagram
    actor U as User
    participant CP as Control plane
    participant DB as Postgres
    participant PI as pi AgentSession
    participant VM as Gondolin VM

    U->>CP: POST /sessions (prompt)
    CP->>CP: create workspace dir (host)
    CP->>PI: spawn pi --mode rpc (cwd=workspace, --session-dir, env=BYOK)
    CP->>VM: VM.create (mount workspace at /workspace, httpHooks allowlist, enableIngress)
    Note over VM: lazy boot — VM starts on first tool use
    CP->>DB: INSERT sessions (status=running)
    CP-->>U: 201 (sessionId)
    U->>CP: GET /sessions/id/events (SSE, cookie)
```

## 3. Chat turn (prompt / followUp / steer)

```mermaid
sequenceDiagram
    actor U as User
    participant CP as Control plane
    participant PI as pi AgentSession
    participant VM as Gondolin VM
    participant DB as Postgres

    U->>CP: POST /sessions/id/prompt (message)
    alt agent idle
        CP->>PI: prompt(message)
    else mid-run default
        CP->>PI: followUp(message)
    else user chose steer
        CP->>PI: steer(message)
    end

    PI->>VM: sandboxed tool (read/write/edit/bash)
    VM-->>PI: streamed stdout/stderr

    loop agent run
        PI-->>CP: JsonAgentSessionEvent
        CP->>CP: stamp seq, ring-buffer deltas
        CP-->>U: SSE event (live)
        opt authoritative event
            CP->>DB: async INSERT session_events
        end
    end

    PI-->>CP: agent_settled
    CP->>DB: flush final state
    CP-->>U: SSE agent_settled (streaming done)
```

## 4. Reconnect / initial-open replay

```mermaid
flowchart TD
    A["Client opens SSE (Last-Event-ID = K)"] --> B{"Session live in this process?"}
    B -->|yes| C["Drain in-memory ring buffer for seq > K"]
    B -->|no| D["Replay authoritative events from Postgres where seq > K"]
    C --> E["Attach to live fan-out"]
    D --> E
    E --> F["Stream deltas + authoritative events forward"]
```

## 5. Preview lifecycle

```mermaid
sequenceDiagram
    participant PI as pi AgentSession
    participant VM as Gondolin VM
    participant CP as Control plane
    participant U as User

    PI->>VM: agent writes code (sandboxed tools)
    PI-->>CP: agent_settled
    CP->>VM: write ingress route "/ :5173" to /etc/gondolin/listeners
    CP->>VM: nohup pnpm dev --host 0.0.0.0 --port 5173 (background, get PID)
    VM-->>CP: PID
    loop readiness poll
        CP->>VM: curl -sf 127.0.0.1:5173
        VM-->>CP: 200 when ready
    end
    CP->>CP: allocate localhost:PORT proxy
    CP-->>U: SSE preview_ready (url)
    U->>CP: GET localhost:PORT (HTTP + WS HMR)
    CP->>VM: proxy via gondolin ingress gateway
```

## 6. Resume a stopped session

```mermaid
sequenceDiagram
    actor U as User
    participant CP as Control plane
    participant DB as Postgres
    participant PI as pi AgentSession (new)
    participant VM as Gondolin VM (new)

    U->>CP: open session
    CP->>DB: load metadata + JSONL path
    CP->>DB: replay authoritative events -> SSE (seq 0..N)
    CP->>PI: spawn + switchSession(jsonlPath)
    CP->>VM: VM.create + mount workspace at /workspace
    CP->>VM: start pnpm dev + ingress route (deterministic, no re-prompt)
    CP-->>U: preview_ready (new url)
```

## 7. Teardown (non-destructive)

```mermaid
flowchart TD
    A["Session live"] --> B{"Trigger?"}
    B -->|"explicit stop"| C["Teardown"]
    B -->|"idle TTL"| C
    C --> D["kill dev server PID in VM"]
    D --> E["vm.close()"]
    E --> F["agentSession.dispose()"]
    F --> G["status = stopped in Postgres"]
    G --> H["workspace + JSONL survive"]
    H --> I["Session resumable"]
    C --> J["SSE preview_stopped + session_stopped"]
```

## 8. Failure modes

```mermaid
flowchart TD
    A{"What failed?"}
    A -->|"pi run throws"| B["catch + mark session error"]
    B --> C["mark session error"]
    C --> D["emit terminal SSE event"]
    D --> E["cleanup VM"]
    E --> F["session resumable from JSONL"]

    A -->|"VM crash"| G["vm.exec throws"]
    G --> H["tool_execution_end (isError)"]
    H --> I{"retry < N?"}
    I -->|yes| J["discard dead VM, respawn + remount, retry tool/turn"]
    J --> H
    I -->|no| K["mark degraded, require restart/resume"]

    A -->|"control plane restart"| L["live sessions killed; VMs orphaned"]
    L --> M["all sessions -> stopped"]
    M --> N["resume on next open"]
```

## 9. Persistence data flow

```mermaid
flowchart LR
    PI["pi AgentSession"] -->|"JsonAgentSessionEvent"| CP["Control plane"]
    CP --> S{"seq stamp + classify"}
    S -->|deltas| R["In-memory ring buffer"]
    S -->|authoritative| D[("Postgres session_events")]
    R --> X["live only — evicted = gone"]
    D --> Y["SSE replay on open/reconnect"]
    CP -->|"fs.watch"| WS["Workspace dir"]
    WS -->|"files_changed"| CP
    PI -->|"auto-save"| J[("Pi session JSONL")]
```

## 10. Session state machine

```mermaid
stateDiagram-v2
    [*] --> creating
    creating --> running
    running --> idle: agent_settled
    idle --> running: prompt
    running --> stopping: abort / stop
    running --> error: pi run error
    error --> stopped: cleanup
    running --> degraded: VM crash after N retries
    degraded --> running: respawn VM / restart
    idle --> stopping: idle TTL / explicit stop
    stopping --> stopped: non-destructive teardown
    stopped --> resuming: open session
    resuming --> running
    resuming --> idle
```

## 11. UI-only enforcement (soft, layered)

```mermaid
flowchart TD
    P["User prompt"] --> S["System prompt: UI-only, mock client-side"]
    S --> T["Tool allowlist: read/write/edit/bash (sandboxed only)"]
    T --> E["Egress allowlist: registry.npmjs.org only"]
    E --> I["Ingress: only / :5173 exposed"]
    I --> O["Output: UI-only app"]
    O -.->|"backend ask"| M["Mocked client-side"]
```
