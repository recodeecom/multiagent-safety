#!/usr/bin/env bash
set -euo pipefail

TASK_NAME="task"
AGENT_NAME="agent"
BASE_BRANCH="dev"
WORKTREE_MODE=1
ALLOW_IN_PLACE=0
WORKTREE_ROOT_REL=".omx/agent-worktrees"
POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --task)
      TASK_NAME="${2:-task}"
      shift 2
      ;;
    --agent)
      AGENT_NAME="${2:-agent}"
      shift 2
      ;;
    --base)
      BASE_BRANCH="${2:-dev}"
      shift 2
      ;;
    --in-place)
      WORKTREE_MODE=0
      shift
      ;;
    --allow-in-place)
      ALLOW_IN_PLACE=1
      shift
      ;;
    --worktree-root)
      WORKTREE_ROOT_REL="${2:-.omx/agent-worktrees}"
      shift 2
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        POSITIONAL_ARGS+=("$1")
        shift
      done
      break
      ;;
    -*)
      echo "[agent-branch-start] Unknown option: $1" >&2
      echo "Usage: $0 [task] [agent] [base] [--in-place --allow-in-place] [--worktree-root <path>]" >&2
      exit 1
      ;;
    *)
      POSITIONAL_ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ "${#POSITIONAL_ARGS[@]}" -gt 3 ]]; then
  echo "[agent-branch-start] Too many positional arguments." >&2
  echo "Usage: $0 [task] [agent] [base] [--in-place --allow-in-place] [--worktree-root <path>]" >&2
  exit 1
fi

if [[ "${#POSITIONAL_ARGS[@]}" -ge 1 ]]; then
  TASK_NAME="${POSITIONAL_ARGS[0]}"
fi

if [[ "${#POSITIONAL_ARGS[@]}" -ge 2 ]]; then
  AGENT_NAME="${POSITIONAL_ARGS[1]}"
fi

if [[ "${#POSITIONAL_ARGS[@]}" -ge 3 ]]; then
  BASE_BRANCH="${POSITIONAL_ARGS[2]}"
fi

sanitize_slug() {
  local raw="$1"
  local slug
  slug="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"
  if [[ -z "$slug" ]]; then
    slug="task"
  fi
  printf '%s' "$slug"
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[agent-branch-start] Not inside a git repository." >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"

if git show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
  git fetch origin "${BASE_BRANCH}" --quiet
  start_ref="origin/${BASE_BRANCH}"
else
  if ! git show-ref --verify --quiet "refs/heads/${BASE_BRANCH}"; then
    echo "[agent-branch-start] Base branch not found locally or on origin: ${BASE_BRANCH}" >&2
    exit 1
  fi
  start_ref="${BASE_BRANCH}"
fi

task_slug="$(sanitize_slug "$TASK_NAME")"
agent_slug="$(sanitize_slug "$AGENT_NAME")"
timestamp="$(date +%Y%m%d-%H%M%S)"
branch_name="agent/${agent_slug}/${timestamp}-${task_slug}"

if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
  echo "[agent-branch-start] Branch already exists: ${branch_name}" >&2
  exit 1
fi

if [[ "$WORKTREE_MODE" -eq 0 ]]; then
  if [[ "$ALLOW_IN_PLACE" -ne 1 ]]; then
    echo "[agent-branch-start] --in-place is blocked by default to prevent accidental edits on protected branches." >&2
    echo "[agent-branch-start] If you really need it, pass both: --in-place --allow-in-place" >&2
    exit 1
  fi

  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "[agent-branch-start] Working tree is not clean. Commit/stash changes before starting an in-place branch." >&2
    exit 1
  fi

  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$current_branch" != "$BASE_BRANCH" ]]; then
    git checkout "$BASE_BRANCH"
  fi

  if git show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
    git pull --ff-only origin "$BASE_BRANCH"
  fi

  git checkout -b "$branch_name"
  echo "[agent-branch-start] Created in-place branch: ${branch_name}"
  echo "$branch_name"
  exit 0
fi

worktree_root="${repo_root}/${WORKTREE_ROOT_REL}"
mkdir -p "$worktree_root"
worktree_path="${worktree_root}/${branch_name//\//__}"

if [[ -e "$worktree_path" ]]; then
  echo "[agent-branch-start] Worktree path already exists: ${worktree_path}" >&2
  exit 1
fi

git -C "$repo_root" worktree add -b "$branch_name" "$worktree_path" "$start_ref"

if git -C "$repo_root" show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
  git -C "$worktree_path" branch --set-upstream-to="origin/${BASE_BRANCH}" "$branch_name" >/dev/null 2>&1 || true
fi

echo "[agent-branch-start] Created branch: ${branch_name}"
echo "[agent-branch-start] Worktree: ${worktree_path}"
echo "[agent-branch-start] Next steps:"
echo "  cd \"${worktree_path}\""
echo "  python3 scripts/agent-file-locks.py claim --branch \"${branch_name}\" <file...>"
echo "  # implement + commit"
echo "  bash scripts/agent-branch-finish.sh --branch \"${branch_name}\""
