// Generates the background music listed in tools/music.json with the ElevenLabs music API.
// Usage: pnpm music            (only missing tracks)
//        pnpm music --force a  (regenerate the named tracks)
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

const { tracks } = JSON.parse(readFileSync(join(root, 'tools/music.json'), 'utf8'));
const outDir = join(root, 'packages/client/public/music');
mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

let made = 0;
for (const [name, { prompt, seconds }] of Object.entries(tracks)) {
  if (only.length && !only.includes(name)) continue;
  const file = join(outDir, `${name}.mp3`);
  if (existsSync(file) && !force) continue;
  process.stdout.write(`${name} … `);
  // A lower bitrate keeps the files small for phones; it's background music.
  const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_64', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, music_length_ms: Math.round(seconds * 1000), force_instrumental: true }),
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
console.log(made ? `Generated ${made} track(s) into packages/client/public/music.` : 'Nothing to generate.');
