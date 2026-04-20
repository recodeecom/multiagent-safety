'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

type ModeKey = 'execute' | 'plan' | 'merge'

type MessageKind = 'user' | 'assistant' | 'thinking' | 'hint' | 'tool' | 'conflict'

type LineTone = 'normal' | 'comment' | 'added' | 'removed'

interface StepMessage {
  kind: MessageKind
  text: string
  label?: string
  lines?: string[]
}

interface WorktreeRow {
  name: string
  branch: string
  kind?: 'active' | 'readonly' | 'merge'
  files?: string[]
}

interface CodeLine {
  text: string
  tone?: LineTone
}

interface TutorialStep {
  stepLabel: string
  title: string
  description: string
  messages: StepMessage[]
  branch: string
  sourceNote: string
  worktrees: WorktreeRow[]
  codeTitle: string
  codeLines: CodeLine[]
}

interface ModeConfig {
  label: string
  dotClass: string
  steps: TutorialStep[]
}

const MODE_ORDER: ModeKey[] = ['execute', 'plan', 'merge']
const PRODUCT_LABEL = 'GuardeX'
const AGENT_LABEL = 'Codex'
const EDITOR_LABEL = 'guardex-agent-work-tree-managment — VS Code'

const TUTORIAL: Record<ModeKey, ModeConfig> = {
  execute: {
    label: 'Execute mode',
    dotClass: 'accent-execute',
    steps: [
      {
        stepLabel: 'Step 01',
        title: 'Prompt the agent',
        description:
          'Every session starts with a prompt. Pick your model, reasoning level, and access mode, then describe what needs to be built.',
        messages: [
          {
            kind: 'user',
            text: 'You: Port the dashboard usage slice from Python to Rust. Keep tests green.'
          },
          {
            kind: 'hint',
            text: 'gpt-5.4 · reasoning high · On-request'
          }
        ],
        branch: 'dev',
        sourceNote: 'Baseline branch. Waiting for agent activity.',
        worktrees: [],
        codeTitle: 'tutorial.ts',
        codeLines: [
          { text: '// Open Source Control to see each sandbox branch spin up.', tone: 'comment' },
          { text: '// Each step below updates this panel in real time.', tone: 'comment' },
          { text: 'const run = "execute"', tone: 'normal' }
        ]
      },
      {
        stepLabel: 'Step 02',
        title: 'Agent explores the repo',
        description:
          'Before writing code, the agent reads guidance, maps call sites, and checks current branch state in read-only mode.',
        messages: [
          {
            kind: 'assistant',
            text: "I'll load AGENTS + runtime docs and trace Python reader call paths before editing."
          },
          {
            kind: 'tool',
            text: '3 tool calls',
            label: 'context-gathering',
            lines: [
              'tool: state_list_active',
              'read: AGENTS.md',
              'read: app/modules/dashboard/service.py'
            ]
          }
        ],
        branch: 'dev',
        sourceNote: 'Read-only scan complete. Ready to isolate edits.',
        worktrees: [],
        codeTitle: 'analysis.log',
        codeLines: [
          { text: '[scan] dashboard reader entrypoints: 11', tone: 'normal' },
          { text: '[scan] rust crate baseline present', tone: 'normal' },
          { text: '[scan] writes blocked until sandbox branch', tone: 'comment' }
        ]
      },
      {
        stepLabel: 'Step 03',
        title: 'Sandbox worktree created',
        description:
          'Writes only happen inside a dedicated agent worktree. Your visible dev checkout stays clean and untouched.',
        messages: [
          {
            kind: 'thinking',
            text: 'Creating agent/codex/dashboard-rust-port-421 from dev for isolated writes.'
          },
          {
            kind: 'tool',
            text: '1 tool call',
            label: 'branch-start',
            lines: ['bash: scripts/agent-branch-start.sh "dashboard-rust-port"']
          }
        ],
        branch: 'agent/codex/dashboard-rust-port-421',
        sourceNote: 'New sandbox attached. Main branch still clean.',
        worktrees: [
          {
            name: 'agent_codex__dashboard-rust-port-421',
            branch: 'agent/codex/dashboard-rust-port-421',
            kind: 'active'
          }
        ],
        codeTitle: 'worktree.sh',
        codeLines: [
          { text: 'git worktree add .omx/agent-worktrees/... agent/codex/dashboard-rust-port-421', tone: 'normal' },
          { text: '# sandbox ready', tone: 'comment' },
          { text: 'echo "writes isolated"', tone: 'normal' }
        ]
      },
      {
        stepLabel: 'Step 04',
        title: 'Agent edits files in sandbox',
        description:
          'As files are written, changes appear under the sandbox worktree with explicit touched-file evidence.',
        messages: [
          {
            kind: 'assistant',
            text: 'Writing Rust reader + feature flag wiring in the agent branch only.'
          },
          {
            kind: 'tool',
            text: '3 tool calls',
            label: 'writing files',
            lines: [
              'write: crates/multica-dashboard/src/reader.rs',
              'write: crates/multica-dashboard/src/mod.rs',
              'write: apps/dashboard/src/feature-flags.ts'
            ]
          }
        ],
        branch: 'agent/codex/dashboard-rust-port-421',
        sourceNote: 'Live edits detected. 3 changed files in this sandbox.',
        worktrees: [
          {
            name: 'agent_codex__dashboard-rust-port-421',
            branch: 'agent/codex/dashboard-rust-port-421',
            kind: 'active',
            files: [
              'U crates/multica-dashboard/src/reader.rs',
              'M crates/multica-dashboard/src/mod.rs',
              'M apps/dashboard/src/feature-flags.ts'
            ]
          }
        ],
        codeTitle: 'reader.rs',
        codeLines: [
          { text: 'pub async fn read_usage_summary(state: &AppState, account_id: Uuid) -> Result<UsageSummary> {', tone: 'added' },
          { text: '  let row = sqlx::query_as!(UsageSummary, "SELECT * FROM usage_totals_fast WHERE account_id = $1", account_id)', tone: 'added' },
          { text: '    .fetch_one(&state.db).await?;', tone: 'added' },
          { text: '  Ok(row)', tone: 'added' },
          { text: '}', tone: 'added' }
        ]
      },
      {
        stepLabel: 'Step 05',
        title: 'Live diff streams into editor',
        description:
          'You can review in-progress changes as an inline diff before commit: adds in green, removals in red.',
        messages: [
          {
            kind: 'assistant',
            text: 'Streaming the latest diff now so you can validate behavior before commit.'
          }
        ],
        branch: 'agent/codex/dashboard-rust-port-421',
        sourceNote: 'Diff view active for the selected file.',
        worktrees: [
          {
            name: 'agent_codex__dashboard-rust-port-421',
            branch: 'agent/codex/dashboard-rust-port-421',
            kind: 'active',
            files: [
              'M crates/multica-dashboard/src/reader.rs',
              'M apps/dashboard/src/feature-flags.ts'
            ]
          }
        ],
        codeTitle: 'feature-flags.ts',
        codeLines: [
          { text: 'export const FLAGS = {', tone: 'normal' },
          { text: '  dashboard_reads_rust: { enabled: false, rollout: 0 },', tone: 'added' },
          { text: '  dashboard_reads_python: { enabled: true }', tone: 'removed' },
          { text: '}', tone: 'normal' }
        ]
      },
      {
        stepLabel: 'Step 06',
        title: 'Second worktree spins up',
        description:
          'Parallel prompts create separate worktrees, so independent fixes can run side by side without collision.',
        messages: [
          {
            kind: 'user',
            text: 'You: Also fix the hydration flash on the sidebar loader.'
          },
          {
            kind: 'assistant',
            text: 'Creating a second sandbox in parallel. Rust migration continues independently.'
          }
        ],
        branch: 'agent/codex/projects-hydration-fix',
        sourceNote: 'Parallel lane created safely in a separate branch.',
        worktrees: [
          {
            name: 'agent_codex__dashboard-rust-port-421',
            branch: 'agent/codex/dashboard-rust-port-421',
            kind: 'active',
            files: ['3 changes staged']
          },
          {
            name: 'agent_codex__projects-hydration-fix',
            branch: 'agent/codex/projects-hydration-fix',
            kind: 'active'
          }
        ],
        codeTitle: 'scripts/agent-branch-start.sh',
        codeLines: [
          { text: 'bash scripts/agent-branch-start.sh "projects-hydration-fix"', tone: 'normal' },
          { text: '# second worktree attached', tone: 'comment' },
          { text: 'echo "parallel lane ready"', tone: 'normal' }
        ]
      },
      {
        stepLabel: 'Step 07',
        title: 'Parallel file stream',
        description:
          'Each worktree tracks its own file set, so you can audit exactly what changed in each task lane.',
        messages: [
          {
            kind: 'tool',
            text: '2 tool calls',
            label: 'second lane writes',
            lines: [
              'write: apps/frontend/src/components/layout/loading-overlay.tsx',
              'write: apps/frontend/src/lib/navigation-loader.ts'
            ]
          }
        ],
        branch: 'agent/codex/projects-hydration-fix',
        sourceNote: 'Second lane now has 2 tracked changes.',
        worktrees: [
          {
            name: 'agent_codex__dashboard-rust-port-421',
            branch: 'agent/codex/dashboard-rust-port-421',
            kind: 'active',
            files: ['3 changes staged']
          },
          {
            name: 'agent_codex__projects-hydration-fix',
            branch: 'agent/codex/projects-hydration-fix',
            kind: 'active',
            files: [
              'U apps/frontend/src/components/layout/loading-overlay.tsx',
              'M apps/frontend/src/lib/navigation-loader.ts'
            ]
          }
        ],
        codeTitle: 'loading-overlay.tsx',
        codeLines: [
          { text: 'const shouldRender = !navigationSettled && !suppressLoaderFlash', tone: 'added' },
          { text: 'return shouldRender ? <OverlaySpinner /> : null', tone: 'added' },
          { text: 'setTimeout(() => setSuppressLoaderFlash(true), 140)', tone: 'added' }
        ]
      },
      {
        stepLabel: 'Step 08',
        title: 'Commit approval checkpoint',
        description:
          'With On-request access, the agent pauses before commit and waits for your explicit approval to finish.',
        messages: [
          {
            kind: 'assistant',
            text: 'Phase complete. Tests pass. Ready to commit agent/codex/dashboard-rust-port-421.'
          },
          {
            kind: 'hint',
            text: 'Approval required: Commit + PR + merge cleanup'
          }
        ],
        branch: 'agent/codex/dashboard-rust-port-421',
        sourceNote: 'Awaiting user approval before commit step.',
        worktrees: [
          {
            name: 'agent_codex__dashboard-rust-port-421',
            branch: 'agent/codex/dashboard-rust-port-421',
            kind: 'active',
            files: ['3 files ready for commit']
          }
        ],
        codeTitle: 'verification.log',
        codeLines: [
          { text: 'cargo test -p multica-dashboard  ✓', tone: 'normal' },
          { text: 'pnpm test --filter=dashboard   ✓', tone: 'normal' },
          { text: 'Waiting for commit approval...', tone: 'comment' }
        ]
      },
      {
        stepLabel: 'Step 09',
        title: 'PR merged and worktree cleaned',
        description:
          'After merge, the sandbox worktree is removed automatically and the repository returns to a clean base branch.',
        messages: [
          {
            kind: 'tool',
            text: '2 tool calls',
            label: 'finish pipeline',
            lines: [
              'bash: scripts/agent-branch-finish.sh --via-pr --wait-for-merge --cleanup',
              'tool: pr.merged → worktree.pruned'
            ]
          },
          {
            kind: 'assistant',
            text: 'PR merged. Sandbox cleaned. You are back on dev with zero leftover branch noise.'
          }
        ],
        branch: 'dev',
        sourceNote: 'Cleanup complete. No active agent worktrees remain.',
        worktrees: [],
        codeTitle: 'status',
        codeLines: [
          { text: 'git status', tone: 'normal' },
          { text: 'On branch dev', tone: 'normal' },
          { text: 'nothing to commit, working tree clean', tone: 'comment' }
        ]
      }
    ]
  },
  plan: {
    label: 'Plan mode',
    dotClass: 'accent-plan',
    steps: [
      {
        stepLabel: 'Step 01',
        title: 'Enable plan mode',
        description:
          'Plan mode keeps the agent read-only while it investigates and drafts a phased implementation plan.',
        messages: [
          { kind: 'hint', text: 'Plan mode ON · read-only tools only' },
          {
            kind: 'user',
            text: 'You: Explore the dashboard Rust migration and give me a safe execution plan first.'
          }
        ],
        branch: 'dev',
        sourceNote: 'Read-only plan session started.',
        worktrees: [
          {
            name: 'agent_plan__dashboard-rust-port',
            branch: 'agent/plan/dashboard-rust-port',
            kind: 'readonly'
          }
        ],
        codeTitle: '~/.claude/plans/draft.md',
        codeLines: [
          { text: '# Dashboard reads -> Rust migration', tone: 'comment' },
          { text: 'mode: plan (read-only)', tone: 'normal' },
          { text: 'status: collecting context', tone: 'normal' }
        ]
      },
      {
        stepLabel: 'Step 02',
        title: 'Explore and map dependencies',
        description:
          'The agent gathers dependencies, call sites, and risk points without performing writes.',
        messages: [
          { kind: 'assistant', text: 'Running deep read pass across Python reader, Rust crate, and all call sites.' },
          {
            kind: 'tool',
            text: '8 tool calls',
            label: 'read-only exploration',
            lines: [
              'read: AGENTS.md + skills',
              'read: apps/backend/dashboard/reader.py',
              'grep: read_usage_summary callers',
              'write: blocked (plan mode)'
            ]
          }
        ],
        branch: 'agent/plan/dashboard-rust-port',
        sourceNote: 'Exploration complete. No file writes permitted.',
        worktrees: [
          {
            name: 'agent_plan__dashboard-rust-port',
            branch: 'agent/plan/dashboard-rust-port',
            kind: 'readonly'
          }
        ],
        codeTitle: 'dependency-map.txt',
        codeLines: [
          { text: 'read_usage_summary -> 11 callers', tone: 'normal' },
          { text: 'usage_totals_fast -> 2 call sites + migration', tone: 'normal' },
          { text: 'writes blocked in plan mode', tone: 'comment' }
        ]
      },
      {
        stepLabel: 'Step 03',
        title: 'Draft phased plan',
        description:
          'A durable markdown plan is generated with phases, acceptance checks, risks, and rollback notes.',
        messages: [
          {
            kind: 'assistant',
            text: 'Plan saved with four phases: reader port, flag wiring, shadow-read validation, cutover.'
          }
        ],
        branch: 'agent/plan/dashboard-rust-port',
        sourceNote: 'Draft plan ready for review and edits.',
        worktrees: [
          {
            name: 'agent_plan__dashboard-rust-port',
            branch: 'agent/plan/dashboard-rust-port',
            kind: 'readonly'
          }
        ],
        codeTitle: '2026-04-19-dashboard-rust-port.md',
        codeLines: [
          { text: '## Phase 1 - Rust reader + types', tone: 'added' },
          { text: 'accept: cargo test -p multica-dashboard', tone: 'added' },
          { text: '## Phase 2 - feature flag wiring', tone: 'added' },
          { text: '## Phase 3 - parity shadow read', tone: 'added' }
        ]
      },
      {
        stepLabel: 'Step 04',
        title: 'Edit plan inline',
        description:
          'You can revise scope before execution, for example deferring risky deletion phases.',
        messages: [
          {
            kind: 'user',
            text: 'You: Keep Python fallback for now. Add a 100-concurrent-read acceptance check.'
          },
          {
            kind: 'assistant',
            text: 'Applied. Phase 4 marked deferred and load-test acceptance added to phase 3.'
          }
        ],
        branch: 'agent/plan/dashboard-rust-port',
        sourceNote: 'Plan revision stored as the new source of truth.',
        worktrees: [
          {
            name: 'agent_plan__dashboard-rust-port',
            branch: 'agent/plan/dashboard-rust-port',
            kind: 'readonly'
          }
        ],
        codeTitle: 'plan-revision.diff',
        codeLines: [
          { text: '- Phase 4: Cutover + delete Python', tone: 'removed' },
          { text: '+ Phase 4: deferred until parity confidence', tone: 'added' },
          { text: '+ accept: p99 < 80ms under 100 concurrent reads', tone: 'added' }
        ]
      },
      {
        stepLabel: 'Step 05',
        title: 'Approve and escalate',
        description:
          'After review, plan mode exits and execution begins from the approved phases with controlled access.',
        messages: [
          { kind: 'assistant', text: 'Plan approved. Escalating to On-request and starting phase 1 writes.' },
          {
            kind: 'tool',
            text: '3 tool calls',
            label: 'phase-1 start',
            lines: [
              'bash: scripts/agent-branch-start.sh "dashboard-rust-port" --from-plan',
              'read: approved plan markdown',
              'write: crates/multica-dashboard/src/reader.rs'
            ]
          }
        ],
        branch: 'agent/codex/dashboard-rust-port-421',
        sourceNote: 'Execution started from approved plan phases.',
        worktrees: [
          {
            name: 'agent_codex__dashboard-rust-port-421',
            branch: 'agent/codex/dashboard-rust-port-421',
            kind: 'active',
            files: ['U crates/multica-dashboard/src/reader.rs']
          }
        ],
        codeTitle: 'approved-phases.md',
        codeLines: [
          { text: '[✓] Phase 1 approved', tone: 'added' },
          { text: '[✓] Phase 2 approved', tone: 'added' },
          { text: '[✓] Phase 3 approved', tone: 'added' },
          { text: '[ ] Phase 4 deferred', tone: 'comment' }
        ]
      },
      {
        stepLabel: 'Step 06',
        title: 'Re-enter plan for drift',
        description:
          'If upstream changed during execution, you can return to plan mode and produce a revised v2 plan.',
        messages: [
          {
            kind: 'hint',
            text: 'Plan mode ON again · drafting v2 for remaining phases'
          },
          {
            kind: 'assistant',
            text: 'Detected flag-shape drift in main. Preparing revised plan v2 for remaining work.'
          }
        ],
        branch: 'agent/plan/dashboard-rust-port-v2',
        sourceNote: 'Revision cycle active to avoid executing stale assumptions.',
        worktrees: [
          {
            name: 'agent_plan__dashboard-rust-port-v2',
            branch: 'agent/plan/dashboard-rust-port-v2',
            kind: 'readonly'
          }
        ],
        codeTitle: 'dashboard-rust-port.v2.md',
        codeLines: [
          { text: '## Phase 2\' - rewire flag to new shape', tone: 'added' },
          { text: 'Update 4 call sites introduced in main', tone: 'added' },
          { text: 'Phase 3 retained from v1', tone: 'normal' }
        ]
      }
    ]
  },
  merge: {
    label: 'Merge mode',
    dotClass: 'accent-merge',
    steps: [
      {
        stepLabel: 'Step 01',
        title: 'Two PRs ready',
        description:
          'Two independent agent branches have passing PRs and are ready for merge.',
        messages: [
          { kind: 'assistant', text: 'PR #421 and PR #438 are open with green checks.' }
        ],
        branch: 'dev',
        sourceNote: 'Both branches queued for merge.',
        worktrees: [
          {
            name: 'agent_codex__dashboard-rust-port-421',
            branch: 'agent/codex/dashboard-rust-port-421',
            kind: 'active',
            files: ['2 changed files']
          },
          {
            name: 'agent_codex__flags-cleanup-438',
            branch: 'agent/codex/flags-cleanup-438',
            kind: 'active',
            files: ['2 changed files']
          }
        ],
        codeTitle: 'merge-queue',
        codeLines: [
          { text: 'PR #421  status: ready', tone: 'normal' },
          { text: 'PR #438  status: ready', tone: 'normal' }
        ]
      },
      {
        stepLabel: 'Step 02',
        title: 'Conflict detected',
        description:
          'Both PRs touched the same flag file, so merge is blocked until a conflict resolution is produced.',
        messages: [
          {
            kind: 'conflict',
            text: 'Merge conflict: apps/dashboard/src/feature-flags.ts modified by both PR #421 and PR #438.'
          }
        ],
        branch: 'dev',
        sourceNote: 'Merge blocked by overlapping hunk edits.',
        worktrees: [
          {
            name: 'agent_codex__dashboard-rust-port-421',
            branch: 'agent/codex/dashboard-rust-port-421',
            kind: 'active',
            files: ['! apps/dashboard/src/feature-flags.ts']
          },
          {
            name: 'agent_codex__flags-cleanup-438',
            branch: 'agent/codex/flags-cleanup-438',
            kind: 'active',
            files: ['! apps/dashboard/src/feature-flags.ts']
          }
        ],
        codeTitle: 'feature-flags.ts (conflict)',
        codeLines: [
          { text: '<<<<<<< PR-421', tone: 'removed' },
          { text: 'dashboard_reads_rust: { enabled: false, rollout: 0 }', tone: 'removed' },
          { text: '=======', tone: 'normal' },
          { text: 'projects_v2_layout: flag({ rollout: 25 })', tone: 'added' },
          { text: '>>>>>>> PR-438', tone: 'added' }
        ]
      },
      {
        stepLabel: 'Step 03',
        title: 'Merge agent spawned',
        description:
          'A dedicated merge worktree is created from the target branch to reconcile both PR heads safely.',
        messages: [
          {
            kind: 'thinking',
            text: 'Spawning agent/merge/pr-421-vs-438 and cherry-picking both heads for semantic resolution.'
          }
        ],
        branch: 'agent/merge/pr-421-vs-438',
        sourceNote: 'Merge sandbox active. Normal branches untouched.',
        worktrees: [
          {
            name: 'agent_merge__pr-421-vs-438',
            branch: 'agent/merge/pr-421-vs-438',
            kind: 'merge'
          }
        ],
        codeTitle: 'merge-agent.sh',
        codeLines: [
          { text: 'bash scripts/merge-agent-start.sh --a 421 --b 438', tone: 'normal' },
          { text: 'git cherry-pick origin/pr-421 origin/pr-438', tone: 'normal' }
        ]
      },
      {
        stepLabel: 'Step 04',
        title: 'Intent-aware conflict analysis',
        description:
          'The merge agent reads both PR intents and surrounding code to preserve behavior from both sides.',
        messages: [
          {
            kind: 'tool',
            text: '5 tool calls',
            label: 'intent analysis',
            lines: [
              'read: PR #421 description + diff',
              'read: PR #438 description + diff',
              'tool: resolve_semantic --preserve-both'
            ]
          }
        ],
        branch: 'agent/merge/pr-421-vs-438',
        sourceNote: 'Preparing semantic merge result.',
        worktrees: [
          {
            name: 'agent_merge__pr-421-vs-438',
            branch: 'agent/merge/pr-421-vs-438',
            kind: 'merge',
            files: ['M apps/dashboard/src/feature-flags.ts']
          }
        ],
        codeTitle: 'resolution-plan.md',
        codeLines: [
          { text: 'Preserve PR #438 shape refactor', tone: 'normal' },
          { text: 'Re-add PR #421 dashboard_reads_rust flag in new shape', tone: 'added' }
        ]
      },
      {
        stepLabel: 'Step 05',
        title: 'Resolution + test run',
        description:
          'The merged file is written and test suite is re-run before presenting the result for review.',
        messages: [
          {
            kind: 'assistant',
            text: 'Conflict resolved with both feature intents preserved. Running dashboard tests now.'
          },
          {
            kind: 'tool',
            text: '2 tool calls',
            label: 'resolve + verify',
            lines: [
              'write: apps/dashboard/src/feature-flags.ts',
              'bash: pnpm test --filter=dashboard'
            ]
          }
        ],
        branch: 'agent/merge/pr-421-vs-438',
        sourceNote: 'Resolution ready for approval.',
        worktrees: [
          {
            name: 'agent_merge__pr-421-vs-438',
            branch: 'agent/merge/pr-421-vs-438',
            kind: 'merge',
            files: ['M apps/dashboard/src/feature-flags.ts', '✓ tests green']
          }
        ],
        codeTitle: 'feature-flags.ts (resolved)',
        codeLines: [
          { text: 'export const FLAGS = {', tone: 'normal' },
          { text: '  dashboard_reads_rust: flag({ rollout: 0 }),', tone: 'added' },
          { text: '  projects_v2_layout: flag({ rollout: 25 }),', tone: 'added' },
          { text: '}', tone: 'normal' }
        ]
      },
      {
        stepLabel: 'Step 06',
        title: 'Merged and dissolved',
        description:
          'After approval, both PRs merge and the merge worktree is cleaned, returning the repo to a clean baseline.',
        messages: [
          {
            kind: 'assistant',
            text: 'Approved. Both PRs merged and merge sandbox removed. Repository is clean on dev again.'
          }
        ],
        branch: 'dev',
        sourceNote: 'Merge cycle complete. No active merge worktree.',
        worktrees: [],
        codeTitle: 'merge-summary',
        codeLines: [
          { text: 'PR #421 merged', tone: 'normal' },
          { text: 'PR #438 merged', tone: 'normal' },
          { text: 'agent/merge/pr-421-vs-438 pruned', tone: 'comment' }
        ]
      }
    ]
  }
}

