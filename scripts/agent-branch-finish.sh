#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH=""
BASE_BRANCH_EXPLICIT=0
SOURCE_BRANCH=""
PUSH_ENABLED=1
DELETE_REMOTE_BRANCH=0
DELETE_REMOTE_BRANCH_EXPLICIT=0
MERGE_MODE="auto"
GH_BIN="${MUSAFETY_GH_BIN:-gh}"
CLEANUP_AFTER_MERGE_RAW="${MUSAFETY_FINISH_CLEANUP:-false}"
WAIT_FOR_MERGE_RAW="${MUSAFETY_FINISH_WAIT_FOR_MERGE:-false}"
WAIT_TIMEOUT_SECONDS_RAW="${MUSAFETY_FINISH_WAIT_TIMEOUT_SECONDS:-1800}"
WAIT_POLL_SECONDS_RAW="${MUSAFETY_FINISH_WAIT_POLL_SECONDS:-10}"

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

normalize_int() {
  local raw="${1:-}"
  local fallback="${2:-0}"
  local min_value="${3:-0}"
  local value="$raw"

  if [[ -z "$value" || ! "$value" =~ ^[0-9]+$ ]]; then
    value="$fallback"
  fi

  if (( value < min_value )); then
    value="$min_value"
  fi

  printf '%s' "$value"
}

CLEANUP_AFTER_MERGE="$(normalize_bool "$CLEANUP_AFTER_MERGE_RAW" "0")"
WAIT_FOR_MERGE="$(normalize_bool "$WAIT_FOR_MERGE_RAW" "0")"
WAIT_TIMEOUT_SECONDS="$(normalize_int "$WAIT_TIMEOUT_SECONDS_RAW" "1800" "30")"
WAIT_POLL_SECONDS="$(normalize_int "$WAIT_POLL_SECONDS_RAW" "10" "0")"

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
      DELETE_REMOTE_BRANCH_EXPLICIT=1
      shift
      ;;
    --delete-remote-branch)
      DELETE_REMOTE_BRANCH=1
      DELETE_REMOTE_BRANCH_EXPLICIT=1
      shift
      ;;
    --cleanup)
      CLEANUP_AFTER_MERGE=1
      shift
      ;;
    --no-cleanup)
      CLEANUP_AFTER_MERGE=0
      shift
      ;;
    --wait-for-merge)
      WAIT_FOR_MERGE=1
      shift
      ;;
    --no-wait-for-merge)
      WAIT_FOR_MERGE=0
      shift
      ;;
    --wait-timeout-seconds)
      WAIT_TIMEOUT_SECONDS="$(normalize_int "${2:-}" "1800" "30")"
      shift 2
      ;;
    --wait-poll-seconds)
      WAIT_POLL_SECONDS="$(normalize_int "${2:-}" "10" "0")"
      shift 2
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
      echo "Usage: $0 [--base <branch>] [--branch <branch>] [--no-push] [--cleanup|--no-cleanup] [--wait-for-merge|--no-wait-for-merge] [--wait-timeout-seconds <n>] [--wait-poll-seconds <n>] [--keep-remote-branch|--delete-remote-branch] [--mode auto|direct|pr|--via-pr|--direct-only]" >&2
      exit 1
      ;;
  esac
done

if [[ "$CLEANUP_AFTER_MERGE" -eq 1 && "$DELETE_REMOTE_BRANCH_EXPLICIT" -eq 0 ]]; then
  DELETE_REMOTE_BRANCH=1
fi

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
common_git_dir_raw="$(git -C "$repo_root" rev-parse --git-common-dir)"
if [[ "$common_git_dir_raw" == /* ]]; then
  common_git_dir="$common_git_dir_raw"
else
  common_git_dir="$(cd "$repo_root/$common_git_dir_raw" && pwd -P)"
fi
repo_common_root="$(cd "$common_git_dir/.." && pwd -P)"
agent_worktree_root="${repo_common_root}/.omx/agent-worktrees"

if [[ -z "$SOURCE_BRANCH" ]]; then
  SOURCE_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi

if [[ "$BASE_BRANCH_EXPLICIT" -eq 1 && -z "$BASE_BRANCH" ]]; then
  echo "[agent-branch-finish] --base requires a non-empty branch name." >&2
  exit 1
fi

if [[ "$BASE_BRANCH_EXPLICIT" -eq 0 ]]; then
  configured_base="$(git -C "$repo_root" config --get multiagent.baseBranch || true)"
  if [[ -n "$configured_base" ]]; then
    BASE_BRANCH="$configured_base"
  fi
fi

if [[ -z "$BASE_BRANCH" ]]; then
  branch_stored_base="$(git -C "$repo_root" config --get "branch.${SOURCE_BRANCH}.musafetyBase" || true)"
  if [[ -n "$branch_stored_base" ]]; then
    BASE_BRANCH="$branch_stored_base"
  fi
fi

if [[ -z "$BASE_BRANCH" ]]; then
  source_upstream="$(git -C "$repo_root" for-each-ref --format='%(upstream:short)' "refs/heads/${SOURCE_BRANCH}" | head -n 1)"
  source_upstream="${source_upstream:-}"
  if [[ "$source_upstream" == */* ]]; then
    BASE_BRANCH="${source_upstream#*/}"
  fi
