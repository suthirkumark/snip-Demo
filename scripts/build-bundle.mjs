#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

function runToolIn(cwd, command, args) {
  if (isWindows) {
    runIn(cwd, 'cmd', ['/c', command, ...args]);
    return;
  }

  runIn(cwd, command, args);
}

const shouldPush = process.argv.includes('--push');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function runIn(cwd, command, args) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function output(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? String(result.stderr).trim() : '';
    throw new Error(stderr || `${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }

  return String(result.stdout || '').trim();
}

async function assertExists(path, label) {
  try {
    await stat(path);
  } catch {
    throw new Error(`${label} not found at ${path}`);
  }
}

async function writeText(path, content) {
  await writeFile(path, content, 'utf8');
}

function hasStagedChanges(cwd) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd });
  return result.status === 1;
}

function commitIfStaged(cwd, message) {
  if (!hasStagedChanges(cwd)) {
    return false;
  }

  runIn(cwd, 'git', ['commit', '-m', message]);
  return true;
}

async function assembleBundle() {
  const backendDir = join(repoRoot, 'backend');
  const frontendDir = join(repoRoot, 'frontend');
  const cliDir = join(repoRoot, 'cli');
  const bundleDir = join(repoRoot, 'bundle');
  const frontendBuildDir = join(frontendDir, 'dist', 'snip-frontend', 'browser');
  const frontendIndex = join(frontendBuildDir, 'index.html');

  await assertExists(join(backendDir, 'server.js'), 'backend/server.js');
  await assertExists(join(cliDir, 'cli.js'), 'cli/cli.js');
  await assertExists(frontendIndex, 'frontend build output index.html');

  await mkdir(bundleDir, { recursive: true });

  await rm(join(bundleDir, 'public'), { recursive: true, force: true });
  await cp(join(backendDir, 'server.js'), join(bundleDir, 'server.js'));
  await cp(join(cliDir, 'cli.js'), join(bundleDir, 'cli.js'));
  await cp(frontendBuildDir, join(bundleDir, 'public'), { recursive: true });

  await writeText(join(bundleDir, '.env'), 'PUBLIC_DIR=./public\n');
  await writeText(
    join(bundleDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'snip-bundle',
        private: true,
        scripts: {
          start: 'bun server.js',
        },
      },
      null,
      2,
    )}\n`,
  );

  await writeText(
    join(bundleDir, 'Dockerfile'),
    ['FROM oven/bun:1-alpine', 'WORKDIR /app', 'COPY . .', 'ENV PORT=3000', 'EXPOSE 3000', 'CMD ["bun", "server.js"]', ''].join('\n'),
  );

  await writeText(
    join(bundleDir, '.dockerignore'),
    ['.git', '.gitignore', 'node_modules', 'npm-debug.log*', '.DS_Store', ''].join('\n'),
  );

  await writeText(
    join(bundleDir, 'railway.json'),
    `${JSON.stringify({ build: { builder: 'DOCKERFILE' } }, null, 2)}\n`,
  );
}

async function main() {
  console.log('Updating backend/frontend/cli submodules to branch tips...');
  run('git', ['submodule', 'update', '--init', '--remote', 'backend', 'frontend', 'cli']);

  const frontendDir = join(repoRoot, 'frontend');
  console.log('Building frontend...');
  runToolIn(frontendDir, 'npm', ['install']);
  runToolIn(frontendDir, 'npx', ['ng', 'build', '--output-path', 'dist/snip-frontend']);

  const frontendIndex = join(frontendDir, 'dist', 'snip-frontend', 'browser', 'index.html');
  await assertExists(frontendIndex, 'frontend/dist/snip-frontend/browser/index.html');

  console.log('Assembling bundle submodule contents...');
  await assembleBundle();

  const bundleDir = join(repoRoot, 'bundle');
  runIn(bundleDir, 'git', ['add', '-A']);
  const bundleCommitted = commitIfStaged(bundleDir, 'Regenerate bundle output');

  if (bundleCommitted) {
    console.log('Bundle changes committed.');
    if (shouldPush) {
      runIn(bundleDir, 'git', ['push', 'origin', 'HEAD:bundle']);
      console.log('Pushed bundle branch.');
    }
  } else {
    console.log('Bundle unchanged; nothing to commit.');
  }

  run('git', ['add', 'bundle']);
  const mainCommitted = commitIfStaged(repoRoot, 'Bump bundle submodule');

  if (mainCommitted) {
    console.log('Main submodule pointer updated.');
    if (shouldPush) {
      run('git', ['push']);
      console.log('Pushed main branch.');
    }
  } else {
    console.log('Main unchanged; no submodule pointer bump required.');
  }

  if (!bundleCommitted && !mainCommitted) {
    console.log('No changes detected. Safe no-op.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
