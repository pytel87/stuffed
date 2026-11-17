// Generates sound effects listed in tools/sfx.json with the ElevenLabs sound-generation API.
// Usage: pnpm sfx            (only missing files)
//        pnpm sfx --force a b (regenerate the named sounds)
// Needs ELEVEN_LABS_API_KEY in .env.local. The key is only used here, never by the game.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const key = process.env.ELEVEN_LABS_API_KEY;
if (!key) {
  console.error('Missing ELEVEN_LABS_API_KEY (put it in .env.local, see .env.example).');
  process.exit(1);
}

const { style, sounds } = JSON.parse(readFileSync(join(root, 'tools/sfx.json'), 'utf8'));
const outDir = join(root, 'packages/client/public/sfx');
mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

let made = 0;
for (const [name, { prompt, seconds }] of Object.entries(sounds)) {
  if (only.length && !only.includes(name)) continue;
  const file = join(outDir, `${name}.mp3`);
  if (existsSync(file) && !force) continue;
  process.stdout.write(`${name} … `);
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    // The API accepts 0.5 to 30 seconds.
    body: JSON.stringify({ text: `${prompt}. ${style}`, duration_seconds: Math.min(30, Math.max(0.5, seconds)), prompt_influence: 0.5 }),
  });
  if (!res.ok) {
    console.error(`failed: ${res.status} ${await res.text()}`);
    process.exitCode = 1;
    continue;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, bytes);
  console.log(`${(bytes.length / 1024).toFixed(0)} KB`);
  made++;
}
console.log(made ? `Generated ${made} sound(s) into packages/client/public/sfx.` : 'Nothing to generate.');