fi

if [[ -z "$BASE_BRANCH" ]]; then
  current_branch="$(git -C "$repo_root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ -n "$current_branch" && "$current_branch" != "HEAD" && "$current_branch" != "$SOURCE_BRANCH" ]]; then
    BASE_BRANCH="$current_branch"
  fi
fi

if [[ -z "$BASE_BRANCH" ]]; then
  BASE_BRANCH="dev"
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
  source_probe_path="${agent_worktree_root}/__source-probe-${SOURCE_BRANCH//\//__}-$(date +%Y%m%d-%H%M%S)"
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
    echo "[agent-sync-guard] Auto-syncing '${SOURCE_BRANCH}' onto origin/${BASE_BRANCH} before finish..." >&2
    if ! git -C "$source_worktree" rebase "origin/${BASE_BRANCH}"; then
      git_dir="$(git -C "$source_worktree" rev-parse --git-dir)"
      rebase_active=0
      if [[ -e "${git_dir}/rebase-merge" || -e "${git_dir}/rebase-apply" ]]; then
        rebase_active=1
      fi

      echo "[agent-sync-guard] Auto-sync failed while rebasing '${SOURCE_BRANCH}' onto origin/${BASE_BRANCH}." >&2
      if [[ "$rebase_active" -eq 1 ]]; then
        echo "[agent-sync-guard] Resolve conflicts, then run: git -C \"$source_worktree\" rebase --continue" >&2
        echo "[agent-sync-guard] Or abort: git -C \"$source_worktree\" rebase --abort" >&2
      fi
      exit 1
    fi

    behind_after="$(git -C "$repo_root" rev-list --left-right --count "${SOURCE_BRANCH}...origin/${BASE_BRANCH}" 2>/dev/null | awk '{print $2}')"
    behind_after="${behind_after:-0}"
    echo "[agent-sync-guard] Auto-sync complete (behind now: ${behind_after})." >&2
  fi
fi

integration_worktree="${agent_worktree_root}/__integrate-${BASE_BRANCH//\//__}-$(date +%Y%m%d-%H%M%S)"
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

is_local_branch_delete_error() {
  local output="$1"
  if [[ "$output" != *"failed to delete local branch"* ]]; then
    return 1
  fi
  if [[ "$output" == *"cannot delete branch"* ]] || [[ "$output" == *"used by worktree"* ]]; then
    return 0
  fi
  return 1
}

read_pr_state() {
  local state_line
  state_line="$("$GH_BIN" pr view "$SOURCE_BRANCH" --json state,mergedAt,url --jq '[.state, (.mergedAt // ""), (.url // "")] | @tsv' 2>/dev/null || true)"
  if [[ -z "$state_line" ]]; then
    return 1
  fi

  local parsed_state=""
  local parsed_merged_at=""
  local parsed_url=""
  IFS=$'\t' read -r parsed_state parsed_merged_at parsed_url <<< "$state_line"
  PR_STATE="$parsed_state"
  PR_MERGED_AT="$parsed_merged_at"
  if [[ -n "$parsed_url" ]]; then
    pr_url="$parsed_url"
  fi
  return 0
}

wait_for_pr_merge() {
  local deadline
  deadline=$(( $(date +%s) + WAIT_TIMEOUT_SECONDS ))
  local wait_notice_printed=0
  local merge_output=""

  while true; do
    if merge_output="$("$GH_BIN" pr merge "$SOURCE_BRANCH" --squash --delete-branch 2>&1)"; then
      return 0
    fi
    if is_local_branch_delete_error "$merge_output"; then
      echo "[agent-branch-finish] PR merged but gh could not delete the local branch (active worktree); continuing local cleanup." >&2
      return 0
    fi

    PR_STATE=""
    PR_MERGED_AT=""
    if read_pr_state; then
      if [[ "$PR_STATE" == "MERGED" || -n "$PR_MERGED_AT" ]]; then
        return 0
      fi
      if [[ "$PR_STATE" == "CLOSED" ]]; then
        echo "[agent-branch-finish] PR closed without merge; cannot continue auto-finish." >&2
        if [[ -n "$pr_url" ]]; then
          echo "[agent-branch-finish] PR: ${pr_url}" >&2
        fi
        if [[ -n "$merge_output" ]]; then
          echo "$merge_output" >&2
        fi
        return 1
      fi
    fi

    if [[ "$wait_notice_printed" -eq 0 ]]; then
      echo "[agent-branch-finish] Waiting for required checks/reviews, then retrying merge automatically (timeout ${WAIT_TIMEOUT_SECONDS}s)." >&2
      if [[ -n "$pr_url" ]]; then
        echo "[agent-branch-finish] PR: ${pr_url}" >&2
      fi
      wait_notice_printed=1
    fi

    if (( $(date +%s) >= deadline )); then
      echo "[agent-branch-finish] Timed out waiting for PR merge after ${WAIT_TIMEOUT_SECONDS}s." >&2
      if [[ -n "$merge_output" ]]; then
        echo "$merge_output" >&2
      fi
      return 2
    fi

    sleep "$WAIT_POLL_SECONDS"
  done
}

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
  if is_local_branch_delete_error "$merge_output"; then
    echo "[agent-branch-finish] PR merged but gh could not delete the local branch (active worktree); continuing local cleanup." >&2
    return 0
  fi

  if [[ "$WAIT_FOR_MERGE" -eq 1 ]]; then
    wait_for_pr_merge
    return $?
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
        if [[ "$WAIT_FOR_MERGE" -eq 1 ]]; then
          echo "[agent-branch-finish] Merge did not complete within wait window; keeping branch open." >&2
          exit 1
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

