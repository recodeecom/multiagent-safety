#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <plan-slug> [role ...]"
  echo "Example: $0 stabilize-dashboard planner architect critic executor writer verifier"
  exit 1
fi

PLAN_SLUG="$1"
shift || true

if [[ "$PLAN_SLUG" =~ [^a-z0-9-] ]]; then
  echo "Error: plan slug must be kebab-case (lowercase letters, numbers, hyphens)." >&2
  exit 1
fi

if [[ $# -gt 0 ]]; then
  ROLES=("$@")
else
  ROLES=(planner architect critic executor writer verifier)
fi

PLAN_DIR="openspec/plan/${PLAN_SLUG}"
mkdir -p "$PLAN_DIR"

write_if_missing() {
  local file="$1"
  shift
  if [[ ! -f "$file" ]]; then
    mkdir -p "$(dirname "$file")"
    cat > "$file" <<EOF
$*
EOF
  fi
}

write_if_missing "$PLAN_DIR/summary.md" "# Plan Summary: ${PLAN_SLUG}

- **Mode:** ralplan
- **Status:** draft

## Context

Describe the problem, constraints, and intended outcomes.
"

write_if_missing "$PLAN_DIR/checkpoints.md" "# Plan Checkpoints: ${PLAN_SLUG}

Chronological checkpoint log for all roles.
"

write_if_missing "$PLAN_DIR/README.md" "# Plan Workspace: ${PLAN_SLUG}

Durable pre-implementation planning workspace.

Use this command to update checkpoints:

\`\`\`bash
/opsx:checkpoint ${PLAN_SLUG} <role> <checkpoint-id> <state> <note...>
\`\`\`
"

write_if_missing "$PLAN_DIR/planner/plan.md" "# ExecPlan: ${PLAN_SLUG}

This document is a living plan. Keep progress and decisions current.

## Purpose / Big Picture

## Progress

- [ ] Initial draft
- [ ] Review + iterate
- [ ] Approved for execution

## Surprises & Discoveries

## Decision Log

## Outcomes & Retrospective

## Validation and Acceptance
"

for role in "${ROLES[@]}"; do
  ROLE_DIR="$PLAN_DIR/$role"
  mkdir -p "$ROLE_DIR"

  write_if_missing "$ROLE_DIR/README.md" "# ${role}

Role workspace for \`${role}\`.
"

  write_if_missing "$ROLE_DIR/tasks.md" "# ${role} tasks

## 1. Spec

- [ ] Define requirements and scope for ${role}
- [ ] Confirm acceptance criteria are explicit and testable

## 2. Tests

- [ ] Define verification approach and evidence requirements
- [ ] List concrete commands for verification

## 3. Implementation

- [ ] Execute role-specific deliverables
- [ ] Capture decisions, risks, and handoff notes

## 4. Checkpoints

- [ ] Publish checkpoint update for this role
"
done

echo "[guardex] OpenSpec plan workspace ready: ${PLAN_DIR}"
echo "[guardex] Roles: ${ROLES[*]}"
