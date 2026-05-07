# Open Questions — submodule-aware gitguardex

Unresolved tradeoffs and branching decisions that should survive
chat. Resolve in-place when answered (turn `[ ]` into `[x]` and
add the resolution).

- [ ] **Wait-for-merge cost ceiling**: at 5 submodules × full-pr
       cycle, total merge wait can exceed
       `GUARDEX_FINISH_MERGE_TIMEOUT` (default 1800s).
       Options: (a) increase timeout, (b) parallelize the poller
       and treat merge as eventually-consistent, (c) fall back
       to `commit-only` mode automatically when N >= 3 dirty
       submodules. Recommend (b).

- [ ] **Cross-org token strategy**: submodules span `NagyVikt/*`
       and `recodeee/*`. Use a single PAT scoped to both, or
       per-org GitHub Apps installed via `gh auth`? PAT is
       simpler; App is auditable. Recommend PAT for v1, App for
       v2.

- [ ] **Per-submodule openspec gate-skip — exact rule**: skip
       when (a) submodule has no `openspec/` dir, (b) submodule
       has `openspec/` but no `changes/` for the current slug,
       or (c) operator opt-out via marker file. The proposal
       uses (a); confirm.

- [ ] **`commit-only` PR-base mismatch**: in `commit-only` mode
       the parent's gitlink targets a topic branch HEAD, not the
       upstream protected branch. If the submodule's protected
       branch later diverges, the parent points at orphaned
       history. Mitigation: emit a warning and write the
       `child_branch` field into `submodules.json` so a future
       `gx submodules promote` can roll the topic into a real
       PR. Confirm this is acceptable.

- [ ] **Worktree-vs-clone for submodules**: `git submodule update
       --init` clones into the parent's `.git/modules/<name>`
       but the working tree under the submodule path is shared
       with the primary checkout. With multiple agent worktrees
       running in parallel, two agents editing the same
       submodule path race. Options: (a) one agent at a time per
       submodule (lock at the submodule level), (b) per-worktree
       submodule clones (heavier disk). Recommend (a) — the
       lock claim already enforces this.

- [ ] **Trojan-detection on auto-init**: auto-running `git
       submodule update --init` on `branch start` will fetch and
       check out arbitrary code into the worktree. If a
       submodule URL is hijacked or a malicious commit is
       pushed to its protected branch, that code now sits on
       disk and can run via post-checkout hooks. Mitigation:
       (a) verify submodule remote URL against an allowlist in
       `.gx/config.json`, (b) record submodule HEAD SHAs at
       branch start and warn on diff at finish, (c) rely on
       repo-level branch protection on the submodule. Pick.

- [ ] **Failed init recovery**: if `git submodule update --init`
       fails partway (network, auth, missing remote), the
       worktree is half-populated. Should `branch start` roll
       back the worktree, or surface a partial-init manifest?
       Default: surface partial-init; finish refuses if any
       submodule entry is `state: "init-failed"`.

- [ ] **Helper sub-branch interaction**: AGENTS.md says helper
       sub-branches do not create OpenSpec artifacts. Does that
       extend to per-submodule child branches? Treat
       `agent/<owner>/<slug>` inside a submodule as a helper —
       no nested OpenSpec required.
