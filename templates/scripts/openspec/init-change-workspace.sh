#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 3 ]]; then
  echo "Usage: $0 <change-slug> [capability-slug] [agent-branch]"
  echo "Example: $0 add-dashboard-live-usage runtime-migration agent/claude-odin/add-dashboard-live-usage-123456"
  exit 1
fi

CHANGE_SLUG="$1"
CAPABILITY_SLUG="${2:-$CHANGE_SLUG}"
AGENT_BRANCH="${3:-agent/<your-name>/<branch-slug>}"

if [[ "$CHANGE_SLUG" =~ [^a-z0-9-] ]]; then
  echo "Error: change slug must be kebab-case (lowercase letters, numbers, hyphens)."
  exit 1
fi

if [[ "$CAPABILITY_SLUG" =~ [^a-z0-9-] ]]; then
  echo "Error: capability slug must be kebab-case (lowercase letters, numbers, hyphens)."
  exit 1
fi

resolve_base_branch() {
  local branch="$1"
  local base_branch=""

  if [[ -n "$branch" ]] && [[ "$branch" != "agent/<your-name>/<branch-slug>" ]]; then
    base_branch="$(git config --get "branch.${branch}.guardexBase" || true)"
  fi
  if [[ -z "$base_branch" ]]; then
    base_branch="$(git config --get multiagent.baseBranch || true)"
  fi
  if [[ -z "$base_branch" ]]; then
    base_branch="dev"
  fi

  printf '%s' "$base_branch"
}

CHANGE_DIR="openspec/changes/${CHANGE_SLUG}"
SPEC_DIR="${CHANGE_DIR}/specs/${CAPABILITY_SLUG}"
TODAY="$(date -u +%Y-%m-%d)"
BASE_BRANCH="$(resolve_base_branch "$AGENT_BRANCH")"

MINIMAL_RAW="${GUARDEX_OPENSPEC_MINIMAL:-0}"
case "$(printf '%s' "$MINIMAL_RAW" | tr '[:upper:]' '[:lower:]')" in
  1|true|yes|on) MINIMAL=1 ;;
  *) MINIMAL=0 ;;
esac

if [[ "$MINIMAL" -eq 1 ]]; then
  mkdir -p "$CHANGE_DIR"
else
  mkdir -p "$SPEC_DIR"
fi

if [[ ! -f "${CHANGE_DIR}/.openspec.yaml" ]]; then
  cat > "${CHANGE_DIR}/.openspec.yaml" <<YAMLEOF
schema: spec-driven
created: ${TODAY}
YAMLEOF
fi

if [[ "$MINIMAL" -eq 1 ]]; then
  if [[ ! -f "${CHANGE_DIR}/notes.md" ]]; then
    cat > "${CHANGE_DIR}/notes.md" <<NOTESEOF
# ${CHANGE_SLUG} (minimal / T1)

