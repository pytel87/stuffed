// Generates tileable textures (or, with "panel", single panels) listed in tools/textures.json with the OpenAI image API.
// Usage: pnpm textures            (only missing files)
//        pnpm textures --force a b (regenerate the named textures)
// Needs OPENAI_API_KEY in .env.local. The key is only used here, never by the game.
// Saves 512 px JPEGs (resized with macOS sips) to packages/client/public/textures.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error('Missing OPENAI_API_KEY (put it in .env.local, see .env.example).');
  process.exit(1);
}

const { style, textures } = JSON.parse(readFileSync(join(root, 'tools/textures.json'), 'utf8'));
const outDir = join(root, 'packages/client/public/textures');
mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

let made = 0;
for (const [name, { prompt, panel }] of Object.entries(textures)) {
  if (only.length && !only.includes(name)) continue;
  const file = join(outDir, `${name}.jpg`);
  if (existsSync(file) && !force) continue;
  process.stdout.write(`${name} … `);
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt: panel ? prompt : `${prompt}. ${style}`, size: '1024x1024', quality: 'medium', n: 1 }),
  });
  if (!res.ok) {
    console.error(`failed: ${res.status} ${await res.text()}`);
    process.exitCode = 1;
    continue;
  }
  const { data } = await res.json();
  const png = join(outDir, `${name}.tmp.png`);
  writeFileSync(png, Buffer.from(data[0].b64_json, 'base64'));
  execFileSync('sips', ['-Z', '512', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', png, '--out', file], { stdio: 'ignore' });
  rmSync(png);
  made++;
  console.log('ok');
}
console.log(made ? `Made ${made} texture(s) in ${outDir}` : 'Nothing to make.');
