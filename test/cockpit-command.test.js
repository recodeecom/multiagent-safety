const {
  test,
  assert,
  fs,
  os,
  path,
  runNodeWithEnv,
  initRepo,
} = require('./helpers/install-test-helpers');

function fakeTmux(scriptBody) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardex-fake-tmux-'));
  const bin = path.join(dir, 'tmux');
  const log = path.join(dir, 'tmux.log');
  fs.writeFileSync(bin, `#!/usr/bin/env bash\nset -euo pipefail\nLOG=${JSON.stringify(log)}\n${scriptBody}\n`, 'utf8');
  fs.chmodSync(bin, 0o755);
  return { bin, log };
}

test('cockpit creates the default tmux session in the repo root', () => {
  const repoDir = initRepo();
  const { bin, log } = fakeTmux(
    'printf "%s\\n" "$PWD :: $*" >> "$LOG"\n' +
      'if [[ "$1" == "-V" ]]; then echo "tmux 3.4"; exit 0; fi\n' +
      'if [[ "$1" == "has-session" ]]; then exit 1; fi\n' +
      'if [[ "$1" == "new-session" ]]; then exit 0; fi\n' +
      'if [[ "$1" == "send-keys" ]]; then exit 0; fi\n' +
      'exit 9\n',
  );

  const result = runNodeWithEnv(['cockpit', '--target', repoDir], repoDir, { GUARDEX_TMUX_BIN: bin });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Created tmux session 'guardex'/);
  assert.match(result.stdout, /Control pane: gx agents status/);
  const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
  assert.match(lines[1], /^.* :: has-session -t guardex$/);
  assert.match(lines[2], new RegExp(`^${repoDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} :: new-session -d -s guardex -c ${repoDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  assert.match(lines[3], /^.* :: send-keys -t guardex gx agents status C-m$/);
});

test('cockpit attaches when the tmux session already exists', () => {
  const repoDir = initRepo();
  const { bin, log } = fakeTmux(
    'printf "%s\\n" "$PWD :: $*" >> "$LOG"\n' +
      'if [[ "$1" == "-V" ]]; then exit 0; fi\n' +
      'if [[ "$1" == "has-session" ]]; then exit 0; fi\n' +
      'if [[ "$1" == "attach-session" ]]; then exit 0; fi\n' +
      'exit 9\n',
  );

  const result = runNodeWithEnv(['cockpit', '--session', 'guardex-dev', '--target', repoDir], repoDir, {
    GUARDEX_TMUX_BIN: bin,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Attaching tmux session 'guardex-dev'/);
  const logged = fs.readFileSync(log, 'utf8');
  assert.match(logged, /has-session -t guardex-dev/);
  assert.match(logged, /attach-session -t guardex-dev/);
  assert.doesNotMatch(logged, /new-session/);
});

test('cockpit --attach creates then attaches when the session is missing', () => {
  const repoDir = initRepo();
  const { bin, log } = fakeTmux(
    'printf "%s\\n" "$PWD :: $*" >> "$LOG"\n' +
      'if [[ "$1" == "-V" ]]; then exit 0; fi\n' +
      'if [[ "$1" == "has-session" ]]; then exit 1; fi\n' +
      'if [[ "$1" == "new-session" ]]; then exit 0; fi\n' +
      'if [[ "$1" == "send-keys" ]]; then exit 0; fi\n' +
      'if [[ "$1" == "attach-session" ]]; then exit 0; fi\n' +
      'exit 9\n',
  );

  const result = runNodeWithEnv(['cockpit', '--session=guardex-dev', '--attach', '--target', repoDir], repoDir, {
    GUARDEX_TMUX_BIN: bin,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const logged = fs.readFileSync(log, 'utf8');
  assert.match(logged, /new-session -d -s guardex-dev/);
  assert.match(logged, /send-keys -t guardex-dev gx agents status C-m/);
  assert.match(logged, /attach-session -t guardex-dev/);
});

test('cockpit reports a helpful error when tmux is unavailable', () => {
  const repoDir = initRepo();
  const missingTmux = path.join(os.tmpdir(), `missing-tmux-${process.pid}-${Date.now()}`);

  const result = runNodeWithEnv(['cockpit', '--target', repoDir], repoDir, { GUARDEX_TMUX_BIN: missingTmux });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /tmux is required for gx cockpit\. Install tmux and retry\./);
});
