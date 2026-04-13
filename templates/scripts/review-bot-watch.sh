#!/usr/bin/env bash
set -euo pipefail

INTERVAL_SECONDS="${MUSAFETY_REVIEW_BOT_INTERVAL_SECONDS:-30}"
AGENT_NAME="${MUSAFETY_REVIEW_BOT_AGENT_NAME:-guardex-review-bot}"
TASK_PREFIX="${MUSAFETY_REVIEW_BOT_TASK_PREFIX:-review-merge}"
STATE_FILE="${MUSAFETY_REVIEW_BOT_STATE_FILE:-}"
BASE_BRANCH="${MUSAFETY_REVIEW_BOT_BASE_BRANCH:-}"
ONLY_PR="${MUSAFETY_REVIEW_BOT_ONLY_PR:-}"
RETRY_FAILED_RAW="${MUSAFETY_REVIEW_BOT_RETRY_FAILED:-false}"
INCLUDE_DRAFT_RAW="${MUSAFETY_REVIEW_BOT_INCLUDE_DRAFT:-false}"

usage() {
  cat <<'USAGE'
Usage: bash scripts/review-bot-watch.sh [options]

Continuously monitor GitHub pull requests targeting a base branch and dispatch
one Codex-agent task per newly opened/updated PR.

Options:
  --base <branch>            Base branch to watch (default: current branch)
  --interval <seconds>       Poll interval (default: 30)
  --agent <name>             Agent name for codex-agent (default: guardex-review-bot)
  --task-prefix <prefix>     Task prefix for codex-agent branches (default: review-merge)
  --state-file <path>        State file path (default: .omx/state/review-bot-watch-<base>.tsv)
  --only-pr <number>         Watch only one PR number
  --include-draft            Include draft PRs
  --retry-failed             Retry PRs that previously failed even when SHA is unchanged
  --once                     Run one poll cycle and exit
  -h, --help                 Show this help

Environment overrides:
  MUSAFETY_REVIEW_BOT_PROMPT_APPEND  Additional instructions appended to each Codex prompt
USAGE
}

normalize_bool() {
  local raw="${1:-}"
  local fallback="${2:-0}"
  case "$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) printf '1' ;;
    0|false|no|off) printf '0' ;;
    '') printf '%s' "$fallback" ;;
    *) printf '%s' "$fallback" ;;
  esac
}

ONCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --interval)
      INTERVAL_SECONDS="${2:-}"
      shift 2
      ;;
    --agent)
      AGENT_NAME="${2:-}"
      shift 2
      ;;
    --task-prefix)
      TASK_PREFIX="${2:-}"
      shift 2
      ;;
    --state-file)
      STATE_FILE="${2:-}"
      shift 2
      ;;
    --only-pr)
      ONLY_PR="${2:-}"
      shift 2
      ;;
    --retry-failed)
      RETRY_FAILED_RAW="true"
      shift
      ;;
    --include-draft)
      INCLUDE_DRAFT_RAW="true"
      shift
      ;;
    --once)
      ONCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[review-bot-watch] Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

RETRY_FAILED="$(normalize_bool "$RETRY_FAILED_RAW" "0")"
INCLUDE_DRAFT="$(normalize_bool "$INCLUDE_DRAFT_RAW" "0")"

if [[ ! "$INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || [[ "$INTERVAL_SECONDS" -lt 5 ]]; then
  echo "[review-bot-watch] --interval must be an integer >= 5 seconds." >&2
  exit 1
fi

if [[ -n "$ONLY_PR" ]] && [[ ! "$ONLY_PR" =~ ^[0-9]+$ ]]; then
  echo "[review-bot-watch] --only-pr must be a numeric PR id." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[review-bot-watch] Not inside a git repository." >&2
  exit 1
fi
repo_root="$(git rev-parse --show-toplevel)"

if [[ -z "$BASE_BRANCH" ]]; then
  BASE_BRANCH="$(git -C "$repo_root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
if [[ -z "$BASE_BRANCH" || "$BASE_BRANCH" == "HEAD" ]]; then
  BASE_BRANCH="main"
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "[review-bot-watch] Missing GitHub CLI (gh)." >&2
  echo "[review-bot-watch] Install gh and run: gh auth login" >&2
  exit 127
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "[review-bot-watch] Missing Codex CLI command: codex" >&2
  exit 127
fi

if [[ ! -x "$repo_root/scripts/codex-agent.sh" ]]; then
  echo "[review-bot-watch] Missing scripts/codex-agent.sh. Run: gx setup" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "[review-bot-watch] gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

sanitize_slug() {
  local raw="$1"
  local fallback="$2"
  local slug
  slug="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"
  if [[ -z "$slug" ]]; then
    slug="$fallback"
  fi
  printf '%s' "$slug"
}

base_slug="$(sanitize_slug "$BASE_BRANCH" "base")"
if [[ -z "$STATE_FILE" ]]; then
  STATE_FILE="$repo_root/.omx/state/review-bot-watch-${base_slug}.tsv"
fi
mkdir -p "$(dirname "$STATE_FILE")"

declare -A LAST_SHA

declare -A LAST_STATUS

load_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    return 0
  fi
  while IFS=$'\t' read -r pr sha status updated_at; do
    if [[ -z "${pr:-}" ]] || [[ "${pr:0:1}" == "#" ]]; then
      continue
    fi
    LAST_SHA["$pr"]="$sha"
    LAST_STATUS["$pr"]="$status"
  done < "$STATE_FILE"
}

save_state() {
  {
    echo "# pr\thead_sha\tstatus\tupdated_at"
    for pr in "${!LAST_SHA[@]}"; do
      printf '%s\t%s\t%s\t%s\n' "${pr}" "${LAST_SHA[$pr]}" "${LAST_STATUS[$pr]:-unknown}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    done | sort -n
  } > "$STATE_FILE"
}

build_prompt() {
  local pr="$1"
  local head_branch="$2"
  local head_sha="$3"
  local pr_title="$4"
  local pr_url="$5"

  cat <<PROMPT
You are the continuous PR review+merge Codex agent.

Target PR: #${pr}
URL: ${pr_url}
Title: ${pr_title}
Base branch: ${BASE_BRANCH}
Head branch: ${head_branch}
Head SHA: ${head_sha}

Strict task:
1) Review ONLY this PR's changes using gh CLI context (gh pr view ${pr}, gh pr diff ${pr}).
2) If fixes are needed, implement them in your sandbox branch, run verification (at minimum npm test when available), and push your sandbox branch.
3) When the PR is ready and checks are green, merge this PR into ${BASE_BRANCH} with:
   gh pr merge ${pr} --squash --delete-branch
