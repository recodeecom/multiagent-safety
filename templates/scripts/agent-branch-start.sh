#!/usr/bin/env bash
set -euo pipefail

TASK_NAME="task"
AGENT_NAME="agent"
BASE_BRANCH=""
BASE_BRANCH_EXPLICIT=0
WORKTREE_ROOT_REL=".omx/agent-worktrees"
OPENSPEC_AUTO_INIT_RAW="${MUSAFETY_OPENSPEC_AUTO_INIT:-false}"
OPENSPEC_PLAN_SLUG_OVERRIDE="${MUSAFETY_OPENSPEC_PLAN_SLUG:-}"
OPENSPEC_CHANGE_SLUG_OVERRIDE="${MUSAFETY_OPENSPEC_CHANGE_SLUG:-}"
OPENSPEC_CAPABILITY_SLUG_OVERRIDE="${MUSAFETY_OPENSPEC_CAPABILITY_SLUG:-}"
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
      BASE_BRANCH="${2:-}"
      BASE_BRANCH_EXPLICIT=1
      shift 2
      ;;
    --in-place|--allow-in-place)
      echo "[agent-branch-start] In-place branch mode is disabled." >&2
      echo "[agent-branch-start] This command always creates an isolated worktree to keep your active checkout unchanged." >&2
      exit 1
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
      echo "Usage: $0 [task] [agent] [base] [--worktree-root <path>]" >&2
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
  echo "Usage: $0 [task] [agent] [base] [--worktree-root <path>]" >&2
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
  BASE_BRANCH_EXPLICIT=1
fi

sanitize_slug() {
  local raw="$1"
  local fallback="${2:-task}"
  local slug
  slug="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"
  if [[ -z "$slug" ]]; then
    slug="$fallback"
  fi
  printf '%s' "$slug"
}

sanitize_optional_slug() {
  local raw="$1"
  local fallback="${2:-snapshot}"
  if [[ -z "$raw" ]]; then
    printf ''
    return 0
  fi
  sanitize_slug "$raw" "$fallback"
}

normalize_positive_int() {
  local raw="$1"
  local fallback="$2"
  if [[ "$raw" =~ ^[0-9]+$ ]] && [[ "$raw" -gt 0 ]]; then
    printf '%s' "$raw"
    return 0
  fi
  printf '%s' "$fallback"
}

shorten_slug() {
  local slug="$1"
  local raw_max="$2"
  local max_len
  max_len="$(normalize_positive_int "$raw_max" "32")"
  if [[ "${#slug}" -le "$max_len" ]]; then
    printf '%s' "$slug"
    return 0
  fi
  local shortened="${slug:0:max_len}"
  shortened="$(printf '%s' "$shortened" | sed -E 's/-+$//')"
  if [[ -z "$shortened" ]]; then
    shortened="${slug:0:max_len}"
  fi
  printf '%s' "$shortened"
}

checksum_slug_suffix() {
  local raw="$1"
  local checksum
  checksum="$(printf '%s' "$raw" | cksum | awk '{print $1}')"
  printf '%s' "${checksum:0:6}"
}

compose_branch_descriptor() {
  local snapshot_slug="$1"
  local task_slug="$2"
  local snapshot_max task_max task_part snapshot_part checksum_input checksum_part
  snapshot_max="$(normalize_positive_int "${MUSAFETY_BRANCH_SNAPSHOT_SLUG_MAX:-18}" "18")"
  task_max="$(normalize_positive_int "${MUSAFETY_BRANCH_TASK_SLUG_MAX:-36}" "36")"
  task_part="$(shorten_slug "$task_slug" "$task_max")"
  if [[ -n "$snapshot_slug" ]]; then
    snapshot_part="$(shorten_slug "$snapshot_slug" "$snapshot_max")"
    checksum_input="${snapshot_slug}--${task_slug}"
    checksum_part="$(checksum_slug_suffix "$checksum_input")"
    printf '%s-%s-%s' "$snapshot_part" "$task_part" "$checksum_part"
    return 0
  fi
  checksum_part="$(checksum_slug_suffix "$task_slug")"
  printf '%s-%s' "$task_part" "$checksum_part"
}

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

OPENSPEC_AUTO_INIT="$(normalize_bool "$OPENSPEC_AUTO_INIT_RAW" "1")"

resolve_openspec_plan_slug() {
  local branch_name="$1"
  local task_slug="$2"
  if [[ -n "$OPENSPEC_PLAN_SLUG_OVERRIDE" ]]; then
    sanitize_slug "$OPENSPEC_PLAN_SLUG_OVERRIDE" "$task_slug"
    return 0
  fi
  sanitize_slug "${branch_name//\//-}" "$task_slug"
}

