// A working best-game-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. A starting point, not a winner: Block Dodger, a
// plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a title screen,
// score, lives and levels, game over and restart, flat colours and no sound. Build your own game
// (any genre, any library you vendor under game/, or none), put your 3 or 4 PNG or JPEG screenshots
// in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
import { readdirSync, statSync } from 'node:fs';

// Gem Tide's own hand-in guard, written for this entry. Before anything is
// copied, walk the package the way the scorer will and refuse to hand in a
// build that breaks the shape of the game: a missing entry page, the wrong
// number of screenshots, an oversized screenshot, or a game folder that has
// grown past the file and byte caps. Failing loudly here beats a silent
// refusal after the deadline.
const GEM_TIDE = {
  title: 'Gem Tide',
  pitch: 'Pilot a tide skimmer, blast the falling swarm, catch the gems.',
  entryPage: 'index.html',
  shotCount: { min: 3, max: 4 },
  shotMaxBytes: 262144,
  gameMaxFiles: 993,
  gameMaxBytes: 50331648,
};

function walkFiles(dir, prefix = '') {
  const found = [];
  for (const name of readdirSync(dir)) {
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...walkFiles(full, rel));
    else found.push({ rel, bytes: statSync(full).size });
  }
  return found;
}

function guardGemTidePackage(root) {
  const problems = [];
  const gameDir = join(root, 'game');
  if (!existsSync(join(gameDir, GEM_TIDE.entryPage))) {
    problems.push(`game/${GEM_TIDE.entryPage} is missing, so the judge has nothing to open`);
  }
  const gameFiles = walkFiles(gameDir);
  const gameBytes = gameFiles.reduce((sum, f) => sum + f.bytes, 0);
  if (gameFiles.length > GEM_TIDE.gameMaxFiles) {
    problems.push(`game/ holds ${gameFiles.length} files, over the ${GEM_TIDE.gameMaxFiles} cap`);
  }
  if (gameBytes > GEM_TIDE.gameMaxBytes) {
    problems.push(`game/ weighs ${gameBytes} bytes, over the ${GEM_TIDE.gameMaxBytes} cap`);
  }
  const shotsDir = join(root, 'screenshots');
  const shots = existsSync(shotsDir)
    ? readdirSync(shotsDir).filter((n) => /\.(png|jpe?g)$/i.test(n)).sort()
    : [];
  if (shots.length < GEM_TIDE.shotCount.min || shots.length > GEM_TIDE.shotCount.max) {
    problems.push(`screenshots/ holds ${shots.length} images, outside the ${GEM_TIDE.shotCount.min}-${GEM_TIDE.shotCount.max} range`);
  }
  for (const shot of shots) {
    const size = statSync(join(shotsDir, shot)).size;
    if (size > GEM_TIDE.shotMaxBytes) {
      problems.push(`screenshots/${shot} is ${size} bytes, over the ${GEM_TIDE.shotMaxBytes} cap`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Gem Tide package refused: ${problems.join('; ')}`);
  }
  console.log(
    `Gem Tide package checked: ${gameFiles.length} game files (${gameBytes} bytes), ${shots.length} screenshots, handing in.`,
  );
}

const here = fileURLToPath(new URL('.', import.meta.url));
guardGemTidePackage(here);
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
