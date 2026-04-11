#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH="dev"
BASE_BRANCH_EXPLICIT=0
SOURCE_BRANCH=""
PUSH_ENABLED=1
DELETE_REMOTE_BRANCH=1
MERGE_MODE="auto"
GH_BIN="${MUSAFETY_GH_BIN:-gh}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_BRANCH="${2:-}"
      BASE_BRANCH_EXPLICIT=1
      shift 2
      ;;
    --branch)
      SOURCE_BRANCH="${2:-}"
      shift 2
      ;;
    --no-push)
      PUSH_ENABLED=0
      shift
      ;;
    --keep-remote-branch)
      DELETE_REMOTE_BRANCH=0
      shift
      ;;
    --mode)
      MERGE_MODE="${2:-auto}"
      shift 2
      ;;
    --via-pr)
      MERGE_MODE="pr"
      shift
      ;;
    --direct-only)
      MERGE_MODE="direct"
      shift
      ;;
    *)
      echo "[agent-branch-finish] Unknown argument: $1" >&2
      echo "Usage: $0 [--base <branch>] [--branch <branch>] [--no-push] [--keep-remote-branch] [--mode auto|direct|pr|--via-pr|--direct-only]" >&2
      exit 1
      ;;
  esac
done

case "$MERGE_MODE" in
  auto|direct|pr) ;;
  *)
    echo "[agent-branch-finish] Invalid --mode value: ${MERGE_MODE} (expected auto|direct|pr)" >&2
    exit 1
    ;;
esac

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[agent-branch-finish] Not inside a git repository." >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
current_worktree="$(pwd -P)"

if [[ "$BASE_BRANCH_EXPLICIT" -eq 0 ]]; then
  configured_base="$(git -C "$repo_root" config --get multiagent.baseBranch || true)"
  if [[ -n "$configured_base" ]]; then
    BASE_BRANCH="$configured_base"
  fi
fi

if [[ -z "$SOURCE_BRANCH" ]]; then
  SOURCE_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

if [[ "$SOURCE_BRANCH" == "$BASE_BRANCH" ]]; then
  echo "[agent-branch-finish] Source branch and base branch are both '$BASE_BRANCH'." >&2
  echo "[agent-branch-finish] Switch to your agent branch or pass --branch <agent-branch>." >&2
  exit 1
fi

if ! git -C "$repo_root" show-ref --verify --quiet "refs/heads/${SOURCE_BRANCH}"; then
  echo "[agent-branch-finish] Local source branch does not exist: ${SOURCE_BRANCH}" >&2
  exit 1
fi

get_worktree_for_branch() {
  local branch="$1"
  git -C "$repo_root" worktree list --porcelain | awk -v target="refs/heads/${branch}" '
    $1 == "worktree" { wt = $2 }
    $1 == "branch" && $2 == target { print wt; exit }
  '
}

is_clean_worktree() {
  local wt="$1"
  git -C "$wt" diff --quiet -- . ":(exclude).omx/state/agent-file-locks.json" \
    && git -C "$wt" diff --cached --quiet -- . ":(exclude).omx/state/agent-file-locks.json"
}

source_worktree="$(get_worktree_for_branch "$SOURCE_BRANCH")"
created_source_probe=0
source_probe_path=""

if [[ -z "$source_worktree" ]]; then
  source_probe_path="${repo_root}/.omx/agent-worktrees/__source-probe-${SOURCE_BRANCH//\//__}-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$(dirname "$source_probe_path")"
  git -C "$repo_root" worktree add "$source_probe_path" "$SOURCE_BRANCH" >/dev/null
  source_worktree="$source_probe_path"
  created_source_probe=1
fi

if ! is_clean_worktree "$source_worktree"; then
  echo "[agent-branch-finish] Source worktree is not clean for '${SOURCE_BRANCH}': ${source_worktree}" >&2
  echo "[agent-branch-finish] Commit/stash changes on the source branch before finishing." >&2
  exit 1
fi

start_ref="$BASE_BRANCH"
if git -C "$repo_root" show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
  git -C "$repo_root" fetch origin "$BASE_BRANCH" --quiet
  start_ref="origin/${BASE_BRANCH}"
fi

require_before_finish_raw="$(git -C "$repo_root" config --get multiagent.sync.requireBeforeFinish || true)"
if [[ -z "$require_before_finish_raw" ]]; then
  require_before_finish_raw="true"
fi
require_before_finish="$(printf '%s' "$require_before_finish_raw" | tr '[:upper:]' '[:lower:]')"
should_require_sync=0
case "$require_before_finish" in
  1|true|yes|on) should_require_sync=1 ;;
  0|false|no|off) should_require_sync=0 ;;
  *) should_require_sync=1 ;;
esac