base_worktree="$(get_worktree_for_branch "$BASE_BRANCH")"
if [[ -n "$base_worktree" ]] && is_clean_worktree "$base_worktree" && [[ "$PUSH_ENABLED" -eq 1 ]]; then
  git -C "$base_worktree" pull --ff-only origin "$BASE_BRANCH" >/dev/null 2>&1 || true
fi

if [[ "$CLEANUP_AFTER_MERGE" -eq 1 ]]; then
  if [[ "$source_worktree" == "$repo_root" ]]; then
    if is_clean_worktree "$source_worktree"; then
      switched_to_base=0
      if git -C "$source_worktree" checkout "$BASE_BRANCH" >/dev/null 2>&1; then
        switched_to_base=1
      else
        git -C "$source_worktree" checkout --detach >/dev/null 2>&1 || true
      fi
      if [[ "$switched_to_base" -eq 1 && "$PUSH_ENABLED" -eq 1 ]] && git -C "$repo_root" show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
        git -C "$source_worktree" pull --ff-only origin "$BASE_BRANCH" >/dev/null 2>&1 || true
      fi
    fi
  elif [[ "$source_worktree" == "$current_worktree" && "$source_worktree" == "${agent_worktree_root}"/* ]]; then
    git -C "$source_worktree" checkout --detach >/dev/null 2>&1 || true
  fi

  if [[ "$source_worktree" != "$current_worktree" && "$source_worktree" == "${agent_worktree_root}"/* ]]; then
    git -C "$repo_root" worktree remove "$source_worktree" --force >/dev/null 2>&1 || true
  fi

  git -C "$repo_root" branch -d "$SOURCE_BRANCH"

  if [[ "$PUSH_ENABLED" -eq 1 && "$DELETE_REMOTE_BRANCH" -eq 1 ]]; then
    if git -C "$repo_root" ls-remote --exit-code --heads origin "$SOURCE_BRANCH" >/dev/null 2>&1; then
      git -C "$repo_root" push origin --delete "$SOURCE_BRANCH"
    fi
  fi

  if [[ -x "${repo_root}/scripts/agent-worktree-prune.sh" ]]; then
    prune_args=(--base "$BASE_BRANCH" --delete-branches)
    if [[ "$DELETE_REMOTE_BRANCH" -eq 1 ]]; then
      prune_args+=(--delete-remote-branches)
    fi
    if ! bash "${repo_root}/scripts/agent-worktree-prune.sh" "${prune_args[@]}"; then
      echo "[agent-branch-finish] Warning: automatic worktree prune failed." >&2
      echo "[agent-branch-finish] You can run manual cleanup: bash scripts/agent-worktree-prune.sh --base ${BASE_BRANCH} --delete-branches" >&2
    fi
  fi

  echo "[agent-branch-finish] Merged '${SOURCE_BRANCH}' into '${BASE_BRANCH}' via ${merge_status} flow and cleaned source branch/worktree."
  if [[ "$source_worktree" == "$current_worktree" && "$source_worktree" == "${agent_worktree_root}"/* ]]; then
    echo "[agent-branch-finish] Current worktree '${source_worktree}' still exists because it is the active shell cwd." >&2
    echo "[agent-branch-finish] Leave this directory, then run: bash scripts/agent-worktree-prune.sh --base ${BASE_BRANCH} --delete-branches" >&2
  fi
else
  if [[ -x "${repo_root}/scripts/agent-worktree-prune.sh" ]]; then
    if ! bash "${repo_root}/scripts/agent-worktree-prune.sh" --base "$BASE_BRANCH"; then
      echo "[agent-branch-finish] Warning: temporary worktree prune failed." >&2
    fi
  fi

  echo "[agent-branch-finish] Merged '${SOURCE_BRANCH}' into '${BASE_BRANCH}' via ${merge_status} flow and kept source branch/worktree."
  echo "[agent-branch-finish] Cleanup later with: bash scripts/agent-worktree-prune.sh --base ${BASE_BRANCH} --delete-branches --delete-remote-branches"
fi
