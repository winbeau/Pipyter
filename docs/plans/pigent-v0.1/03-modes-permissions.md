# Ask, Plan and Auto execution

## Goal

Expose exactly three Pigent modes and make their behavior consistent across the model prompt, copied Pigent runtime, Pipyter Python bridge, Shell/Kernel runtime, and browser UI:

- **Ask** reads and answers.
- **Plan** reads, delegates, and maintains Tasks without changing the runtime.
- **Auto** receives the full execution capability of the Pipyter runtime user.

There is no Pilot mode and no hidden fourth execution tier. A mode is session state selected by the user/host. The model may recommend a mode change but cannot change it by placing a fake field in tool arguments.

## Execution authority

Pigent must behave like the user operating the same compute node:

```text
Pigent Auto capability
  = authenticated Pipyter session
  ∩ runtime process OS identity
  ∩ permissions granted by the operating system/container
```

Pipyter does not add a second workspace-only sandbox or a command denylist on top of that identity.

Consequences:

- relative paths start from the linked workspace for convenience;
- Auto may use absolute paths and parent paths when the runtime user can access them;
- Auto may run Shell commands, Python, package managers, Git, network clients, system programs, and interactive applications available to that user;
- Auto may read or modify files outside the linked project when the OS user can do so;
- privilege escalation or identity-changing programs are not rejected by a Pigent policy layer, but they still succeed or fail according to the OS and may require direct interactive input;
- single-user installs inherit the installing/login user’s authority;
- multi-user deployments must obtain isolation by running each workspace as the correct OS/container user, not by pretending to parse arbitrary commands safely.

The Python bridge still authenticates the Pigent process, resolves the target runtime/session, preserves revisions where a structured tool supports them, bounds protocol payloads, supports cancellation, and records audit facts. Those mechanisms provide correctness and ownership, not a reduced execution capability.

## Capability model

Capabilities remain useful for projecting Ask/Plan/Auto schemas even though Auto is unrestricted at the application layer:

```text
filesystem.read
filesystem.write
visual.read
notebook.read
notebook.write
kernel.status
kernel.inspect
kernel.execute
process.execute
process.interactive
network
system.execute
tasks.write
delegate.read
delegate.write
```

Examples:

| Operation | Capabilities |
| --- | --- |
| `read` | `filesystem.read` |
| `view(file)` | `filesystem.read`, `visual.read` |
| `write`, `update` | `filesystem.write` |
| `notebook.read_cell` | `notebook.read` |
| `notebook.run_cell` | `notebook.write`, `kernel.execute` |
| `kernel.status` | `kernel.status` |
| `kernel.execute` | `kernel.execute` |
| `inspect.dataframe` | `kernel.inspect` |
| `tasks.patch` | `tasks.write` |
| read-only `delegate` profile | `delegate.read` |
| implementation `delegate` profile | `delegate.write` plus child tool capabilities |
| ordinary `bash` | `process.execute` |
| network/package/system command | `process.execute` plus `network` or `system.execute` as descriptive audit facts |
| command requiring a TTY | `process.execute`, `process.interactive` |

The Python bridge computes descriptive facts from the resolved operation when possible. They are not used to silently remove Auto capabilities.

## Mode matrix

Legend:

- `allow`: tool/action is available.
- `deny`: tool/action is unavailable because it contradicts the selected mode.
- `os`: available in Auto; the operating system/runtime identity determines the actual result.
- `interactive`: available in Auto but may pause for direct user input through a terminal/browser interaction channel.

| Capability | Ask | Plan | Auto |
| --- | --- | --- | --- |
| `filesystem.read` | allow | allow | os |
| `visual.read` | allow | allow | os |
| `notebook.read` | allow | allow | os |
| `kernel.status` | allow | allow | os |
| `kernel.inspect` | allow | allow | os |
| `tasks.write` | deny | allow | allow |
| `delegate.read` | allow | allow | allow |
| `filesystem.write` | deny | deny | os |
| `notebook.write` | deny | deny | os |
| `kernel.execute` | deny | deny | os |
| `process.execute` | deny | deny | os |
| `process.interactive` | deny | deny | interactive |
| `network` | deny without an exposed read-only research adapter | deny without an exposed read-only research adapter | os |
| `system.execute` | deny | deny | os/interactive |
| `delegate.write` | deny | deny | allow when the selected child profile includes it |

Ask and Plan restrictions define product intent. Auto is the single execution mode and must not be weakened into a hidden “structured tools only” mode.

## Ask

Intent: answer and analyze without changing project or runtime state.

Advertised actions:

- `read`
- `view`
- `notebook.read_cell`
- `kernel.status`
- non-mutating `inspect`
- `delegate` with non-writing profiles

Not advertised:

- `write`, `update`, `bash`
- mutating `notebook` actions
- executing/restarting/shutting down `kernel` actions
- `tasks` by default
- write-capable `delegate`

Ask may read any path the runtime user can read when the tool is called explicitly. Sensitive files are not automatically injected into model context, but Pigent does not fabricate a separate filesystem permission model.

## Plan

Intent: inspect, reason, delegate analysis/review, and create a structured Tasks tree without modifying files, notebooks, kernels, or processes.

Advertised actions:

- all Ask actions;
- `tasks`;
- non-writing `delegate` profiles.

Plan restrictions are enforced through projected tool/action schemas and Python validation of the selected session mode. Raw `bash` remains absent because a general Shell cannot be made non-mutating by command-name parsing.

A Plan result should include:

- 3–7 meaningful phases when practical;
- dependencies and completion criteria;
- known risks and decisions;
- no fabricated verification results;
- no automatic transition to Auto.

## Auto

Intent: execute the requested work end to end with the same practical authority as the runtime user.

Normal flow:

```text
read/view/inspect
  → tasks
  → write/update/notebook
  → bash/kernel
  → view/inspect/tests
  → tasks done
```

Auto behavior:

- all ten public tools and all valid actions are available;
- structured file and notebook operations retain revision checks and atomicity because they improve correctness;
- Shell and Kernel operations are not confined to the workspace;
- environment variables, current directory, installed programs, network access, devices, and mounted filesystems match the runtime identity unless the host deployment itself changes them;
- commands are not rejected merely because they contain package managers, network clients, absolute paths, deletion, privilege tools, or identity tools;
- process timeout and user cancellation stop work when technically possible but do not reduce what may be started;
- sub-agents assigned an implementation profile can receive the same execution tools, while still following the explicit delegated task boundary.

### OS identity is the boundary

Record the identity and runtime context used by Auto:

```json
{
  "mode": "auto",
  "execution_identity": {
    "username": "researcher",
    "uid": 1000,
    "home": "/home/researcher",
    "workspace": "/home/researcher/project"
  },
  "runtime": {
    "kind": "local-user",
    "containerized": false
  }
}
```

The browser may show `Auto · researcher@compute-node` or an equivalent compact identity hint. It must not claim sandbox confinement unless the deployment actually runs that user in a container/sandbox.

### Interactive operations

Some user-equivalent operations require direct input that must not pass through model context, for example:

- sudo password prompts;
- SSH host/password or hardware-key interaction;
- browser login, OAuth, CAPTCHA, or device approval;
- an interactive REPL/program reading from a TTY;
- confirmations emitted by the program itself.

These operations are not denied. The tool/session emits an interaction event and attaches or opens the corresponding Shell/PTY for the user. Authentication bytes go directly to the terminal/browser target and are not copied into the Agent prompt, normal events, or logs.

The confirmation card shown in the design remains reusable for:

- optional `review_all` workspace preference;
- direct handoff to an interactive Shell;
- a product-specific approval requested by the user;
- previewing an irreversible action before execution when optional review is enabled.

The default Auto policy is automatic execution, not mandatory approval for ordinary commands.

## Tool projection by mode

The Pigent host exposes only relevant schemas to reduce context and accidental calls.

### Ask catalog

```text
read
view
notebook   (read actions only)
kernel     (status only)
inspect
delegate   (non-writing profiles)
```

### Plan catalog

```text
Ask catalog
tasks
```

### Auto catalog

```text
read
view
write
update
bash
notebook
kernel
inspect
tasks
delegate
```

For multi-action tools, JSON Schema is mode-filtered so Ask/Plan cannot call execution actions merely because the parent tool exists. Python rechecks the trusted session mode.

## Session and mode lifecycle

Persist one of three mode values:

```json
{
  "mode": "auto",
  "changed_by": "user",
  "changed_at": "...",
  "approval_preference": "automatic"
}
```

There is no requested/effective split and no Auto-to-another-mode degradation.

Transitions:

- the user can switch modes while idle;
- switching from Auto to Ask/Plan blocks newly requested mutations/executions;
- queued calls not allowed by the new mode are cancelled;
- an in-flight OS process follows the explicit cancellation policy instead of being silently detached;
- switching to Auto requires a user/host action; a prompt, child agent, or tool argument cannot upgrade itself;
- reconnect restores the same mode, active calls, Tasks snapshot, Shell sessions, and interaction state without replaying completed mutations.

### Legacy migration

When loading old state:

```text
mode = pilot          → mode = auto
requested_mode=pilot  → mode = auto
effective_mode=pilot  → mode = auto
```

Remove the legacy fields after one successful write in the new schema. Historical event text may retain its original payload, but new UI labels and new sessions never expose Pilot as a mode.

## Interaction protocol

Human interaction is a host event, not an LLM tool.

Example:

```json
{
  "version": 1,
  "interaction_id": "interaction_...",
  "session_id": "pigent_...",
  "tool_call_id": "call_...",
  "kind": "pty_handoff",
  "summary": "Command is waiting for terminal input",
  "shell_session_id": "shell_...",
  "command_preview": "sudo apt-get install ...",
  "choices": ["open_shell", "cancel"]
}
```

Rules:

- interaction events never contain passwords, tokens, authorization headers, or terminal input bytes;
- user input is delivered directly to the PTY/browser flow;
- cancellation is bound to the exact process/tool call;
- headless clients receive a resumable `interaction_required` result rather than an application-level policy denial;
- optional review decisions are auditable but do not redefine Auto’s capability set.

## Delegate behavior

Suggested profiles:

| Product profile | Typical purpose | Mutation/execution |
| --- | --- | --- |
| `analysis` | inspect data/code and return a structured finding | No |
| `research` | gather and compare information | As explicitly configured |
| `review` | inspect implementation and run focused checks | Optional |
| `implementation` | edit, execute, test, and verify | Yes, full Auto tools |

Effective child tools are selected from:

```text
Coordinator mode
∩ chosen profile
∩ explicit delegated task
```

Auto does not add a hidden workspace/sandbox restriction to implementation children. Children still do not receive `delegate`, and only the Coordinator owns Tasks structure, to prevent uncontrolled orchestration recursion rather than to limit filesystem/process authority.

## Implementation layers

### 1. Prompt/tool-schema layer

- three mode descriptions;
- mode-specific tool and action schemas;
- behavior guidance only, not the OS security boundary.

### 2. Pigent runtime layer

- attach trusted session mode;
- reject actions unavailable in Ask/Plan;
- allow all valid Auto actions;
- translate interactive process state into product events.

### 3. Pipyter bridge layer

- authenticate the Pigent child process and session;
- resolve the runtime identity and operation target;
- apply revisions, idempotency, payload bounds, cancellation, and event correlation;
- do not replace OS authorization with a workspace confinement policy.

### 4. Runtime/OS layer

- actual filesystem, process, network, device, and privilege behavior;
- single-user runtime uses the login identity;
- multi-user runtime uses a per-user OS/container identity.

### 5. Browser layer

- show Ask/Plan/Auto exactly as in the design;
- display the active execution identity;
- stream tool/process activity;
- open the Shell for interactive handoff;
- support optional approval preferences without pretending that approval changes what the runtime user could do.

## Audit and observability

Record non-secret facts for operations:

- session/tool call IDs;
- selected mode;
- runtime user/node/workspace/cwd;
- normalized executable or structured action;
- outcome (`started`, `completed`, `failed`, `cancelled`, `interaction_required`);
- before/after revision for structured mutations;
- exit/error category;
- timestamps and duration.

Do not log credentials, raw terminal input, full environment values, provider headers, or unrestricted file contents by default.

## Verification matrix

Use disposable temporary users/containers/fixtures for commands that would otherwise affect the developer machine.

| Case | Ask | Plan | Auto |
| --- | --- | --- | --- |
| read workspace file | allow | allow | allow if OS permits |
| read absolute user-readable path | allow when explicitly requested | allow when explicitly requested | allow if OS permits |
| update workspace file | deny | deny | allow if OS permits |
| update path outside workspace | deny | deny | allow if OS permits |
| create Tasks | deny | allow | allow |
| run notebook cell | deny | deny | allow |
| inspect DataFrame | allow | allow | allow |
| ordinary Shell command | deny | deny | allow |
| network command | unavailable without a read-only adapter | unavailable without a read-only adapter | allow if OS/network permits |
| package manager/system command | deny | deny | allow if OS permits |
| command requiring a TTY | deny | deny | emit interaction/PTY handoff |
| implementation child edits/tests | unavailable | unavailable | allow |
| child asks to delegate | unavailable | unavailable | unavailable |

Also test:

- legacy `pilot` state maps to `auto`;
- fake mode fields in tool parameters do not change the trusted session mode;
- Auto can execute from a cwd outside the linked workspace;
- OS permission errors are returned unchanged as operation failures rather than relabeled policy denials;
- interactive input is absent from Agent events/logs;
- downgrade during queued work;
- reconnect with running Shell and pending interaction;
- cancellation terminates the owned process tree where supported.