resolve_openspec_change_slug() {
  local branch_name="$1"
  local task_slug="$2"
  if [[ -n "$OPENSPEC_CHANGE_SLUG_OVERRIDE" ]]; then
    sanitize_slug "$OPENSPEC_CHANGE_SLUG_OVERRIDE" "$task_slug"
    return 0
  fi
  sanitize_slug "${branch_name//\//-}" "$task_slug"
}

resolve_openspec_capability_slug() {
  local task_slug="$1"
  if [[ -n "$OPENSPEC_CAPABILITY_SLUG_OVERRIDE" ]]; then
    sanitize_slug "$OPENSPEC_CAPABILITY_SLUG_OVERRIDE" "$task_slug"
    return 0
  fi
  sanitize_slug "$task_slug" "general-behavior"
}

resolve_active_codex_snapshot_name() {
  local override="${MUSAFETY_CODEX_AUTH_SNAPSHOT:-}"
  if [[ -n "$override" ]]; then
    printf '%s' "$override"
    return 0
  fi

  local codex_auth_bin="${MUSAFETY_CODEX_AUTH_BIN:-codex-auth}"
  if ! command -v "$codex_auth_bin" >/dev/null 2>&1; then
    return 0
  fi

  "$codex_auth_bin" list 2>/dev/null \
    | sed -n 's/^[[:space:]]*\*[[:space:]]\+//p' \
    | head -n 1 \
    | tr -d '\r' || true
}

has_local_changes() {
  local root="$1"
  if ! git -C "$root" diff --quiet; then
    return 0
  fi
  if ! git -C "$root" diff --cached --quiet; then
    return 0
  fi
  if [[ -n "$(git -C "$root" ls-files --others --exclude-standard)" ]]; then
    return 0
  fi
  return 1
}

resolve_protected_branches() {
  local root="$1"
  local raw
  raw="${MUSAFETY_PROTECTED_BRANCHES:-$(git -C "$root" config --get multiagent.protectedBranches || true)}"
  if [[ -z "$raw" ]]; then
    raw="dev main master"
  fi
  raw="${raw//,/ }"
  printf '%s' "$raw"
}

is_protected_branch_name() {
  local branch="$1"
  local protected_raw="$2"
  for protected_branch in $protected_raw; do
    if [[ "$branch" == "$protected_branch" ]]; then
      return 0
    fi
  done
  return 1
}

hydrate_local_helper_in_worktree() {
  local repo="$1"
  local worktree="$2"
  local relative_path="$3"
  local worktree_target="${worktree}/${relative_path}"
  local source_path=""

  if [[ -e "$worktree_target" ]]; then
    return 0
  fi

  if [[ -f "${repo}/${relative_path}" ]]; then
    source_path="${repo}/${relative_path}"
  elif [[ -f "${repo}/templates/${relative_path}" ]]; then
    source_path="${repo}/templates/${relative_path}"
  fi

  if [[ -z "$source_path" ]]; then
    return 0
  fi

  mkdir -p "$(dirname "$worktree_target")"
  cp "$source_path" "$worktree_target"
  if [[ -x "$source_path" ]]; then
    chmod +x "$worktree_target"
  fi

  echo "[agent-branch-start] Hydrated local helper in worktree: ${relative_path}"
}

hydrate_dependency_dir_symlink_in_worktree() {
  local repo="$1"
  local worktree="$2"
  local relative_path="$3"
  local source_path="${repo}/${relative_path}"
  local target_path="${worktree}/${relative_path}"

  if [[ ! -d "$source_path" ]]; then
    return 0
  fi

  if [[ -e "$target_path" ]]; then
    return 0
  fi

  mkdir -p "$(dirname "$target_path")"
  ln -s "$source_path" "$target_path"
  echo "[agent-branch-start] Linked dependency dir in worktree: ${relative_path}"
}