if [[ "$should_require_sync" -eq 1 ]] && git -C "$repo_root" show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
  behind_count="$(git -C "$repo_root" rev-list --left-right --count "${SOURCE_BRANCH}...origin/${BASE_BRANCH}" 2>/dev/null | awk '{print $2}')"
  behind_count="${behind_count:-0}"
  if [[ "$behind_count" -gt 0 ]]; then
    echo "[agent-sync-guard] Branch '${SOURCE_BRANCH}' is behind origin/${BASE_BRANCH} by ${behind_count} commit(s)." >&2
    echo "[agent-sync-guard] Run: musafety sync --base ${BASE_BRANCH}" >&2
    echo "[agent-sync-guard] Then retry: bash scripts/agent-branch-finish.sh --branch \"${SOURCE_BRANCH}\"" >&2
    exit 1
  fi
fi

integration_worktree="${repo_root}/.omx/agent-worktrees/__integrate-${BASE_BRANCH//\//__}-$(date +%Y%m%d-%H%M%S)"
integration_branch="__agent_integrate_${BASE_BRANCH//\//_}_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$(dirname "$integration_worktree")"

git -C "$repo_root" worktree add "$integration_worktree" "$start_ref" >/dev/null
git -C "$integration_worktree" checkout -b "$integration_branch" >/dev/null

