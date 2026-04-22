const TASK_SIZE_UPPER_BOUNDS = {
  'narrow-patch': 1_800_000,
  'medium-change': 4_000_000,
  'large-change': 8_000_000,
};

const TASK_SIZE_VALUES = new Set(Object.keys(TASK_SIZE_UPPER_BOUNDS));
const FRAGMENTATION_PRESET_SCORES = {
  clean: 0,
  'few-extra-checks': 5,
  'repeated-follow-ups': 10,
  looping: 18,
  'dominant-loop': 25,
};
const FINISH_PATH_PRESET_SCORES = {
  'clear-early': 0,
  'minor-hesitation': 5,
  'late-decision': 10,
  reopening: 15,
};
const POST_PROOF_PRESET_SCORES = {
  'stops-soon': 0,
  'small-tail': 5,
  'notable-tail': 10,
  'heavy-tail': 15,
};
const DRIVER_TIE_BREAK = ['fragmentation', 'writeStdin', 'finishPath', 'postProof', 'cost'];
const DRIVER_LABELS = {
  cost: 'cost vs expected scope',
  fragmentation: 'turn fragmentation',
  writeStdin: 'write_stdin churn',
  finishPath: 'finish-path discipline',
  postProof: 'post-proof drift',
};

function parseRequiredPositiveInteger(name, rawValue, { allowZero = true } = {}) {
  const parsed = Number.parseInt(String(rawValue || ''), 10);
  if (!Number.isFinite(parsed) || (!allowZero && parsed <= 0) || (allowZero && parsed < 0)) {
    throw new Error(`${name} requires ${allowZero ? 'a non-negative integer' : 'a positive integer'} value`);
  }
  return parsed;
}

function parseBooleanFlag(name, rawValue) {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (normalized === 'yes' || normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'no' || normalized === 'false' || normalized === '0') {
    return false;
  }
  throw new Error(`${name} requires yes/no (or true/false, 1/0)`);
}