initialize_openspec_plan_workspace() {
  local repo="$1"
  local worktree="$2"
  local plan_slug="$3"

  hydrate_local_helper_in_worktree "$repo" "$worktree" "scripts/openspec/init-plan-workspace.sh"

  if [[ "$OPENSPEC_AUTO_INIT" -ne 1 ]]; then
    return 0
  fi

  local openspec_script="${worktree}/scripts/openspec/init-plan-workspace.sh"
  if [[ ! -f "$openspec_script" ]]; then
    echo "[agent-branch-start] OpenSpec init script is missing in sandbox worktree." >&2
    echo "[agent-branch-start] Run 'gx setup --target \"$repo\"' to repair templates, then retry." >&2
    return 1
  fi
  if [[ ! -x "$openspec_script" ]]; then
    chmod +x "$openspec_script" 2>/dev/null || true
  fi

  local init_output=""
  if ! init_output="$(
    cd "$worktree"
    bash "scripts/openspec/init-plan-workspace.sh" "$plan_slug" 2>&1
  )"; then
    printf '%s\n' "$init_output" >&2
    echo "[agent-branch-start] OpenSpec workspace initialization failed for plan '${plan_slug}'." >&2
    return 1
  fi

  if [[ -n "$init_output" ]]; then
    printf '%s\n' "$init_output"
  fi
  echo "[agent-branch-start] OpenSpec plan workspace: ${worktree}/openspec/plan/${plan_slug}"
}

initialize_openspec_change_workspace() {
  local repo="$1"
  local worktree="$2"
  local change_slug="$3"
  local capability_slug="$4"

  hydrate_local_helper_in_worktree "$repo" "$worktree" "scripts/openspec/init-change-workspace.sh"

  if [[ "$OPENSPEC_AUTO_INIT" -ne 1 ]]; then
    return 0
  fi

  local openspec_script="${worktree}/scripts/openspec/init-change-workspace.sh"
  if [[ ! -f "$openspec_script" ]]; then
    echo "[agent-branch-start] OpenSpec change init script is missing in sandbox worktree." >&2
    echo "[agent-branch-start] Run 'gx setup --target \"$repo\"' to repair templates, then retry." >&2
    return 1
  fi
  if [[ ! -x "$openspec_script" ]]; then
    chmod +x "$openspec_script" 2>/dev/null || true
  fi

  local init_output=""
  if ! init_output="$(
    cd "$worktree"
    bash "scripts/openspec/init-change-workspace.sh" "$change_slug" "$capability_slug" 2>&1
  )"; then
    printf '%s\n' "$init_output" >&2
    echo "[agent-branch-start] OpenSpec workspace initialization failed for change '${change_slug}'." >&2
    return 1
  fi

  if [[ -n "$init_output" ]]; then
    printf '%s\n' "$init_output"
  fi
  echo "[agent-branch-start] OpenSpec change workspace: ${worktree}/openspec/changes/${change_slug}"
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[agent-branch-start] Not inside a git repository." >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"

if [[ "$BASE_BRANCH_EXPLICIT" -eq 1 && -z "$BASE_BRANCH" ]]; then
  echo "[agent-branch-start] --base requires a non-empty branch name." >&2
  exit 1
fi

if [[ "$BASE_BRANCH_EXPLICIT" -eq 0 ]]; then
  current_branch="$(git -C "$repo_root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  protected_branches_raw="$(resolve_protected_branches "$repo_root")"
  if [[ -n "$current_branch" && "$current_branch" != "HEAD" ]] && is_protected_branch_name "$current_branch" "$protected_branches_raw"; then
    BASE_BRANCH="$current_branch"
  else
    configured_base="$(git -C "$repo_root" config --get multiagent.baseBranch || true)"
    if [[ -n "$configured_base" ]]; then
      BASE_BRANCH="$configured_base"
    elif [[ -n "$current_branch" && "$current_branch" != "HEAD" ]]; then
      BASE_BRANCH="$current_branch"
    else
      BASE_BRANCH="dev"
    fi
  fi
fi

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

task_slug="$(sanitize_slug "$TASK_NAME" "task")"
agent_slug_raw="$(sanitize_slug "$AGENT_NAME" "agent")"
agent_slug="$(shorten_slug "$agent_slug_raw" "${MUSAFETY_BRANCH_AGENT_SLUG_MAX:-24}")"
snapshot_name="$(resolve_active_codex_snapshot_name)"
snapshot_slug="$(sanitize_optional_slug "$snapshot_name" "snapshot")"
branch_descriptor="$(compose_branch_descriptor "$snapshot_slug" "$task_slug")"
timestamp="$(date +%Y%m%d-%H%M%S)"
branch_name_base="agent/${agent_slug}/${branch_descriptor}"

branch_name="$branch_name_base"
branch_suffix=2
while git show-ref --verify --quiet "refs/heads/${branch_name}"; do
  branch_name="${branch_name_base}-${branch_suffix}"
  branch_suffix=$((branch_suffix + 1))
done