type ActivityIcon =
  | 'files'
  | 'search'
  | 'git'
  | 'debug'
  | 'extensions'
  | 'account'
  | 'settings'
  | 'plus'
  | 'refresh'
  | 'more'
  | 'branch'

function ActivityGlyph({ icon, className }: { icon: ActivityIcon; className?: string }) {
  let content: ReactNode = null

  switch (icon) {
    case 'files':
      content = (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </>
      )
      break
    case 'search':
      content = (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </>
      )
      break
    case 'git':
      content = (
        <>
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="6" r="3" />
          <circle cx="12" cy="18" r="3" />
          <path d="M6 9v6a3 3 0 0 0 3 3h6" />
          <path d="M18 9a9 9 0 0 1-3 6" />
        </>
      )
      break
    case 'debug':
      content = (
        <>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" />
          <circle cx="12" cy="12" r="6" />
        </>
      )
      break
    case 'extensions':
      content = (
        <>
          <rect x="3" y="3" width="8" height="8" />
          <rect x="13" y="3" width="8" height="8" />
          <rect x="3" y="13" width="8" height="8" />
          <rect x="13" y="13" width="8" height="8" />
        </>
      )
      break
    case 'account':
      content = (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      )
      break
    case 'settings':
      content = (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6M12 17v6M4.2 4.2l4.2 4.2M15.6 15.6l4.2 4.2M1 12h6M17 12h6M4.2 19.8l4.2-4.2M15.6 8.4l4.2-4.2" />
        </>
      )
      break
    case 'plus':
      content = <path d="M12 5v14M5 12h14" />
      break
    case 'refresh':
      content = (
        <>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
        </>
      )
      break
    case 'more':
      content = (
        <>
          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" />
        </>
      )
      break
    case 'branch':
      content = (
        <>
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </>
      )
      break
    default:
      content = null
  }

  return (
    <svg
      aria-hidden="true"
      className={className ?? 'rail-glyph'}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
    >
      {content}
    </svg>
  )
}

