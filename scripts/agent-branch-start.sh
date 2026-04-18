#!/usr/bin/env bash
set -euo pipefail

TASK_NAME="task"
AGENT_NAME="agent"
BASE_BRANCH=""
BASE_BRANCH_EXPLICIT=0
WORKTREE_ROOT_REL=".omx/agent-worktrees"
OPENSPEC_AUTO_INIT_RAW="${GX_OPENSPEC_AUTO_INIT:-${MUSAFETY_OPENSPEC_AUTO_INIT:-true}}"
GH_SYNC_ON_START_RAW="${MUSAFETY_GH_SYNC_ON_START:-true}"
OPENSPEC_PLAN_SLUG_OVERRIDE="${MUSAFETY_OPENSPEC_PLAN_SLUG:-}"
OPENSPEC_CHANGE_SLUG_OVERRIDE="${MUSAFETY_OPENSPEC_CHANGE_SLUG:-}"
OPENSPEC_CAPABILITY_SLUG_OVERRIDE="${MUSAFETY_OPENSPEC_CAPABILITY_SLUG:-}"
PR_REF="${MUSAFETY_GH_PR_REF:-}"
GH_REPO_REF="${MUSAFETY_GH_REPO:-}"
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
    --pr)
      PR_REF="${2:-}"
      shift 2
      ;;
    --repo)
      GH_REPO_REF="${2:-}"
      shift 2
      ;;
    --gh-sync)
      GH_SYNC_ON_START_RAW="true"
      shift
      ;;
    --no-gh-sync)
      GH_SYNC_ON_START_RAW="false"
      shift
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
      echo "Usage: $0 [task] [agent] [base] [--worktree-root <path>] [--pr <ref>] [--repo <owner/name>] [--gh-sync|--no-gh-sync]" >&2
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
  echo "Usage: $0 [task] [agent] [base] [--worktree-root <path>] [--pr <ref>] [--repo <owner/name>] [--gh-sync|--no-gh-sync]" >&2
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
GH_SYNC_ON_START="$(normalize_bool "$GH_SYNC_ON_START_RAW" "1")"

