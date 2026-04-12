#!/usr/bin/env bash
set -euo pipefail

TASK_NAME="${MUSAFETY_TASK_NAME:-task}"
AGENT_NAME="${MUSAFETY_AGENT_NAME:-agent}"
BASE_BRANCH="${MUSAFETY_BASE_BRANCH:-}"
BASE_BRANCH_EXPLICIT=0
CODEX_BIN="${MUSAFETY_CODEX_BIN:-codex}"
AUTO_FINISH_RAW="${MUSAFETY_CODEX_AUTO_FINISH:-true}"
AUTO_REVIEW_ON_CONFLICT_RAW="${MUSAFETY_CODEX_AUTO_REVIEW_ON_CONFLICT:-true}"
AUTO_CLEANUP_RAW="${MUSAFETY_CODEX_AUTO_CLEANUP:-true}"
AUTO_WAIT_FOR_MERGE_RAW="${MUSAFETY_CODEX_WAIT_FOR_MERGE:-true}"

normalize_bool() {
  local raw="${1:-}"
  local fallback="${2:-0}"
  local lowered
  lowered="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$lowered" in
    1|true|yes|on) printf '1' ;;
    0|false|no|off) printf '0' ;;
    '') printf '%s' "$fallback" ;;
    *) printf '%s' "$fallback" ;;
  esac
}

AUTO_FINISH="$(normalize_bool "$AUTO_FINISH_RAW" "1")"
AUTO_REVIEW_ON_CONFLICT="$(normalize_bool "$AUTO_REVIEW_ON_CONFLICT_RAW" "1")"
AUTO_CLEANUP="$(normalize_bool "$AUTO_CLEANUP_RAW" "1")"
AUTO_WAIT_FOR_MERGE="$(normalize_bool "$AUTO_WAIT_FOR_MERGE_RAW" "1")"