export default function Home() {
  const [mode, setMode] = useState<ModeKey>('execute')
  const [stepIndex, setStepIndex] = useState(0)
  const [animationSeed, setAnimationSeed] = useState(0)

  const modeData = TUTORIAL[mode]
  const steps = modeData.steps
  const activeStep = steps[stepIndex]

  const changeCount = useMemo(() => {
    return activeStep.worktrees.reduce((total, worktree) => {
      return total + (worktree.files?.length ?? 0)
    }, 0)
  }, [activeStep])

  const switchMode = (nextMode: ModeKey) => {
    if (nextMode === mode) {
      return
    }

    setMode(nextMode)
    setStepIndex(0)
    setAnimationSeed((seed) => seed + 1)
  }

  const goToStep = useCallback((nextStep: number) => {
    if (nextStep < 0 || nextStep > steps.length - 1) {
      return
    }

    setStepIndex(nextStep)
    setAnimationSeed((seed) => seed + 1)
  }, [steps.length])

  const goBack = useCallback(() => {
    if (stepIndex === 0) {
      return
    }

    goToStep(stepIndex - 1)
  }, [goToStep, stepIndex])

  const reset = useCallback(() => {
    setStepIndex(0)
    setAnimationSeed((seed) => seed + 1)
  }, [])

  const goNext = useCallback(() => {
    if (stepIndex === steps.length - 1) {
      reset()
      return
    }

    goToStep(stepIndex + 1)
  }, [goToStep, reset, stepIndex, steps.length])

  const closeWalkthrough = useCallback(() => {
    setMode('execute')
    setStepIndex(0)
    setAnimationSeed((seed) => seed + 1)
  }, [])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNext()
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goBack()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closeWalkthrough()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [closeWalkthrough, goBack, goNext])

  return (
    <main className="how-it-works-page">
      <header className="top-nav">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            C
          </div>
          <div>
            <p className="brand-title">How it works</p>
            <p className="brand-subtitle">
              Same Codex workflow design and logic inside GuardeX
            </p>
            <div className="brand-meta">
              <span className="brand-chip">{PRODUCT_LABEL}</span>
              <span className="brand-chip secondary">{AGENT_LABEL} flow</span>
            </div>
          </div>
        </div>

        <nav className="mode-switches" aria-label="Workflow modes">
          {MODE_ORDER.map((modeKey) => {
            const item = TUTORIAL[modeKey]
            const isActive = modeKey === mode

            return (
              <button
                className={`mode-pill ${item.dotClass} ${isActive ? 'active' : ''}`}
                key={modeKey}
                onClick={() => switchMode(modeKey)}
                type="button"
              >
                <span className="mode-dot" aria-hidden />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="top-meta">
          <span className="page-counter">
            {stepIndex + 1} / {steps.length}
          </span>
          <button
            aria-label="Close walkthrough"
            className="icon-button"
            onClick={closeWalkthrough}
            type="button"
          >
            ×
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="How it works workspace preview">
        <article className="chat-panel">
          <span className="panel-tag">CHAT • CODEX</span>

          <div
            className="chat-thread"
            key={`chat-${mode}-${stepIndex}-${animationSeed}`}
          >
            {activeStep.messages.map((message, index) => (
              <div
                className={`chat-message ${message.kind}`}
                key={`${message.kind}-${message.text}`}
                style={{ animationDelay: `${index * 130}ms` }}
              >
                {message.kind === 'tool' ? (
                  <div className="tool-block">
                    <p className="tool-title">{message.text}</p>
                    {message.label ? (
                      <p className="tool-subtitle">{message.label}</p>
                    ) : null}
                    <div className="tool-rows">
                      {(message.lines ?? []).map((line) => (
                        <p className="tool-row" key={line}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className={`chat-bubble ${message.kind}`}>{message.text}</p>
                )}
              </div>
            ))}
          </div>

          <div className="dot-track" aria-label="Steps">
            {steps.map((step, index) => (
              <button
                aria-label={`Jump to ${step.stepLabel}`}
                className={`dot ${index === stepIndex ? 'active' : ''} ${
                  index < stepIndex ? 'done' : ''
                }`}
                key={step.stepLabel}
                onClick={() => goToStep(index)}
                type="button"
              />
            ))}
          </div>
        </article>

        <article className="editor-shell">
          <div className="editor-topbar">
            <span className="editor-project">{EDITOR_LABEL}</span>
          </div>
          <div className="editor-body">
            <aside className="activity-rail" aria-label="Activity rail">
              <button aria-label="Explorer" className="rail-action" type="button">
                <ActivityGlyph icon="files" />
              </button>
              <button aria-label="Search" className="rail-action" type="button">
                <ActivityGlyph icon="search" />
              </button>
              <button aria-label="Source Control" className="rail-action active" type="button">
                <ActivityGlyph icon="git" />
                <span className={`rail-badge ${changeCount > 0 ? 'live' : ''}`}>{changeCount}</span>
              </button>
              <button aria-label="Run and Debug" className="rail-action" type="button">
                <ActivityGlyph icon="debug" />
              </button>
              <button aria-label="Extensions" className="rail-action" type="button">
                <ActivityGlyph icon="extensions" />
              </button>
              <span className="rail-spacer" />
              <button aria-label="Account" className="rail-action" type="button">
                <ActivityGlyph icon="account" />
              </button>
              <button aria-label="Settings" className="rail-action" type="button">
                <ActivityGlyph icon="settings" />
              </button>
            </aside>

            <section className="source-panel">
              <div className="source-header-row">
                <p className="source-title">Source Control</p>
                <div className="source-actions">
                  <button aria-label="Create branch" className="source-action-btn" type="button">
                    <ActivityGlyph icon="plus" className="source-action-glyph" />
                  </button>
                  <button aria-label="Refresh" className="source-action-btn" type="button">
                    <ActivityGlyph icon="refresh" className="source-action-glyph" />
                  </button>
                  <button aria-label="More" className="source-action-btn" type="button">
                    <ActivityGlyph icon="more" className="source-action-glyph" />
                  </button>
                </div>
              </div>
              <p className="source-branch">{activeStep.branch}</p>
              <p className="source-note">{activeStep.sourceNote}</p>

              <div
                className="worktree-list"
                key={`worktrees-${mode}-${stepIndex}-${animationSeed}`}
              >
                <div className="worktree-item base active">
                  <div className="worktree-head">
                    <ActivityGlyph icon="branch" className="worktree-branch-icon" />
                    <p className="worktree-name">dev</p>
                    <p className="worktree-tag">base · clean</p>
                  </div>
                  <p className="worktree-message">Baseline branch — no agent activity.</p>
                </div>

                {activeStep.worktrees.map((worktree, index) => (
                  <div
                    className={`worktree-item active just-added ${worktree.kind ?? 'active'}`}
                    key={`${worktree.branch}-${index}`}
                    style={{ animationDelay: `${index * 110}ms` }}
                  >
                    <div className="worktree-head">
                      <ActivityGlyph icon="branch" className="worktree-branch-icon" />
                      <p className="worktree-name">{worktree.name}</p>
                    </div>
                    <p className="worktree-branch">{worktree.branch}</p>
                    {worktree.files && worktree.files.length > 0 ? (
                      <div className="worktree-files">
                        <p className="worktree-files-head">
                          Changes
                          <span className="worktree-count">{worktree.files.length}</span>
                        </p>
                        {worktree.files.map((file) => {
                          const match = file.match(/^([A-Z✓])\s+(.*)$/)
                          const status = match?.[1] ?? '•'
                          const label = match?.[2] ?? file
                          const statusTone =
                            status === 'M'
                              ? 'modified'
                              : status === 'U'
                                ? 'added'
                                : status === 'D'
                                  ? 'removed'
                                  : status === '✓'
                                    ? 'ok'
                                    : 'neutral'

                          return (
                            <p className="worktree-file-row" key={file}>
                              <span className={`file-status ${statusTone}`}>{status}</span>
                              <span className="file-label">{label}</span>
                            </p>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="code-panel">
              <p className="code-title">{activeStep.codeTitle}</p>
              <div
                className="code-lines"
                key={`code-${mode}-${stepIndex}-${animationSeed}`}
              >
                {activeStep.codeLines.map((line, index) => (
                  <p
                    className={`code-line ${line.tone ?? 'normal'}`}
                    key={`${line.text}-${index}`}
                    style={{ animationDelay: `${index * 45}ms` }}
                  >
                    <span className="line-number">{index + 1}</span>
                    <span>{line.text}</span>
                  </p>
                ))}
              </div>
            </section>
          </div>
        </article>
      </section>

      <footer className="stepbar">
        <div className="step-description">
          <p className="step-id">{activeStep.stepLabel}</p>
          <p className="step-title">{activeStep.title}</p>
          <p className="step-copy">{activeStep.description}</p>
        </div>

        <div className="step-actions">
          <button
            className="ghost-btn"
            disabled={stepIndex === 0}
            onClick={goBack}
            type="button"
          >
            ← Back
          </button>
          <button className="ghost-btn" onClick={reset} type="button">
            Reset
          </button>
          <button className="cta-btn" onClick={goNext} type="button">
            {stepIndex === steps.length - 1 ? 'Restart demo ↺' : 'Next step →'}
          </button>
        </div>
      </footer>
    </main>
  )
}
