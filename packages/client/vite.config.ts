// Vite's defaults, plus a build id: baked into the code (__BUILD_ID__) and written to version.json
// next to it, so a page left open can tell when a newer game has been deployed (see update-banner).
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function buildId(): string {
  let commit = 'local';
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    // not a git checkout: the time alone
  }
  return `${commit}-${Date.now().toString(36)}`;
}

const BUILD_ID = buildId();

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    {
      name: 'stuffed-version',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
  ],
});