if [[ -n "$BASE_BRANCH" ]]; then
  BASE_BRANCH_EXPLICIT=1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --task)
      TASK_NAME="${2:-$TASK_NAME}"
      shift 2
      ;;
    --agent)
      AGENT_NAME="${2:-$AGENT_NAME}"
      shift 2
      ;;
    --base)
      BASE_BRANCH="${2:-$BASE_BRANCH}"
      BASE_BRANCH_EXPLICIT=1
      shift 2
      ;;
    --codex-bin)
      CODEX_BIN="${2:-$CODEX_BIN}"
      shift 2
      ;;
    --auto-finish)
      AUTO_FINISH=1
      shift
      ;;
    --no-auto-finish)
      AUTO_FINISH=0
      shift
      ;;
    --auto-review-on-conflict)
      AUTO_REVIEW_ON_CONFLICT=1
      shift
      ;;
    --no-auto-review-on-conflict)
      AUTO_REVIEW_ON_CONFLICT=0
      shift
      ;;
    --cleanup)
      AUTO_CLEANUP=1
      shift
      ;;
    --no-cleanup)
      AUTO_CLEANUP=0
      shift
      ;;
    --wait-for-merge)
      AUTO_WAIT_FOR_MERGE=1
      shift
      ;;
    --no-wait-for-merge)
      AUTO_WAIT_FOR_MERGE=0
      shift
      ;;
    --)
      shift
      break
      ;;
    -*)
      break
      ;;
    *)
      TASK_NAME="$1"
      shift
      if [[ $# -gt 0 && "${1:-}" != -* ]]; then
        AGENT_NAME="$1"
        shift
      fi
      if [[ $# -gt 0 && "${1:-}" != -* ]]; then
        BASE_BRANCH="$1"
        BASE_BRANCH_EXPLICIT=1
        shift
      fi
      break
      ;;
  esac
done

if [[ "$BASE_BRANCH_EXPLICIT" -eq 1 && -z "$BASE_BRANCH" ]]; then
  echo "[codex-agent] --base requires a non-empty branch name." >&2
  exit 1
fi

if ! command -v "$CODEX_BIN" >/dev/null 2>&1; then
  echo "[codex-agent] Missing Codex CLI command: $CODEX_BIN" >&2
  echo "[codex-agent] Install Codex first, then retry." >&2
  exit 127
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[codex-agent] Not inside a git repository." >&2
  exit 1
fi
repo_root="$(git rev-parse --show-toplevel)"

if [[ ! -x "${repo_root}/scripts/agent-branch-start.sh" ]]; then
  echo "[codex-agent] Missing scripts/agent-branch-start.sh. Run: gx setup" >&2
  exit 1
fi

start_args=("$TASK_NAME" "$AGENT_NAME")
if [[ "$BASE_BRANCH_EXPLICIT" -eq 1 ]]; then
  start_args+=("$BASE_BRANCH")
fi

start_output="$(bash "${repo_root}/scripts/agent-branch-start.sh" "${start_args[@]}")"
printf '%s\n' "$start_output"

worktree_path="$(printf '%s\n' "$start_output" | sed -n 's/^\[agent-branch-start\] Worktree: //p' | tail -n1)"
if [[ -z "$worktree_path" ]]; then
  echo "[codex-agent] Could not determine sandbox worktree path from agent-branch-start output." >&2
  exit 1
fi

if [[ ! -d "$worktree_path" ]]; then
  echo "[codex-agent] Reported worktree path does not exist: $worktree_path" >&2
  exit 1
fi

has_origin_remote() {
  git -C "$repo_root" remote get-url origin >/dev/null 2>&1
}

resolve_worktree_base_branch() {
  local wt="$1"
  if [[ "$BASE_BRANCH_EXPLICIT" -eq 1 && -n "$BASE_BRANCH" ]]; then
    printf '%s' "$BASE_BRANCH"
    return 0
  fi

  local branch
  branch="$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
    return 0
  fi

  local stored_base
  stored_base="$(git -C "$repo_root" config --get "branch.${branch}.musafetyBase" || true)"
  if [[ -n "$stored_base" ]]; then
    printf '%s' "$stored_base"
    return 0
  fi

  local configured_base
  configured_base="$(git -C "$repo_root" config --get multiagent.baseBranch || true)"
  if [[ -n "$configured_base" ]]; then
    printf '%s' "$configured_base"
  fi
}

sync_worktree_with_base() {
  local wt="$1"
  if ! has_origin_remote; then
    return 0
  fi

  local base_branch
  base_branch="$(resolve_worktree_base_branch "$wt")"
  if [[ -z "$base_branch" ]]; then
    return 0
  fi

  if ! git -C "$wt" fetch origin "$base_branch" --quiet; then
    echo "[codex-agent] Warning: could not fetch origin/${base_branch} before task start." >&2
    return 0
  fi

  if ! git -C "$wt" show-ref --verify --quiet "refs/remotes/origin/${base_branch}"; then
    return 0
  fi

  local behind_count
  behind_count="$(git -C "$wt" rev-list --left-right --count "HEAD...origin/${base_branch}" 2>/dev/null | awk '{print $2}')"
  behind_count="${behind_count:-0}"
  if [[ "$behind_count" -le 0 ]]; then
    return 0
  fi

  local branch
  branch="$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  echo "[codex-agent] Task sync: '${branch}' is behind origin/${base_branch} by ${behind_count} commit(s). Rebasing before launch..."
  if ! git -C "$wt" rebase "origin/${base_branch}"; then
    echo "[codex-agent] Task sync failed. Resolve and continue in sandbox:" >&2
    echo "  git -C \"$wt\" rebase --continue" >&2
    echo "  # or abort" >&2
    echo "  git -C \"$wt\" rebase --abort" >&2
    return 1
  fi
  echo "[codex-agent] Task sync complete."
  return 0
}

worktree_has_changes() {
  local wt="$1"
  if ! git -C "$wt" diff --quiet -- . ":(exclude).omx/state/agent-file-locks.json"; then
    return 0
  fi
  if ! git -C "$wt" diff --cached --quiet -- . ":(exclude).omx/state/agent-file-locks.json"; then
    return 0
  fi
  if [[ -n "$(git -C "$wt" ls-files --others --exclude-standard)" ]]; then
    return 0
  fi
  return 1
}

claim_changed_files() {
  local wt="$1"
  local branch="$2"
  local lock_script="${repo_root}/scripts/agent-file-locks.py"

  if [[ ! -x "$lock_script" ]]; then
    return 0
  fi

  local changed_raw deleted_raw
  changed_raw="$({
    git -C "$wt" diff --name-only -- . ":(exclude).omx/state/agent-file-locks.json";
    git -C "$wt" diff --cached --name-only -- . ":(exclude).omx/state/agent-file-locks.json";
    git -C "$wt" ls-files --others --exclude-standard;
  } | sed '/^$/d' | sort -u)"

  if [[ -n "$changed_raw" ]]; then
    mapfile -t changed_files < <(printf '%s\n' "$changed_raw")
    python3 "$lock_script" claim --branch "$branch" "${changed_files[@]}" >/dev/null 2>&1 || true
  fi

  deleted_raw="$({
    git -C "$wt" diff --name-only --diff-filter=D -- . ":(exclude).omx/state/agent-file-locks.json";
    git -C "$wt" diff --cached --name-only --diff-filter=D -- . ":(exclude).omx/state/agent-file-locks.json";
  } | sed '/^$/d' | sort -u)"

  if [[ -n "$deleted_raw" ]]; then
    mapfile -t deleted_files < <(printf '%s\n' "$deleted_raw")
    python3 "$lock_script" allow-delete --branch "$branch" "${deleted_files[@]}" >/dev/null 2>&1 || true
  fi
}

