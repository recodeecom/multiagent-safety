const { readCockpitState } = require('./state');
const { renderCockpit } = require('./render');

function render(repoPath = process.cwd()) {
  return renderCockpit(readCockpitState(repoPath));
}

function startCockpit(options = {}) {
  const repoPath = options.repoPath || process.cwd();
  const refreshMs = Number.isFinite(options.refreshMs) && options.refreshMs > 0
    ? options.refreshMs
    : 2000;

  const paint = () => {
    process.stdout.write('\x1Bc');
    process.stdout.write(render(repoPath));
  };

  paint();
  return setInterval(paint, refreshMs);
}

if (require.main === module) {
  startCockpit({
    repoPath: process.argv[2] || process.cwd(),
    refreshMs: Number.parseInt(process.env.GUARDEX_COCKPIT_REFRESH_MS || '2000', 10),
  });
}

module.exports = {
  render,
  startCockpit,
};