function clampScore(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function parseTaskSize(rawTaskSize) {
  const normalized = String(rawTaskSize || '').trim();
  if (!TASK_SIZE_VALUES.has(normalized)) {
    throw new Error(`--task-size must be one of: ${Array.from(TASK_SIZE_VALUES).join(', ')}`);
  }
  return normalized;
}

function resolveExpectedUpperBound(taskSize, rawExpectedBound) {
  if (rawExpectedBound) {
    return parseRequiredPositiveInteger('--expected-bound', rawExpectedBound, { allowZero: false });
  }
  return TASK_SIZE_UPPER_BOUNDS[taskSize];
}

function scoreCost(tokens, expectedUpperBound) {
  const ratio = tokens / expectedUpperBound;
  if (ratio <= 1.0) return 0;
  if (ratio <= 1.5) return 5;
  if (ratio <= 2.5) return 10;
  if (ratio <= 4.0) return 18;
  if (ratio <= 6.0) return 24;
  return 30;
}

function scoreFragmentation(execCount, override) {
  if (override) {
    if (Object.prototype.hasOwnProperty.call(FRAGMENTATION_PRESET_SCORES, override)) {
      return FRAGMENTATION_PRESET_SCORES[override];
    }
    return clampScore(parseRequiredPositiveInteger('--fragmentation', override), 0, 25);
  }
  if (execCount <= 4) return 0;
  if (execCount <= 8) return 5;
  if (execCount <= 16) return 10;
  if (execCount <= 28) return 18;
  return 25;
}

function scoreWriteStdin(writeStdinCount) {
  if (writeStdinCount <= 0) return 0;
  if (writeStdinCount <= 3) return 5;
  if (writeStdinCount <= 6) return 10;
  return 15;
}

function scoreFinishPath(completionBeforeTail, override) {
  if (override) {
    if (Object.prototype.hasOwnProperty.call(FINISH_PATH_PRESET_SCORES, override)) {
      return FINISH_PATH_PRESET_SCORES[override];
    }
    return clampScore(parseRequiredPositiveInteger('--finish-path', override), 0, 15);
  }
  return completionBeforeTail ? 0 : 5;
}

function scorePostProof(completionBeforeTail, override) {
  if (override) {
    if (Object.prototype.hasOwnProperty.call(POST_PROOF_PRESET_SCORES, override)) {
      return POST_PROOF_PRESET_SCORES[override];
    }
    return clampScore(parseRequiredPositiveInteger('--post-proof', override), 0, 15);
  }
  return completionBeforeTail ? 0 : 10;
}

function labelForTotal(total) {
  if (total <= 15) return 'Healthy';
  if (total <= 30) return 'Mildly fragmented';
  if (total <= 50) return 'Inefficient';
  if (total <= 75) return 'Runaway';
  return 'Catastrophic';
}

function buildSessionSeverityReport(options) {
  const taskSize = parseTaskSize(options.taskSize);
  const tokens = parseRequiredPositiveInteger('--tokens', options.tokens);
  const execCount = parseRequiredPositiveInteger('--exec-count', options.execCount);
  const writeStdinCount = parseRequiredPositiveInteger('--write-stdin-count', options.writeStdinCount);
  const completionBeforeTail = parseBooleanFlag('--completion-before-tail', options.completionBeforeTail);
  const expectedUpperBound = resolveExpectedUpperBound(taskSize, options.expectedBound);
  const costRatio = tokens / expectedUpperBound;
  const scores = {
    cost: scoreCost(tokens, expectedUpperBound),
    fragmentation: scoreFragmentation(execCount, options.fragmentation),
    writeStdin: scoreWriteStdin(writeStdinCount),
    finishPath: scoreFinishPath(completionBeforeTail, options.finishPath),
    postProof: scorePostProof(completionBeforeTail, options.postProof),
  };
  const total = scores.cost + scores.fragmentation + scores.writeStdin + scores.finishPath + scores.postProof;
  const label = labelForTotal(total);
  const rankedDimensions = Object.entries(scores)
    .map(([key, score]) => ({ key, score, label: DRIVER_LABELS[key] }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return DRIVER_TIE_BREAK.indexOf(left.key) - DRIVER_TIE_BREAK.indexOf(right.key);
    });
  const primaryDriver = rankedDimensions[0] ? rankedDimensions[0].label : 'none';
  const secondaries = rankedDimensions.slice(1).map((entry) => entry.label);

  return {
    taskSize,
    expectedUpperBound,
    tokens,
    execCount,
    writeStdinCount,
    completionBeforeTail,
    costRatio,
    scores: {
      ...scores,
      total,
    },
    label,
    primaryDriver,
    secondaries,
    outputLine: `Score ${total}/100 — ${label}. Primary: ${primaryDriver}. Secondaries: ${
      secondaries.length > 0 ? secondaries.join(', ') : 'none'
    }.`,
  };
}

function renderSessionSeverityReport(report) {
  return [
    report.outputLine,
    '',
    `Task size: ${report.taskSize}`,
    `Expected upper bound: ${report.expectedUpperBound}`,
    `Actual tokens: ${report.tokens}`,
    `Exec count: ${report.execCount}`,
    `write_stdin count: ${report.writeStdinCount}`,
    `Completion before tail churn: ${report.completionBeforeTail ? 'yes' : 'no'}`,
    `Cost ratio: ${report.costRatio.toFixed(2)}x`,
    '',
    `A. Cost vs expected scope: ${report.scores.cost}`,
    `B. Turn fragmentation: ${report.scores.fragmentation}`,
    `C. write_stdin churn: ${report.scores.writeStdin}`,
    `D. Finish-path discipline: ${report.scores.finishPath}`,
    `E. Post-proof drift: ${report.scores.postProof}`,
    '',
    `Total: ${report.scores.total}`,
    `Label: ${report.label}`,
    `Primary driver: ${report.primaryDriver}`,
    `Secondary drivers: ${report.secondaries.length > 0 ? report.secondaries.join(', ') : 'none'}`,
  ].join('\n');
}

module.exports = {
  TASK_SIZE_UPPER_BOUNDS,
  buildSessionSeverityReport,
  renderSessionSeverityReport,
  labelForTotal,
};