worktree_root="${repo_root}/${WORKTREE_ROOT_REL}"
mkdir -p "$worktree_root"
worktree_path="${worktree_root}/${branch_name//\//__}"
openspec_plan_slug="$(resolve_openspec_plan_slug "$branch_name" "$task_slug")"
openspec_change_slug="$(resolve_openspec_change_slug "$branch_name" "$task_slug")"
openspec_capability_slug="$(resolve_openspec_capability_slug "$task_slug")"

if [[ -e "$worktree_path" ]]; then
  echo "[agent-branch-start] Worktree path already exists: ${worktree_path}" >&2
  exit 1
fi

auto_transfer_stash_ref=""
auto_transfer_message=""
auto_transfer_source_branch=""
current_branch="$(git -C "$repo_root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
protected_branches_raw="$(resolve_protected_branches "$repo_root")"
if [[ -n "$current_branch" && "$current_branch" != "HEAD" ]] && is_protected_branch_name "$current_branch" "$protected_branches_raw"; then
  if has_local_changes "$repo_root"; then
    auto_transfer_message="musafety-auto-transfer-${timestamp}-${agent_slug}-${task_slug}"
    if git -C "$repo_root" stash push --include-untracked --message "$auto_transfer_message" >/dev/null 2>&1; then
      auto_transfer_stash_ref="$(
        git -C "$repo_root" stash list \
          | awk -v msg="$auto_transfer_message" '$0 ~ msg { ref=$1; sub(/:$/, "", ref); print ref; exit }'
      )"
      if [[ -n "$auto_transfer_stash_ref" ]]; then
        auto_transfer_source_branch="$current_branch"
        echo "[agent-branch-start] Detected local changes on protected branch '${current_branch}'. Moving them to '${branch_name}'..."
      fi
    fi
  fi
fi

git -C "$repo_root" worktree add -b "$branch_name" "$worktree_path" "$start_ref"
git -C "$repo_root" config "branch.${branch_name}.musafetyBase" "$BASE_BRANCH" >/dev/null 2>&1 || true

if git -C "$repo_root" show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
  git -C "$worktree_path" branch --set-upstream-to="origin/${BASE_BRANCH}" "$branch_name" >/dev/null 2>&1 || true
fi

if [[ -n "$auto_transfer_stash_ref" ]]; then
  if git -C "$worktree_path" stash apply "$auto_transfer_stash_ref" >/dev/null 2>&1; then
    git -C "$repo_root" stash drop "$auto_transfer_stash_ref" >/dev/null 2>&1 || true
    transfer_label="${auto_transfer_source_branch:-$BASE_BRANCH}"
    echo "[agent-branch-start] Moved local changes from '${transfer_label}' into '${branch_name}'."
  else
    echo "[agent-branch-start] Failed to auto-apply moved changes in new worktree." >&2
    transfer_label="${auto_transfer_source_branch:-$BASE_BRANCH}"
    echo "[agent-branch-start] Changes are preserved in ${auto_transfer_stash_ref} on ${transfer_label}." >&2
    echo "[agent-branch-start] Apply manually with: git -C \"$worktree_path\" stash apply \"${auto_transfer_stash_ref}\"" >&2
    exit 1
  fi
fi

hydrate_local_helper_in_worktree "$repo_root" "$worktree_path" "scripts/codex-agent.sh"
hydrate_dependency_dir_symlink_in_worktree "$repo_root" "$worktree_path" "node_modules"
hydrate_dependency_dir_symlink_in_worktree "$repo_root" "$worktree_path" "apps/frontend/node_modules"
hydrate_dependency_dir_symlink_in_worktree "$repo_root" "$worktree_path" "apps/backend/node_modules"
if ! initialize_openspec_change_workspace "$repo_root" "$worktree_path" "$openspec_change_slug" "$openspec_capability_slug"; then
  exit 1
fi
if ! initialize_openspec_plan_workspace "$repo_root" "$worktree_path" "$openspec_plan_slug"; then
  exit 1
fi

echo "[agent-branch-start] Created branch: ${branch_name}"
echo "[agent-branch-start] Worktree: ${worktree_path}"
echo "[agent-branch-start] OpenSpec change: openspec/changes/${openspec_change_slug}"
echo "[agent-branch-start] OpenSpec plan: openspec/plan/${openspec_plan_slug}"
echo "[agent-branch-start] Next steps:"
echo "  cd \"${worktree_path}\""
echo "  python3 scripts/agent-file-locks.py claim --branch \"${branch_name}\" <file...>"
echo "  # implement + commit"
echo "  bash scripts/agent-branch-finish.sh --branch \"${branch_name}\" --base dev --via-pr --wait-for-merge"
