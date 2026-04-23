const {
  path,
  packageJson,
  TOOL_NAME,
  SHORT_TOOL_NAME,
  LEGACY_NAMES,
  GUARDEX_REPO_TOGGLE_ENV,
  CLI_COMMAND_DESCRIPTIONS,
  AGENT_BOT_DESCRIPTIONS,
  DOCTOR_AUTO_FINISH_DETAIL_LIMIT,
  DOCTOR_AUTO_FINISH_BRANCH_LABEL_MAX,
  DOCTOR_AUTO_FINISH_MESSAGE_MAX,
} = require('../context');

function runtimeVersion() {
  return `${packageJson.name}/${packageJson.version} ${process.platform}-${process.arch} node-${process.version}`;
}

function supportsAnsiColors() {
  const forced = String(process.env.FORCE_COLOR || '').trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(forced)) {
    return false;
  }
  if (forced.length > 0) {
    return true;
  }
  if (process.env.NO_COLOR) {
    return false;
  }
  return Boolean(process.stdout.isTTY) && process.env.TERM !== 'dumb';
}

function colorize(text, colorCode) {
  if (!supportsAnsiColors()) {
    return text;
  }
  return `\u001B[${colorCode}m${text}\u001B[0m`;
}

function doctorOutputColorCode(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (['active', 'done', 'ok', 'safe', 'success'].includes(normalized)) {
    return '32';
  }
  if (normalized === 'disabled') {
    return '36';
  }
  if (['degraded', 'pending', 'skip', 'warn', 'warning'].includes(normalized)) {
    return '33';
  }
  if (['error', 'fail', 'inactive', 'unsafe'].includes(normalized)) {
    return '31';
  }
  return null;
}

function colorizeDoctorOutput(text, status) {
  const colorCode = doctorOutputColorCode(status);
  return colorCode ? colorize(text, colorCode) : text;
}

function detectAutoFinishDetailStatus(detail) {
  const trimmed = String(detail || '').trim();
  const match = trimmed.match(/^\[(\w+)\]/);
  if (match) {
    return match[1].toLowerCase();
  }
  if (/^Skipped\b/i.test(trimmed) || /^No local agent branches found\b/i.test(trimmed)) {
    return 'skip';
  }
  return null;
}

function detectAutoFinishSummaryStatus(summary) {
  if (!summary || summary.enabled === false) {
    return detectAutoFinishDetailStatus(summary?.details?.[0]);
  }
  if ((summary.failed || 0) > 0) {
    return 'fail';
  }
  if ((summary.completed || 0) > 0) {
    return 'done';
  }
  if ((summary.skipped || 0) > 0) {
    return 'skip';
  }
  return null;
}

const AUTO_FINISH_DETAIL_PRIORITY = new Map([
  ['fail', 0],
  ['pending', 1],
  ['done', 2],
  ['skip', 3],
]);

function autoFinishDetailPriority(status) {
  return AUTO_FINISH_DETAIL_PRIORITY.get(status) ?? AUTO_FINISH_DETAIL_PRIORITY.size;
}

function sortAutoFinishDetailEntries(details) {
  return details
    .map((detail, index) => {
      const status = detectAutoFinishDetailStatus(detail) || 'other';
      return {
        detail,
        index,
        status,
        priority: autoFinishDetailPriority(status),
      };
    })
    .sort((left, right) => (left.priority - right.priority) || (left.index - right.index));
}

function summarizeHiddenAutoFinishDetails(hiddenEntries) {
  const counts = new Map();
  for (const entry of hiddenEntries) {
    counts.set(entry.status, (counts.get(entry.status) || 0) + 1);
  }

  const segments = ['fail', 'pending', 'done', 'skip', 'other']
    .map((status) => {
      const count = counts.get(status) || 0;
      return count > 0 ? `${status}=${count}` : '';
    })
    .filter(Boolean);

  let status = null;
  if ((counts.get('fail') || 0) > 0) {
    status = 'fail';
  } else if ((counts.get('pending') || 0) > 0) {
    status = 'pending';
  } else if ((counts.get('done') || 0) > 0) {
    status = 'done';
  } else if ((counts.get('skip') || 0) > 0) {
    status = 'skip';
  }

  return {
    status,
    message: `… ${hiddenEntries.length} more branch result(s) hidden: ${segments.join(', ')}. ` +
      'Re-run with --verbose-auto-finish for full details.',
  };
}

