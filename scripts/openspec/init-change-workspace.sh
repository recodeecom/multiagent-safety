#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <change-slug> [capability-slug]"
  echo "Example: $0 add-dashboard-live-usage runtime-migration"
  exit 1
fi

CHANGE_SLUG="$1"
CAPABILITY_SLUG="${2:-$CHANGE_SLUG}"

if [[ "$CHANGE_SLUG" =~ [^a-z0-9-] ]]; then
  echo "Error: change slug must be kebab-case (lowercase letters, numbers, hyphens)."
  exit 1
fi

if [[ "$CAPABILITY_SLUG" =~ [^a-z0-9-] ]]; then
  echo "Error: capability slug must be kebab-case (lowercase letters, numbers, hyphens)."
  exit 1
fi

CHANGE_DIR="openspec/changes/${CHANGE_SLUG}"
SPEC_DIR="${CHANGE_DIR}/specs/${CAPABILITY_SLUG}"
TODAY="$(date -u +%Y-%m-%d)"

mkdir -p "$SPEC_DIR"

if [[ ! -f "${CHANGE_DIR}/.openspec.yaml" ]]; then
  cat > "${CHANGE_DIR}/.openspec.yaml" <<YAMLEOF
schema: spec-driven
created: ${TODAY}
YAMLEOF
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

## 4. Completion

- [ ] 4.1 Finish the agent branch via PR merge + cleanup (\`gx finish --via-pr --wait-for-merge --cleanup\` or \`bash scripts/agent-branch-finish.sh --branch <agent-branch> --base <base-branch> --via-pr --wait-for-merge --cleanup\`).
- [ ] 4.2 Record PR URL + final \`MERGED\` state in the completion handoff.
- [ ] 4.3 Confirm sandbox cleanup (\`git worktree list\`, \`git branch -a\`) or capture a \`BLOCKED:\` handoff if merge/cleanup is pending.
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

echo "[guardex] OpenSpec change workspace ready: ${CHANGE_DIR}"
echo "[guardex] OpenSpec change spec scaffold: ${SPEC_DIR}/spec.md"