4) If merge is blocked, explain the blocker and exit non-zero.
5) Do not touch unrelated PRs.
PROMPT

  if [[ -n "${MUSAFETY_REVIEW_BOT_PROMPT_APPEND:-}" ]]; then
    printf '\n%s\n' "${MUSAFETY_REVIEW_BOT_PROMPT_APPEND}"
  fi
}

list_open_prs() {
  gh pr list \
    --state open \
    --base "$BASE_BRANCH" \
    --json number,headRefName,headRefOid,isDraft,title,url \
    --jq '.[] | "\(.number)\t\(.headRefName)\t\(.headRefOid)\t\(.isDraft)\t\(.title | gsub("\\t"; " "))\t\(.url)"'
}

should_process_pr() {
  local pr="$1"
  local sha="$2"

  local prev_sha="${LAST_SHA[$pr]:-}"
  local prev_status="${LAST_STATUS[$pr]:-}"

  if [[ -z "$prev_sha" ]]; then
    return 0
  fi

  if [[ "$prev_sha" != "$sha" ]]; then
    return 0
  fi

  if [[ "$prev_status" == "failed" && "$RETRY_FAILED" == "1" ]]; then
    return 0
  fi

  return 1
}

process_one_pr() {
  local pr="$1"
  local head_branch="$2"
  local sha="$3"
  local title="$4"
  local url="$5"

  local prompt
  prompt="$(build_prompt "$pr" "$head_branch" "$sha" "$title" "$url")"

  local task_name="${TASK_PREFIX}-pr-${pr}"

  echo "[review-bot-watch] Dispatching Codex agent for PR #${pr} (${head_branch})"
  set +e
  bash "$repo_root/scripts/codex-agent.sh" \
    --task "$task_name" \
    --agent "$AGENT_NAME" \
    --base "$BASE_BRANCH" \
    -- exec "$prompt"
  local exit_code="$?"
  set -e

  LAST_SHA["$pr"]="$sha"
  if [[ "$exit_code" -eq 0 ]]; then
    LAST_STATUS["$pr"]="success"
    echo "[review-bot-watch] PR #${pr}: success"
  else
    LAST_STATUS["$pr"]="failed"
    echo "[review-bot-watch] PR #${pr}: failed (exit=${exit_code})" >&2
  fi

  save_state
}

load_state

echo "[review-bot-watch] Starting monitor"
echo "[review-bot-watch] Base branch : ${BASE_BRANCH}"
echo "[review-bot-watch] Interval    : ${INTERVAL_SECONDS}s"
echo "[review-bot-watch] State file  : ${STATE_FILE}"
if [[ -n "$ONLY_PR" ]]; then
  echo "[review-bot-watch] Only PR      : #${ONLY_PR}"
fi

trap 'echo "[review-bot-watch] Stopped."; exit 0' INT TERM

while true; do
  found=0
  while IFS=$'\t' read -r pr head_branch sha is_draft title url; do
    if [[ -z "${pr:-}" ]]; then
      continue
    fi

    found=1

    if [[ -n "$ONLY_PR" && "$pr" != "$ONLY_PR" ]]; then
      continue
    fi

    if [[ "$INCLUDE_DRAFT" != "1" && "$is_draft" == "true" ]]; then
      continue
    fi

    if ! should_process_pr "$pr" "$sha"; then
      continue
    fi

    process_one_pr "$pr" "$head_branch" "$sha" "$title" "$url"
  done < <(list_open_prs || true)

  if [[ "$found" -eq 0 ]]; then
    echo "[review-bot-watch] No open PRs for base '${BASE_BRANCH}'."
  fi

  if [[ "$ONCE" -eq 1 ]]; then
    break
  fi

  sleep "$INTERVAL_SECONDS"
done