function statusDot(status) {
  if (status === 'active') {
    return colorize('●', '32');
  }
  if (status === 'inactive') {
    return colorize('●', '31');
  }
  if (status === 'disabled') {
    return colorize('●', '36');
  }
  return colorize('●', '33');
}

function commandCatalogLines(indent = '  ') {
  const maxCommandLength = CLI_COMMAND_DESCRIPTIONS.reduce(
    (max, [command]) => Math.max(max, command.length),
    0,
  );
  return CLI_COMMAND_DESCRIPTIONS.map(
    ([command, description]) => `${indent}${command.padEnd(maxCommandLength + 2)}${description}`,
  );
}

function agentBotCatalogLines(indent = '  ') {
  const maxCommandLength = AGENT_BOT_DESCRIPTIONS.reduce(
    (max, [command]) => Math.max(max, command.length),
    0,
  );
  return AGENT_BOT_DESCRIPTIONS.map(
    ([command, description]) => `${indent}${command.padEnd(maxCommandLength + 2)}${description}`,
  );
}

function repoToggleLines(indent = '  ') {
  return [
    `${indent}Set repo-root .env: ${GUARDEX_REPO_TOGGLE_ENV}=0 disables Guardex, ${GUARDEX_REPO_TOGGLE_ENV}=1 enables it again`,
  ];
}

function printToolLogsSummary() {
  const usageLine = `    $ ${SHORT_TOOL_NAME} <command> [options]`;
  const commandDetails = commandCatalogLines('    ');
  const agentBotDetails = agentBotCatalogLines('    ');
  const repoToggleDetails = repoToggleLines('    ');

  if (!supportsAnsiColors()) {
    console.log(`${TOOL_NAME}-tools logs:`);
    console.log('  USAGE');
    console.log(usageLine);
    console.log('  COMMANDS');
    for (const line of commandDetails) {
      console.log(line);
    }
    console.log('  AGENT BOT');
    for (const line of agentBotDetails) {
      console.log(line);
    }
    console.log('  REPO TOGGLE');
    for (const line of repoToggleDetails) {
      console.log(line);
    }
    return;
  }

  const title = colorize(`${TOOL_NAME}-tools logs`, '1;36');
  const usageHeader = colorize('USAGE', '1');
  const commandsHeader = colorize('COMMANDS', '1');
  const agentBotHeader = colorize('AGENT BOT', '1');
  const repoToggleHeader = colorize('REPO TOGGLE', '1');
  const pipe = colorize('│', '90');
  const tee = colorize('├', '90');
  const corner = colorize('└', '90');

  console.log(`${title}:`);
  console.log(`  ${tee}─ ${usageHeader}`);
  console.log(`  ${pipe}${usageLine}`);
  console.log(`  ${tee}─ ${commandsHeader}`);
  for (const line of commandDetails) {
    if (!line) {
      console.log(`  ${pipe}`);
      continue;
    }
    console.log(`  ${pipe}${line.slice(2)}`);
  }
  console.log(`  ${tee}─ ${agentBotHeader}`);
  for (const line of agentBotDetails) {
    if (!line) {
      console.log(`  ${pipe}`);
      continue;
    }
    console.log(`  ${pipe}${line.slice(2)}`);
  }
  console.log(`  ${tee}─ ${repoToggleHeader}`);
  for (const line of repoToggleDetails) {
    if (!line) {
      console.log(`  ${pipe}`);
      continue;
    }
    console.log(`  ${pipe}${line.slice(2)}`);
  }
  console.log(`  ${corner}─ ${colorize(`Try '${TOOL_NAME} doctor' for one-step repair + verification.`, '2')}`);
}

function usage(options = {}) {
  const { outsideGitRepo = false } = options;

  console.log(`A command-line tool that sets up hardened multi-agent safety for git repositories.

VERSION
  ${runtimeVersion()}

USAGE
  $ ${SHORT_TOOL_NAME} <command> [options]

COMMANDS
${commandCatalogLines().join('\n')}

AGENT BOT
${agentBotCatalogLines().join('\n')}

REPO TOGGLE
${repoToggleLines().join('\n')}

NOTES
  - No command = ${SHORT_TOOL_NAME} status. ${SHORT_TOOL_NAME} init is an alias of ${SHORT_TOOL_NAME} setup.
  - Global installs need Y/N approval; GitHub CLI (gh) is required for PR automation.
  - Target another repo: ${SHORT_TOOL_NAME} <cmd> --target <repo-path>.
  - On protected main, setup/install/fix/doctor auto-sandbox via agent branch + PR flow.
  - Run '${SHORT_TOOL_NAME} cleanup' to prune merged agent branches/worktrees.
  - Legacy aliases: ${LEGACY_NAMES.join(', ')}.`);

  if (outsideGitRepo) {
    console.log(`
[${TOOL_NAME}] No git repository detected in current directory.
[${TOOL_NAME}] Start from a repo root, or pass an explicit target:
  ${TOOL_NAME} setup --target <path-to-git-repo>
  ${TOOL_NAME} doctor --target <path-to-git-repo>`);
  }
}