auto_commit_worktree_changes() {
  local wt="$1"
  local branch="$2"

  if ! worktree_has_changes "$wt"; then
    return 0
  fi

  claim_changed_files "$wt" "$branch"
  git -C "$wt" add -A

  if git -C "$wt" diff --cached --quiet -- . ":(exclude).omx/state/agent-file-locks.json"; then
    return 0
  fi

  local default_message="Auto-finish: ${TASK_NAME}"
  local commit_message="${MUSAFETY_CODEX_AUTO_COMMIT_MESSAGE:-$default_message}"

  if ! git -C "$wt" commit -m "$commit_message" >/dev/null 2>&1; then
    echo "[codex-agent] Auto-commit failed in sandbox. Keeping branch for manual review: $branch" >&2
    return 1
  fi

  echo "[codex-agent] Auto-committed sandbox changes on '${branch}'."
  return 0
}

looks_like_conflict_failure() {
  local output="$1"
  if grep -qiE 'preflight conflict detected|merge conflict detected|auto-sync failed while rebasing|rebase --continue|rebase --abort' <<< "$output"; then
    return 0
  fi
  return 1
}

run_finish_flow() {
  local wt="$1"
  local branch="$2"
  local finish_output=""
  local -a finish_args

  finish_args=(--branch "$branch")
  if [[ "$BASE_BRANCH_EXPLICIT" -eq 1 ]]; then
    finish_args+=(--base "$BASE_BRANCH")
  fi
  if [[ "$AUTO_CLEANUP" -eq 1 ]]; then
    finish_args+=(--cleanup)
  fi
  if [[ "$AUTO_WAIT_FOR_MERGE" -eq 1 ]]; then
    finish_args+=(--wait-for-merge)
  fi

  if has_origin_remote; then
    if command -v gh >/dev/null 2>&1 || command -v "${MUSAFETY_GH_BIN:-gh}" >/dev/null 2>&1; then
      finish_args+=(--via-pr)
    fi
  else
    echo "[codex-agent] No origin remote detected; skipping auto-finish merge/PR pipeline." >&2
    return 2
  fi

  if finish_output="$(bash "${repo_root}/scripts/agent-branch-finish.sh" "${finish_args[@]}" 2>&1)"; then
    printf '%s\n' "$finish_output"
    return 0
  fi

  printf '%s\n' "$finish_output" >&2

  if [[ "$AUTO_REVIEW_ON_CONFLICT" -eq 1 ]] && looks_like_conflict_failure "$finish_output"; then
    echo "[codex-agent] Auto-finish hit conflicts. Launching Codex conflict-review pass in sandbox..." >&2
    local review_prompt
    review_prompt="Resolve git conflicts for branch ${branch} against ${BASE_BRANCH:-base branch}, then commit the resolution in this sandbox worktree and exit."

    (
      cd "$wt"
      set +e
      "$CODEX_BIN" "$review_prompt"
      review_exit="$?"
      set -e
      if [[ "$review_exit" -ne 0 ]]; then
        echo "[codex-agent] Conflict-review Codex pass exited with status ${review_exit}." >&2
      fi
    )

    if finish_output="$(bash "${repo_root}/scripts/agent-branch-finish.sh" "${finish_args[@]}" 2>&1)"; then
      printf '%s\n' "$finish_output"
      return 0
    fi

    printf '%s\n' "$finish_output" >&2
  fi

  return 1
}