cleanup() {
  if [[ -d "$integration_worktree" ]]; then
    git -C "$repo_root" worktree remove "$integration_worktree" --force >/dev/null 2>&1 || true
  fi
  if [[ "$created_source_probe" -eq 1 && -n "$source_probe_path" && -d "$source_probe_path" ]]; then
    git -C "$repo_root" worktree remove "$source_probe_path" --force >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if git -C "$repo_root" show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
  git -C "$source_worktree" fetch origin "$BASE_BRANCH" --quiet

  if ! git -C "$source_worktree" merge --no-commit --no-ff "origin/${BASE_BRANCH}" >/dev/null 2>&1; then
    conflict_files="$(git -C "$source_worktree" diff --name-only --diff-filter=U || true)"
    git -C "$source_worktree" merge --abort >/dev/null 2>&1 || true

    echo "[agent-branch-finish] Preflight conflict detected between '${SOURCE_BRANCH}' and latest origin/${BASE_BRANCH}." >&2
    if [[ -n "$conflict_files" ]]; then
      echo "[agent-branch-finish] Conflicting files:" >&2
      while IFS= read -r file; do
        [[ -n "$file" ]] && echo "  - ${file}" >&2
      done <<< "$conflict_files"
    fi
    echo "[agent-branch-finish] Rebase/merge '${BASE_BRANCH}' into '${SOURCE_BRANCH}' and resolve conflicts before finishing." >&2
    exit 1
  fi

  git -C "$source_worktree" merge --abort >/dev/null 2>&1 || true
fi

if ! git -C "$integration_worktree" merge --no-ff --no-edit "$SOURCE_BRANCH"; then
  echo "[agent-branch-finish] Merge conflict detected while merging '${SOURCE_BRANCH}' into '${BASE_BRANCH}'." >&2
  git -C "$integration_worktree" merge --abort >/dev/null 2>&1 || true
  exit 1
fi

merge_completed=1
merge_status="direct"
direct_push_error=""
pr_url=""

run_pr_flow() {
  if ! command -v "$GH_BIN" >/dev/null 2>&1; then
    echo "[agent-branch-finish] PR fallback requested but GitHub CLI not found: ${GH_BIN}" >&2
    return 1
  fi

  git -C "$source_worktree" push -u origin "$SOURCE_BRANCH"

  pr_title="$(git -C "$repo_root" log -1 --pretty=%s "$SOURCE_BRANCH" 2>/dev/null || true)"
  if [[ -z "$pr_title" ]]; then
    pr_title="Merge ${SOURCE_BRANCH} into ${BASE_BRANCH}"
  fi
  pr_body="Automated by scripts/agent-branch-finish.sh (PR flow)."

  "$GH_BIN" pr create \
    --base "$BASE_BRANCH" \
    --head "$SOURCE_BRANCH" \
    --title "$pr_title" \
    --body "$pr_body" >/dev/null 2>&1 || true

  pr_url="$("$GH_BIN" pr view "$SOURCE_BRANCH" --json url --jq '.url' 2>/dev/null || true)"

  merge_output=""
  if merge_output="$("$GH_BIN" pr merge "$SOURCE_BRANCH" --squash --delete-branch 2>&1)"; then
    return 0
  fi

  auto_output=""
  if auto_output="$("$GH_BIN" pr merge "$SOURCE_BRANCH" --squash --delete-branch --auto 2>&1)"; then
    echo "[agent-branch-finish] PR auto-merge enabled; waiting for required checks/reviews." >&2
    return 2
  fi

  if [[ -n "$merge_output" ]]; then
    echo "[agent-branch-finish] PR merge not completed yet; leaving PR open." >&2
    echo "${merge_output}" >&2
  fi
  if [[ -n "$auto_output" ]]; then
    echo "${auto_output}" >&2
  fi
  return 2
}

if [[ "$PUSH_ENABLED" -eq 1 ]]; then
  if [[ "$MERGE_MODE" != "pr" ]]; then
    if ! direct_push_output="$(git -C "$integration_worktree" push origin "HEAD:${BASE_BRANCH}" 2>&1)"; then
      direct_push_error="$direct_push_output"
      merge_completed=0
    fi
  else
    merge_completed=0
  fi

  if [[ "$merge_completed" -eq 0 ]]; then
    if [[ "$MERGE_MODE" == "direct" ]]; then
      echo "[agent-branch-finish] Direct push/merge failed in --direct-only mode." >&2
      if [[ -n "$direct_push_error" ]]; then
        echo "$direct_push_error" >&2
      fi
      exit 1
    fi

    if run_pr_flow; then
      merge_completed=1
      merge_status="pr"
    else
      pr_exit=$?
      if [[ "$pr_exit" -eq 2 ]]; then
        echo "[agent-branch-finish] PR flow created/updated branch '${SOURCE_BRANCH}' against '${BASE_BRANCH}'." >&2
        if [[ -n "$pr_url" ]]; then
          echo "[agent-branch-finish] PR: ${pr_url}" >&2
        fi
        echo "[agent-branch-finish] Merge pending review/check policy. Branch cleanup skipped for now." >&2
        exit 0
      fi
      echo "[agent-branch-finish] PR flow failed." >&2
      if [[ -n "$direct_push_error" ]]; then
        echo "[agent-branch-finish] Direct push failure details:" >&2
        echo "$direct_push_error" >&2
      fi
      exit 1
    fi
  fi
fi

if [[ -x "${repo_root}/scripts/agent-file-locks.py" ]]; then
  python3 "${repo_root}/scripts/agent-file-locks.py" release --branch "$SOURCE_BRANCH" >/dev/null 2>&1 || true
fi

if [[ "$source_worktree" == "$repo_root" ]]; then
  if is_clean_worktree "$source_worktree"; then
    git -C "$source_worktree" checkout "$BASE_BRANCH" >/dev/null 2>&1 || true
  fi
elif [[ "$source_worktree" == "$current_worktree" && "$source_worktree" == "${repo_root}/.omx/agent-worktrees"/* ]]; then
  git -C "$source_worktree" checkout --detach >/dev/null 2>&1 || true
fi

if [[ "$source_worktree" != "$current_worktree" && "$source_worktree" == "${repo_root}/.omx/agent-worktrees"/* ]]; then
  git -C "$repo_root" worktree remove "$source_worktree" --force >/dev/null 2>&1 || true
fi

git -C "$repo_root" branch -d "$SOURCE_BRANCH"

if [[ "$PUSH_ENABLED" -eq 1 && "$DELETE_REMOTE_BRANCH" -eq 1 ]]; then
  if git -C "$repo_root" ls-remote --exit-code --heads origin "$SOURCE_BRANCH" >/dev/null 2>&1; then
    git -C "$repo_root" push origin --delete "$SOURCE_BRANCH"
  fi
fi

base_worktree="$(get_worktree_for_branch "$BASE_BRANCH")"
if [[ -n "$base_worktree" ]] && is_clean_worktree "$base_worktree" && [[ "$PUSH_ENABLED" -eq 1 ]]; then
  git -C "$base_worktree" pull --ff-only origin "$BASE_BRANCH" >/dev/null 2>&1 || true
fi

if [[ -x "${repo_root}/scripts/agent-worktree-prune.sh" ]]; then
  if ! bash "${repo_root}/scripts/agent-worktree-prune.sh" --base "$BASE_BRANCH"; then
    echo "[agent-branch-finish] Warning: automatic worktree prune failed." >&2
    echo "[agent-branch-finish] You can run manual cleanup: bash scripts/agent-worktree-prune.sh --base ${BASE_BRANCH}" >&2
  fi
fi

echo "[agent-branch-finish] Merged '${SOURCE_BRANCH}' into '${BASE_BRANCH}' via ${merge_status} flow and removed branch."
if [[ "$source_worktree" == "$current_worktree" && "$source_worktree" == "${repo_root}/.omx/agent-worktrees"/* ]]; then
  echo "[agent-branch-finish] Current worktree '${source_worktree}' still exists because it is the active shell cwd." >&2
  echo "[agent-branch-finish] Leave this directory, then run: bash scripts/agent-worktree-prune.sh --base ${BASE_BRANCH}" >&2
fi