Branch: \`${AGENT_BRANCH}\`

Describe the change in a sentence or two. Commit message is the spec of record.

## Handoff

- Handoff: change=\`${CHANGE_SLUG}\`; branch=\`${AGENT_BRANCH}\`; scope=\`TODO\`; action=\`continue this sandbox or finish cleanup after a usage-limit/manual takeover\`.
- Copy prompt: Continue \`${CHANGE_SLUG}\` on branch \`${AGENT_BRANCH}\`. Work inside the existing sandbox, review \`openspec/changes/${CHANGE_SLUG}/notes.md\`, continue from the current state instead of creating a new sandbox, and when the work is done run \`bash scripts/agent-branch-finish.sh --branch "${AGENT_BRANCH}" --base ${BASE_BRANCH} --via-pr --wait-for-merge --cleanup\`.

## Cleanup

- [ ] Run: \`bash scripts/agent-branch-finish.sh --branch "${AGENT_BRANCH}" --base ${BASE_BRANCH} --via-pr --wait-for-merge --cleanup\`
- [ ] Record PR URL + \`MERGED\` state in the completion handoff.
- [ ] Confirm sandbox worktree is gone (\`git worktree list\`, \`git branch -a\`).
NOTESEOF
  fi
  echo "[gitguardex] OpenSpec change workspace (minimal) ready: ${CHANGE_DIR}"
  echo "[gitguardex] Notes-only scaffold: ${CHANGE_DIR}/notes.md"
  exit 0
fi

if [[ ! -f "${CHANGE_DIR}/proposal.md" ]]; then
  cat > "${CHANGE_DIR}/proposal.md" <<PROPOSALEOF
## Why

- TODO: describe the user/problem outcome this change addresses.

## What Changes

- TODO: summarize the intended behavior and scope.

## Impact

- TODO: call out risks, rollout notes, and affected surfaces.
PROPOSALEOF
fi

if [[ ! -f "${CHANGE_DIR}/tasks.md" ]]; then
  cat > "${CHANGE_DIR}/tasks.md" <<TASKSEOF
## Definition of Done

This change is complete only when **all** of the following are true:

- Every checkbox below is checked.
- The agent branch reaches \`MERGED\` state on \`origin\` and the PR URL + state are recorded in the completion handoff.
- If any step blocks (test failure, conflict, ambiguous result), append a \`BLOCKED:\` line under section 4 explaining the blocker and **STOP**. Do not tick remaining cleanup boxes; do not silently skip the cleanup pipeline.

## Handoff

- Handoff: change=\`${CHANGE_SLUG}\`; branch=\`${AGENT_BRANCH}\`; scope=\`TODO\`; action=\`continue this sandbox or finish cleanup after a usage-limit/manual takeover\`.
- Copy prompt: Continue \`${CHANGE_SLUG}\` on branch \`${AGENT_BRANCH}\`. Work inside the existing sandbox, review \`openspec/changes/${CHANGE_SLUG}/tasks.md\`, continue from the current state instead of creating a new sandbox, and when the work is done run \`bash scripts/agent-branch-finish.sh --branch "${AGENT_BRANCH}" --base ${BASE_BRANCH} --via-pr --wait-for-merge --cleanup\`.

## 1. Specification

- [ ] 1.1 Finalize proposal scope and acceptance criteria for \`${CHANGE_SLUG}\`.
- [ ] 1.2 Define normative requirements in \`specs/${CAPABILITY_SLUG}/spec.md\`.

## 2. Implementation

- [ ] 2.1 Implement scoped behavior changes.
- [ ] 2.2 Add/update focused regression coverage.

## 3. Verification

- [ ] 3.1 Run targeted project verification commands.
- [ ] 3.2 Run \`openspec validate ${CHANGE_SLUG} --type change --strict\`.
- [ ] 3.3 Run \`openspec validate --specs\`.

## 4. Cleanup (mandatory; run before claiming completion)

- [ ] 4.1 Run the cleanup pipeline: \`bash scripts/agent-branch-finish.sh --branch "${AGENT_BRANCH}" --base ${BASE_BRANCH} --via-pr --wait-for-merge --cleanup\`. This handles commit -> push -> PR create -> merge wait -> worktree prune in one invocation.
- [ ] 4.2 Record the PR URL and final merge state (\`MERGED\`) in the completion handoff.
- [ ] 4.3 Confirm the sandbox worktree is gone (\`git worktree list\` no longer shows the agent path; \`git branch -a\` shows no surviving local/remote refs for the branch).
TASKSEOF
fi

if [[ ! -f "${SPEC_DIR}/spec.md" ]]; then
  cat > "${SPEC_DIR}/spec.md" <<SPECEOF
## ADDED Requirements

### Requirement: ${CAPABILITY_SLUG} behavior
The system SHALL enforce ${CAPABILITY_SLUG} behavior as defined by this change.

#### Scenario: Baseline acceptance
- **WHEN** ${CAPABILITY_SLUG} behavior is exercised
- **THEN** the expected outcome is produced
- **AND** regressions are covered by tests.
SPECEOF
fi

echo "[gitguardex] OpenSpec change workspace ready: ${CHANGE_DIR}"
echo "[gitguardex] OpenSpec change spec scaffold: ${SPEC_DIR}/spec.md"