if ! sync_worktree_with_base "$worktree_path"; then
  exit 1
fi

echo "[codex-agent] Launching ${CODEX_BIN} in sandbox: $worktree_path"
cd "$worktree_path"
set +e
"$CODEX_BIN" "$@"
codex_exit="$?"
set -e

cd "$repo_root"
final_exit="$codex_exit"
auto_finish_completed=0

worktree_branch="$(git -C "$worktree_path" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"

if [[ "$AUTO_FINISH" -eq 1 && -n "$worktree_branch" && "$worktree_branch" != "HEAD" ]]; then
  if [[ "$AUTO_WAIT_FOR_MERGE" -eq 1 && "$AUTO_CLEANUP" -eq 1 ]]; then
    echo "[codex-agent] Auto-finish enabled: commit -> push/PR -> wait for merge -> cleanup."
  elif [[ "$AUTO_WAIT_FOR_MERGE" -eq 1 ]]; then
    echo "[codex-agent] Auto-finish enabled: commit -> push/PR -> wait for merge (keep branch/worktree)."
  elif [[ "$AUTO_CLEANUP" -eq 1 ]]; then
    echo "[codex-agent] Auto-finish enabled: commit -> push/PR -> merge -> cleanup."
  else
    echo "[codex-agent] Auto-finish enabled: commit -> push/PR -> merge (keep branch/worktree)."
  fi
  if auto_commit_worktree_changes "$worktree_path" "$worktree_branch"; then
    if run_finish_flow "$worktree_path" "$worktree_branch"; then
      auto_finish_completed=1
      echo "[codex-agent] Auto-finish completed for '${worktree_branch}'."
    else
      finish_status="$?"
      if [[ "$finish_status" -eq 2 ]]; then
        echo "[codex-agent] Auto-finish skipped for '${worktree_branch}' (no mergeable remote context)." >&2
      else
        echo "[codex-agent] Auto-finish did not complete; keeping sandbox for manual review: $worktree_path" >&2
        if [[ "$final_exit" -eq 0 ]]; then
          final_exit=1
        fi
      fi
    fi
  else
    if [[ "$final_exit" -eq 0 ]]; then
      final_exit=1
    fi
  fi
fi

if [[ -x "${repo_root}/scripts/agent-worktree-prune.sh" ]]; then
  echo "[codex-agent] Session ended (exit=${codex_exit}). Running worktree cleanup..."
  prune_args=()
  if [[ "$BASE_BRANCH_EXPLICIT" -eq 1 ]]; then
    prune_args+=(--base "$BASE_BRANCH")
  fi
  if [[ "$AUTO_CLEANUP" -eq 1 && "$auto_finish_completed" -eq 1 ]]; then
    prune_args+=(--delete-branches --delete-remote-branches)
  fi
  if ! bash "${repo_root}/scripts/agent-worktree-prune.sh" "${prune_args[@]}"; then
    echo "[codex-agent] Warning: automatic worktree cleanup failed." >&2
  fi
fi

if [[ ! -d "$worktree_path" ]]; then
  echo "[codex-agent] Auto-cleaned sandbox worktree: $worktree_path"
else
  worktree_branch="$(git -C "$worktree_path" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  echo "[codex-agent] Sandbox worktree kept: $worktree_path"
  if [[ -n "$worktree_branch" && "$worktree_branch" != "HEAD" ]]; then
    if [[ "$auto_finish_completed" -eq 1 ]]; then
      echo "[codex-agent] Branch kept intentionally. Cleanup on demand: gx cleanup --branch \"${worktree_branch}\""
    else
      echo "[codex-agent] If finished, merge with: bash scripts/agent-branch-finish.sh --branch \"${worktree_branch}\" --via-pr"
      echo "[codex-agent] Cleanup on demand: gx cleanup --branch \"${worktree_branch}\""
    fi
  fi
fi

exit "$final_exit"
