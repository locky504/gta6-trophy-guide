// Leonida Trophy Guide — the entry's hand-in program (Node 22, stdlib only).
//
// What it does: copies the guide (app/) and its screenshots (screenshots/) from
// this repository into the hand-in folder, then writes dossier.json there with
// buildDossier from the kit's vendored library, vendor/makefun-frontend.ts.
// The grader runs this twice and the two runs must write identical bytes.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output, so a local
// check looks like:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The caps below mirror the gate's own limits, so a build that passes here
// is shaped the way the sealed scorer expects it.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const handInDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh hand-in folder, then the guide itself, then the screenshots.
mkdirSync(handInDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(handInDir, 'app'), { recursive: true });
mkdirSync(join(handInDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(handInDir, 'screenshots'), { recursive: true });
}

// The dossier is the judge's view of the entry: its screenshots, the first
// load's files and bytes, and the source. buildDossier refuses anything over
// the gate's caps, so a failure here is a failure the scorer would report.
writeFileSync(
  join(handInDir, 'dossier.json'),
  buildDossier(handInDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);