is_helper_agent_base_branch() {
  local base_branch="$1"
  [[ "$base_branch" == agent/* ]]
}

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

branch_exists_locally_or_on_origin() {
  local root="$1"
  local branch="$2"
  if git -C "$root" show-ref --verify --quiet "refs/heads/${branch}"; then
    return 0
  fi
  if git -C "$root" show-ref --verify --quiet "refs/remotes/origin/${branch}"; then
    return 0
  fi
  return 1
}

resolve_default_base_branch_for_agent_subbranch() {
  local root="$1"
  local protected_raw="$2"
  local configured_base candidate

  configured_base="$(git -C "$root" config --get multiagent.baseBranch || true)"
  if [[ -n "$configured_base" ]] && branch_exists_locally_or_on_origin "$root" "$configured_base"; then
    printf '%s' "$configured_base"
    return 0
  fi

  for candidate in $protected_raw; do
    if branch_exists_locally_or_on_origin "$root" "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
  done

  if branch_exists_locally_or_on_origin "$root" "dev"; then
    printf 'dev'
    return 0
  fi
  if branch_exists_locally_or_on_origin "$root" "main"; then
    printf 'main'
    return 0
  fi
  if branch_exists_locally_or_on_origin "$root" "master"; then
    printf 'master'
    return 0
  fi
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
  normalize_openspec_change_cleanup_instruction "$worktree" "$change_slug"
  echo "[agent-branch-start] OpenSpec change workspace: ${worktree}/openspec/changes/${change_slug}"
}

normalize_openspec_change_cleanup_instruction() {
  local worktree="$1"
  local change_slug="$2"
  local tasks_file="${worktree}/openspec/changes/${change_slug}/tasks.md"

  if [[ ! -f "$tasks_file" ]]; then
    return 0
  fi

  sed -i -E 's#^- \[[ xX]\] 4\.3 .*$#- [ ] 4.3 After successful merge, run `bash scripts/agent-worktree-prune.sh --base <base> --delete-branches --delete-remote-branches` so merged agent branch/worktree sandboxes are removed from local and `origin`.#' "$tasks_file"
}

filtered_status_output() {
  local wt="$1"
  git -C "$wt" status --porcelain --untracked-files=normal -- \
    . \
    ":(exclude).omx/state/agent-file-locks.json" \
    ":(exclude).dev-ports.json" \
    ":(exclude)apps/logs/*.log"
}

resolve_worktree_git_dir() {
  local wt="$1"
  local git_dir=""
  git_dir="$(git -C "$wt" rev-parse --git-dir 2>/dev/null || true)"
  if [[ -z "$git_dir" ]]; then
    return 1
  fi
  if [[ "$git_dir" == /* ]]; then
    git_dir="$(cd "$git_dir" 2>/dev/null && pwd -P || true)"
  else
    git_dir="$(cd "$wt/$git_dir" 2>/dev/null && pwd -P || true)"
  fi
  if [[ -z "$git_dir" ]]; then
    return 1
  fi
  printf '%s' "$git_dir"
}

bootstrap_manifest_path_for_worktree() {
  local wt="$1"
  local git_dir=""
  git_dir="$(resolve_worktree_git_dir "$wt" || true)"
  if [[ -z "$git_dir" ]]; then
    return 1
  fi
  printf '%s/musafety-bootstrap-manifest.json' "$git_dir"
}

record_worktree_bootstrap_manifest() {
  local worktree="$1"
  local branch="$2"
  local base_branch="$3"
  local change_slug="$4"
  local plan_slug="$5"
  local manifest_path=""
  local status_output=""

  manifest_path="$(bootstrap_manifest_path_for_worktree "$worktree" || true)"
  if [[ -z "$manifest_path" ]]; then
    return 0
  fi

  status_output="$(filtered_status_output "$worktree")"
  STATUS_OUTPUT="$status_output" python3 - "$worktree" "$manifest_path" "$branch" "$base_branch" "$change_slug" "$plan_slug" <<'PY'
from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def parse_status_paths(raw: str) -> list[str]:
    paths: list[str] = []
    for line in raw.splitlines():
        if len(line) < 4:
            continue
        path_part = line[3:]
        if " -> " in path_part:
            path_part = path_part.split(" -> ", 1)[1]
        path_part = path_part.strip()
        if path_part:
            paths.append(path_part)
    return sorted(set(paths))


def sha256_for_file(path: Path) -> str | None:
    if not path.exists() or not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


if len(sys.argv) != 7:
    sys.exit(1)

worktree_root = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])
branch_name = sys.argv[3]
base_branch = sys.argv[4]
change_slug = sys.argv[5]
plan_slug = sys.argv[6]

status_paths = parse_status_paths(os.environ.get("STATUS_OUTPUT", ""))
entries: list[dict[str, object]] = []
for rel_path in status_paths:
    file_path = worktree_root / rel_path
    entries.append(
        {
            "path": rel_path,
            "sha256": sha256_for_file(file_path),
        }
    )

payload = {
    "version": 1,
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "branch": branch_name,
    "baseBranch": base_branch,
    "changeSlug": change_slug,
    "planSlug": plan_slug,
    "files": entries,
}

manifest_path.parent.mkdir(parents=True, exist_ok=True)
manifest_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY
  echo "[agent-branch-start] Bootstrap manifest: ${manifest_path}"
}

worktree_matches_bootstrap_manifest() {
  local worktree="$1"
  local manifest_path=""
  local status_output=""

  manifest_path="$(bootstrap_manifest_path_for_worktree "$worktree" || true)"
  if [[ -z "$manifest_path" || ! -f "$manifest_path" ]]; then
    return 1
  fi

  status_output="$(filtered_status_output "$worktree")"
  if [[ -z "$status_output" ]]; then
    return 1
  fi

  STATUS_OUTPUT="$status_output" python3 - "$worktree" "$manifest_path" <<'PY'
from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path


def parse_status_paths(raw: str) -> list[str]:
    paths: list[str] = []
    for line in raw.splitlines():
        if len(line) < 4:
            continue
        path_part = line[3:]
        if " -> " in path_part:
            path_part = path_part.split(" -> ", 1)[1]
        path_part = path_part.strip()
        if path_part:
            paths.append(path_part)
    return sorted(set(paths))


def sha256_for_file(path: Path) -> str | None:
    if not path.exists() or not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


if len(sys.argv) != 3:
    sys.exit(1)

worktree_root = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])

status_paths = parse_status_paths(os.environ.get("STATUS_OUTPUT", ""))
if not status_paths:
    sys.exit(1)

try:
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
except Exception:
    sys.exit(1)

entries = payload.get("files")
if not isinstance(entries, list):
    sys.exit(1)

manifest_by_path: dict[str, str | None] = {}
for entry in entries:
    if not isinstance(entry, dict):
        continue
    path_value = entry.get("path")
    if not isinstance(path_value, str) or not path_value:
        continue
    sha_value = entry.get("sha256")
    if sha_value is not None and not isinstance(sha_value, str):
        continue
    manifest_by_path[path_value] = sha_value

if not manifest_by_path:
    sys.exit(1)

for rel_path in status_paths:
    if rel_path not in manifest_by_path:
        sys.exit(1)
    current_sha = sha256_for_file(worktree_root / rel_path)
    if current_sha != manifest_by_path.get(rel_path):
        sys.exit(1)

sys.exit(0)
PY
}

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
    && git -C "$wt" diff --cached --quiet -- . ":(exclude).omx/state/agent-file-locks.json" \
    && [[ -z "$(git -C "$wt" ls-files --others --exclude-standard)" ]]
}

json_escape() {
  local raw="$1"
  raw="${raw//\\/\\\\}"
  raw="${raw//\"/\\\"}"
  raw="${raw//$'\n'/\\n}"
  printf '%s' "$raw"
}

link_worktree_mem0_compat_file() {
  local mem0_file="$1"
  local compat_file="$2"
  local compat_target="$3"

  mkdir -p "$(dirname "$compat_file")"
  if [[ -e "$compat_file" ]]; then
    return 0
  fi

  if ln -s "$compat_target" "$compat_file" >/dev/null 2>&1; then
    return 0
  fi

  cp "$mem0_file" "$compat_file"
}

initialize_worktree_mem0_layer() {
  local worktree="$1"
  local branch="$2"
  local base_branch="$3"
  local task_slug="$4"
  local agent_slug="$5"

  local omx_dir="${worktree}/.omx"
  local mem0_dir="${omx_dir}/mem0"
  local notepad_path="${mem0_dir}/notepad.md"
  local project_memory_path="${mem0_dir}/project-memory.json"
  local scope_path="${mem0_dir}/worktree-scope.json"
  local created_at
  local now

  mkdir -p "$mem0_dir"

  if [[ ! -f "$notepad_path" ]]; then
    cat >"$notepad_path" <<EOF
# Mem0 Worktree Memory

- Scope: worktree
- Branch: ${branch}
- Base: ${base_branch}
- Task: ${task_slug}
- Agent: ${agent_slug}

## WORKING MEMORY
EOF
  fi

  if [[ ! -f "$project_memory_path" ]]; then
    created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    cat >"$project_memory_path" <<EOF
{
  "version": 1,
  "scope": "worktree",
  "branch": "$(json_escape "$branch")",
  "baseBranch": "$(json_escape "$base_branch")",
  "taskSlug": "$(json_escape "$task_slug")",
  "agentSlug": "$(json_escape "$agent_slug")",
  "createdAt": "$(json_escape "$created_at")",
  "notes": [],
  "directives": []
}
EOF
  fi

  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cat >"$scope_path" <<EOF
{
  "version": 1,
  "scope": "worktree",
  "branch": "$(json_escape "$branch")",
  "baseBranch": "$(json_escape "$base_branch")",
  "taskSlug": "$(json_escape "$task_slug")",
  "agentSlug": "$(json_escape "$agent_slug")",
  "worktreePath": "$(json_escape "$worktree")",
  "updatedAt": "$(json_escape "$now")",
  "notepadPath": ".omx/mem0/notepad.md",
  "projectMemoryPath": ".omx/mem0/project-memory.json"
}
EOF

  link_worktree_mem0_compat_file "$notepad_path" "${omx_dir}/notepad.md" "mem0/notepad.md"
  link_worktree_mem0_compat_file "$project_memory_path" "${omx_dir}/project-memory.json" "mem0/project-memory.json"
  echo "[agent-branch-start] Mem0 worktree memory: ${mem0_dir}"
}

run_startup_context_artifacts() {
  local repo="$1"
  local worktree="$2"
  local branch="$3"
  local base_branch="$4"
  local pr_ref="$5"
  local repo_ref="$6"
  local branch_slug
  local github_context_dir="${worktree}/.omx/context/github"
  local merge_gate_dir="${worktree}/.omx/state/merge-gates"
  local context_pack_dir="${worktree}/.omx/context/packs"
  local context_json=""
  local conflict_json=""
  local context_pack_json=""
  local conflict_passed=1

  mkdir -p "$github_context_dir" "$merge_gate_dir" "$context_pack_dir"
  branch_slug="$(sanitize_slug "${branch//\//-}" "context-pack")"

  if [[ "$GH_SYNC_ON_START" -eq 1 ]]; then
    if [[ -x "${repo}/scripts/omx-gh-sync.sh" ]]; then
      local sync_args=(--branch "$branch" --output-dir "$github_context_dir")
      if [[ -n "$pr_ref" ]]; then
        sync_args+=(--pr "$pr_ref")
      fi
      if [[ -n "$repo_ref" ]]; then
        sync_args+=(--repo "$repo_ref")
      fi
      local sync_output=""
      if sync_output="$(bash "${repo}/scripts/omx-gh-sync.sh" "${sync_args[@]}" 2>&1)"; then
        printf '%s\n' "$sync_output"
        context_json="$(printf '%s\n' "$sync_output" | sed -n 's/^Context JSON: //p' | tail -n1)"
      else
        echo "[agent-branch-start] Warning: GitHub context sync failed; continuing with local-only startup context." >&2
        printf '%s\n' "$sync_output" >&2
      fi
    else
      echo "[agent-branch-start] Warning: scripts/omx-gh-sync.sh is missing; skipping GitHub context sync." >&2
    fi
  else
    echo "[agent-branch-start] GitHub context sync disabled (--no-gh-sync)."
  fi

  if [[ -x "${repo}/scripts/agent-conflict-predict.sh" ]]; then
    local conflict_output=""
    local conflict_args=(--branch "$branch" --base "$base_branch" --output-dir "$merge_gate_dir")
    if conflict_output="$(bash "${repo}/scripts/agent-conflict-predict.sh" "${conflict_args[@]}" 2>&1)"; then
      printf '%s\n' "$conflict_output"
      conflict_json="$(printf '%s\n' "$conflict_output" | sed -n 's/^Conflict JSON: //p' | tail -n1)"
    else
      conflict_passed=0
      echo "[agent-branch-start] Warning: conflict predictor reported overlaps/locks before coding begins." >&2
      printf '%s\n' "$conflict_output" >&2
    fi
  fi

  if [[ -x "${repo}/scripts/omx-context-pack.sh" ]]; then
    local pack_args=(
      --slug "$branch_slug"
      --branch "$branch"
      --base "$base_branch"
      --output-dir "$context_pack_dir"
    )
    if [[ -n "$context_json" ]]; then
      pack_args+=(--context-file "$context_json")
    fi
    if [[ -n "$conflict_json" ]]; then
      pack_args+=(--conflict-file "$conflict_json")
    fi
    local pack_output=""
    if pack_output="$(bash "${repo}/scripts/omx-context-pack.sh" "${pack_args[@]}" 2>&1)"; then
      printf '%s\n' "$pack_output"
      context_pack_json="$(printf '%s\n' "$pack_output" | sed -n 's/^Context pack JSON: //p' | tail -n1)"
    else
      echo "[agent-branch-start] Warning: context pack assembly failed; continuing without startup pack." >&2
      printf '%s\n' "$pack_output" >&2
    fi
  fi

  python3 - "${github_context_dir}/sandbox-startup-latest.json" "$branch" "$base_branch" "$pr_ref" "$repo_ref" "$GH_SYNC_ON_START" "$conflict_passed" "$context_json" "$conflict_json" "$context_pack_json" <<'PY'
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

(
    _,
    output_path,
    branch_name,
    base_name,
    pr_value,
    repo_value,
    gh_sync_value,
    conflict_value,
    context_json_path,
    conflict_json_path,
    context_pack_path,
) = sys.argv

payload = {
    "version": 1,
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "branch": branch_name,
    "base_branch": base_name,
    "pr": pr_value,
    "repo": repo_value,
    "gh_sync_enabled": int(gh_sync_value),
    "conflict_passed": int(conflict_value),
    "context_json": context_json_path,
    "conflict_json": conflict_json_path,
    "context_pack_json": context_pack_path,
}

target = Path(output_path)
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY

  echo "[agent-branch-start] Startup metadata: ${github_context_dir}/sandbox-startup-latest.json"
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
  configured_base="$(git -C "$repo_root" config --get multiagent.baseBranch || true)"
  if [[ -n "$current_branch" && "$current_branch" != "HEAD" ]] && is_protected_branch_name "$current_branch" "$protected_branches_raw"; then
    BASE_BRANCH="$current_branch"
  elif [[ -n "$current_branch" && "$current_branch" == agent/* ]]; then
    BASE_BRANCH="$current_branch"
    echo "[agent-branch-start] Using current agent branch '${BASE_BRANCH}' as helper base."
  elif [[ -n "$configured_base" ]]; then
    BASE_BRANCH="$configured_base"
  else
    if [[ -n "$current_branch" && "$current_branch" != "HEAD" ]]; then
      BASE_BRANCH="$current_branch"
    else
      BASE_BRANCH="$(resolve_default_base_branch_for_agent_subbranch "$repo_root" "$protected_branches_raw" || printf 'dev')"
    fi
  fi
fi

helper_branch_assist_mode=0
if is_helper_agent_base_branch "$BASE_BRANCH"; then
  helper_branch_assist_mode=1
  OPENSPEC_AUTO_INIT=0
  echo "[agent-branch-start] Helper branch base '${BASE_BRANCH}' detected; skipping OpenSpec auto-init for joined-agent assist."
elif [[ "$OPENSPEC_AUTO_INIT" -ne 1 ]]; then
  echo "[agent-branch-start] OpenSpec auto-init is mandatory for non-helper agent branches; ignoring disabled override." >&2
  OPENSPEC_AUTO_INIT=1
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
worktree_root="${repo_root}/${WORKTREE_ROOT_REL}"
mkdir -p "$worktree_root"
worktree_path=""
reused_existing_worktree=0

if git show-ref --verify --quiet "refs/heads/${branch_name_base}"; then
  existing_worktree_path="$(get_worktree_for_branch "$branch_name_base" || true)"
  if [[ -n "$existing_worktree_path" && -d "$existing_worktree_path" ]] \
    && git -C "$repo_root" merge-base --is-ancestor "$branch_name_base" "$start_ref" >/dev/null 2>&1; then
    if is_clean_worktree "$existing_worktree_path" || worktree_matches_bootstrap_manifest "$existing_worktree_path"; then
      worktree_path="$existing_worktree_path"
      reused_existing_worktree=1
      echo "[agent-branch-start] Reusing untouched sandbox branch/worktree: ${branch_name_base} (${worktree_path})"
    fi
  fi
fi

if [[ "$reused_existing_worktree" -eq 0 ]]; then
  branch_suffix=2
  while git show-ref --verify --quiet "refs/heads/${branch_name}"; do
    branch_name="${branch_name_base}-${branch_suffix}"
    branch_suffix=$((branch_suffix + 1))
  done
  worktree_path="${worktree_root}/${branch_name//\//__}"
  if [[ -e "$worktree_path" ]]; then
    echo "[agent-branch-start] Worktree path already exists: ${worktree_path}" >&2
    exit 1
  fi
fi

openspec_plan_slug="$(resolve_openspec_plan_slug "$branch_name" "$task_slug")"
openspec_change_slug="$(resolve_openspec_change_slug "$branch_name" "$task_slug")"
openspec_capability_slug="$(resolve_openspec_capability_slug "$task_slug")"

primary_branch_before="$(git -C "$repo_root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
protected_branches_raw="$(resolve_protected_branches "$repo_root")"
if [[ -n "$primary_branch_before" && "$primary_branch_before" != "HEAD" ]] && is_protected_branch_name "$primary_branch_before" "$protected_branches_raw"; then
  if has_local_changes "$repo_root"; then
    echo "[agent-branch-start] Detected local changes on protected branch '${primary_branch_before}'. Leaving them in place."
  fi
fi

if [[ "$reused_existing_worktree" -eq 0 ]]; then
  git -C "$repo_root" worktree add -b "$branch_name" "$worktree_path" "$start_ref"
  git -C "$repo_root" config "branch.${branch_name}.musafetyBase" "$BASE_BRANCH" >/dev/null 2>&1 || true

  if git -C "$repo_root" show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
    git -C "$worktree_path" branch --set-upstream-to="origin/${BASE_BRANCH}" "$branch_name" >/dev/null 2>&1 || true
  fi
fi

hydrate_local_helper_in_worktree "$repo_root" "$worktree_path" "scripts/codex-agent.sh"
hydrate_dependency_dir_symlink_in_worktree "$repo_root" "$worktree_path" "node_modules"
hydrate_dependency_dir_symlink_in_worktree "$repo_root" "$worktree_path" "apps/frontend/node_modules"
hydrate_dependency_dir_symlink_in_worktree "$repo_root" "$worktree_path" "apps/backend/node_modules"
if [[ "$reused_existing_worktree" -eq 0 ]]; then
  if ! initialize_openspec_change_workspace "$repo_root" "$worktree_path" "$openspec_change_slug" "$openspec_capability_slug"; then
    exit 1
  fi
  if ! initialize_openspec_plan_workspace "$repo_root" "$worktree_path" "$openspec_plan_slug"; then
    exit 1
  fi
fi
initialize_worktree_mem0_layer "$worktree_path" "$branch_name" "$BASE_BRANCH" "$task_slug" "$agent_slug"

run_startup_context_artifacts "$repo_root" "$worktree_path" "$branch_name" "$BASE_BRANCH" "$PR_REF" "$GH_REPO_REF"
record_worktree_bootstrap_manifest "$worktree_path" "$branch_name" "$BASE_BRANCH" "$openspec_change_slug" "$openspec_plan_slug"

primary_branch_after="$(git -C "$repo_root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ -n "$primary_branch_before" && "$primary_branch_before" != "HEAD" && "$primary_branch_after" != "$primary_branch_before" ]]; then
  echo "[agent-branch-start] Warning: primary checkout moved from '${primary_branch_before}' to '${primary_branch_after}'. Restoring '${primary_branch_before}'."
  git -C "$repo_root" checkout -q "$primary_branch_before"
  primary_branch_after="$(git -C "$repo_root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ "$primary_branch_after" != "$primary_branch_before" ]]; then
    echo "[agent-branch-start] Failed to restore primary checkout branch '${primary_branch_before}'." >&2
    exit 1
  fi
fi

echo "[agent-branch-start] Created branch: ${branch_name}"
echo "[agent-branch-start] Worktree: ${worktree_path}"
if [[ "$helper_branch_assist_mode" -eq 1 ]]; then
  echo "[agent-branch-start] OpenSpec change: skipped (helper branch assisting ${BASE_BRANCH})"
  echo "[agent-branch-start] OpenSpec plan: skipped (helper branch assisting ${BASE_BRANCH})"
else
  echo "[agent-branch-start] OpenSpec change: openspec/changes/${openspec_change_slug}"
  echo "[agent-branch-start] OpenSpec plan: openspec/plan/${openspec_plan_slug}"
fi
echo "[agent-branch-start] Next steps:"
echo "  cd \"${worktree_path}\""
echo "  python3 scripts/agent-file-locks.py claim --branch \"${branch_name}\" <file...>"
echo "  # implement + commit"
echo "  bash scripts/agent-branch-finish.sh --branch \"${branch_name}\" --base ${BASE_BRANCH} --via-pr --wait-for-merge"