function formatElapsedDuration(ms) {
  const durationMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }
  if (durationMs < 10_000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${Math.round(durationMs / 1000)}s`;
}

function startTransientSpinner(message, options = {}) {
  const stream = options.stream || process.stdout;
  if (!stream || !stream.isTTY || typeof stream.write !== 'function') {
    return {
      stop() {},
    };
  }

  const frames = supportsAnsiColors()
    ? ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    : ['-', '\\', '|', '/'];
  const intervalMs = Number.isFinite(options.intervalMs) ? Math.max(60, options.intervalMs) : 80;
  const prefix = String(options.prefix || `[${TOOL_NAME}]`).trim();
  const text = String(message || '').trim();
  let frameIndex = 0;
  let stopped = false;

  const render = () => {
    const frame = frames[frameIndex % frames.length];
    frameIndex += 1;
    const indicator = supportsAnsiColors() ? colorize(frame, '36') : frame;
    stream.write(`\r${prefix} ${indicator} ${text}`);
  };

  const clear = () => {
    stream.write('\r');
    if (typeof stream.clearLine === 'function') {
      stream.clearLine(0);
    }
    if (typeof stream.cursorTo === 'function') {
      stream.cursorTo(0);
    }
  };

  render();
  const timer = setInterval(render, intervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return {
    stop(finalLine = '') {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      clear();
      if (finalLine) {
        stream.write(`${finalLine}\n`);
      }
    },
  };
}

function truncateMiddle(value, maxLength) {
  const text = String(value || '');
  const limit = Number.isFinite(maxLength) ? Math.max(4, maxLength) : 0;
  if (!limit || text.length <= limit) {
    return text;
  }

  const visible = limit - 1;
  const headLength = Math.ceil(visible / 2);
  const tailLength = Math.floor(visible / 2);
  return `${text.slice(0, headLength)}…${text.slice(text.length - tailLength)}`;
}

function truncateTail(value, maxLength) {
  const text = String(value || '');
  const limit = Number.isFinite(maxLength) ? Math.max(4, maxLength) : 0;
  if (!limit || text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 1)}…`;
}

function compactAutoFinishPathSegments(message) {
  return String(message || '').replace(/\((\/[^)]+)\)/g, (_, rawPath) => {
    if (
      rawPath.includes(`${path.sep}.omx${path.sep}agent-worktrees${path.sep}`) ||
      rawPath.includes(`${path.sep}.omc${path.sep}agent-worktrees${path.sep}`)
    ) {
      return `(${path.basename(rawPath)})`;
    }
    return `(${truncateMiddle(rawPath, 72)})`;
  });
}

function detectRecoverableAutoFinishConflict(message) {
  const text = String(message || '').trim();
  if (!text) {
    return null;
  }

  if (/rebase --continue/i.test(text) && /rebase --abort/i.test(text)) {
    return {
      rawLabel: 'auto-finish requires manual rebase.',
      summary: 'manual rebase required on the branch before auto-finish can continue',
    };
  }

  if (/Reattach '.+' in a regular worktree, then rebase it onto origin\/.+ manually\./i.test(text)) {
    return {
      rawLabel: 'auto-finish requires manual rebase.',
      summary: 'manual rebase required on the branch before auto-finish can continue',
    };
  }

  if (/Rebase\/merge '.+' into '.+' and resolve conflicts before finishing\./i.test(text)) {
    return {
      rawLabel: 'auto-finish requires manual rebase or merge.',
      summary: 'manual rebase or merge required before auto-finish can continue',
    };
  }

  if (/Merge conflict detected while merging/i.test(text)) {
    return {
      rawLabel: 'auto-finish requires manual merge resolution.',
      summary: 'manual merge resolution required before auto-finish can continue',
    };
  }

  return null;
}

function summarizeAutoFinishDetail(detail) {
  const trimmed = String(detail || '').trim();
  const match = trimmed.match(/^\[(\w+)\]\s+([^:]+):\s*(.*)$/);
  if (!match) {
    return truncateTail(compactAutoFinishPathSegments(trimmed), DOCTOR_AUTO_FINISH_MESSAGE_MAX);
  }

  const [, status, rawBranch, rawMessage] = match;
  const branch = truncateMiddle(rawBranch, DOCTOR_AUTO_FINISH_BRANCH_LABEL_MAX);
  let message = String(rawMessage || '').trim();
  const recoverableConflict = status === 'skip' ? detectRecoverableAutoFinishConflict(message) : null;

  if (recoverableConflict) {
    message = recoverableConflict.summary;
  } else if (status === 'fail') {
    message = message.replace(/^auto-finish failed\.?\s*/i, '');
    if (/\[agent-sync-guard\]/.test(message) && /Resolve conflicts/i.test(message)) {
      message = 'rebase conflict in finish flow; run rebase --continue or rebase --abort in the source-probe worktree';
    } else if (/unable to compute ahead\/behind/i.test(message)) {
      const aheadBehindMatch = message.match(/unable to compute ahead\/behind(?: \([^)]+\))?/i);
      if (aheadBehindMatch) {
        message = aheadBehindMatch[0];
      }
    } else if (/remote ref does not exist/i.test(message)) {
      message = 'branch merged, but the remote ref was already removed during cleanup';
    }
  }

  message = compactAutoFinishPathSegments(message)
    .replace(/\s+\|\s+/g, '; ')
    .trim();

  return `[${status}] ${branch}: ${truncateTail(message, DOCTOR_AUTO_FINISH_MESSAGE_MAX)}`;
}

function printAutoFinishSummary(summary, options = {}) {
  const enabled = Boolean(summary && summary.enabled);
  const details = Array.isArray(summary && summary.details) ? summary.details : [];
  const baseBranch = String(options.baseBranch || summary?.baseBranch || '').trim();
  const verbose = Boolean(options.verbose);
  const detailLimit = Number.isFinite(options.detailLimit)
    ? Math.max(0, options.detailLimit)
    : DOCTOR_AUTO_FINISH_DETAIL_LIMIT;

  if (enabled) {
    console.log(
      colorizeDoctorOutput(
        `[${TOOL_NAME}] Auto-finish sweep (base=${baseBranch}): attempted=${summary.attempted}, completed=${summary.completed}, skipped=${summary.skipped}, failed=${summary.failed}`,
        detectAutoFinishSummaryStatus(summary),
      ),
    );
    const sortedDetailEntries = verbose ? [] : sortAutoFinishDetailEntries(details);
    const visibleDetails = verbose
      ? details
      : sortedDetailEntries.slice(0, detailLimit).map((entry) => summarizeAutoFinishDetail(entry.detail));
    for (const detail of visibleDetails) {
      console.log(colorizeDoctorOutput(`[${TOOL_NAME}]   ${detail}`, detectAutoFinishDetailStatus(detail)));
    }
    if (!verbose && sortedDetailEntries.length > visibleDetails.length) {
      const hiddenSummary = summarizeHiddenAutoFinishDetails(sortedDetailEntries.slice(visibleDetails.length));
      console.log(
        colorizeDoctorOutput(
          `[${TOOL_NAME}]   ${hiddenSummary.message}`,
          hiddenSummary.status || 'warn',
        ),
      );
    }
    return;
  }

  if (details.length > 0) {
    const detail = verbose ? details[0] : summarizeAutoFinishDetail(details[0]);
    console.log(colorizeDoctorOutput(`[${TOOL_NAME}] ${detail}`, detectAutoFinishDetailStatus(detail)));
  }
}

module.exports = {
  runtimeVersion,
  supportsAnsiColors,
  colorize,
  doctorOutputColorCode,
  colorizeDoctorOutput,
  detectAutoFinishDetailStatus,
  detectAutoFinishSummaryStatus,
  statusDot,
  commandCatalogLines,
  agentBotCatalogLines,
  repoToggleLines,
  printToolLogsSummary,
  usage,
  formatElapsedDuration,
  startTransientSpinner,
  truncateMiddle,
  truncateTail,
  compactAutoFinishPathSegments,
  detectRecoverableAutoFinishConflict,
  summarizeAutoFinishDetail,
  printAutoFinishSummary,
};
