// MicroNest demo pipeline runner (RCCF-DEMO-02, hardened RCCF-DEMO-03).
// Canonical command: node demos/run.mjs  (or: npm run demo:generate)
// DO NOT run with pnpm in this npm-layout repo (pnpm restructured node_modules
// in DEMO-02 and had to be repaired with `npm ci`).
// Usage: node demos/run.mjs [--project <name>] [--steps capture,tts,render,stems,final] [--redo all] [--check]
// Orchestrates the isolated lab workspace at ../micronest-demo-lab/ultrademo.
// Prerequisites (NOT started automatically — documented, non-destructive):
//   1. Docker Desktop running + `supabase start --ignore-health-check` in repo root
//      (first run needs image pulls; see RCCF-DEMO-02 report for crane workaround)
//   2. .env.local pointing at local Supabase (gitignored; see report)
//   3. `npm run dev` (Next.js on http://localhost:3000)
//   4. Lab profile seeded: node <lab>/scripts/demo-login equivalent
//      (storage-state lives OUTSIDE the repo, never committed)
// Usage: node demos/run.mjs --check        (validate only)
//        node demos/run.mjs                 (full default project)
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND } from "./brand.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(ROOT);
const LAB = path.join(path.dirname(REPO), "micronest-demo-lab", "ultrademo");
const FFMPEG_BIN =
  "C:\\Users\\91866\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin";
const PROJECT = argOf("--project") ?? "micronest-prize-splitter-20261010";
const STEPS = (argOf("--steps") ?? "capture,tts,render,stems,final").split(",");
const REDO = argOf("--redo"); // forwarded to `tts` (e.g. --redo all after a voice/pipeline fix)
const CHECK_ONLY = process.argv.includes("--check");

function argOf(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const ok = (m) => console.log(`  ok  ${m}`);
const bad = (m, hint) => { console.log(`  FAIL ${m}\n       -> ${hint}`); failures.push(m); };
const failures = [];

function checkEnv() {
  console.log("demo:generate env check\n");
  const major = Number(process.versions.node.split(".")[0]);
  major >= 20 ? ok(`node v${process.versions.node}`) : bad("node <20", "install Node 20+");
  for (const bin of ["ffmpeg", "ffprobe"]) {
    try {
      execFileSync(path.join(FFMPEG_BIN, `${bin}.exe`), ["-version"], { stdio: "pipe" });
      ok(`${bin} (Gyan full build)`);
    } catch { bad(`${bin} missing`, "winget install Gyan.FFmpeg"); }
  }
  existsSync(path.join(LAB, "node_modules")) ? ok("lab node_modules") : bad("lab deps", "npm ci in lab");
  try {
    execFileSync("cmd.exe", ["/c", "py", "-c", "import piper"], { stdio: "pipe" });
    ok("piper-tts (python check skipped, uses PATH piper)");
  } catch { /* informational only */ }
  try {
    execFileSync(process.execPath, ["-e", "1"], { stdio: "pipe" });
    ok("node runtime");
  } catch { bad("node runtime", "reinstall Node"); }
  existsSync(path.join(LAB, ".env")) ? ok("lab .env (PIPER_MODEL)") : bad("lab .env", "copy .env.example, set PIPER_MODEL");
  existsSync(path.join(LAB, "projects", PROJECT, "flow.mjs")) ? ok(`flow ${PROJECT}`) : bad("flow.mjs", "author projects/<name>/flow.mjs");
  for (const [label, url] of [["dev app", "http://localhost:3000/api/health"], ["local gotrue", "http://127.0.0.1:54321/auth/v1/health"]]) {
    try {
      execFileSync(process.execPath, ["-e", `fetch("${url}").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))`], { stdio: "pipe", timeout: 15000 });
      ok(`${label} reachable`);
    } catch { bad(`${label} unreachable`, label === "dev app" ? "npm run dev" : "supabase start --ignore-health-check"); }
  }
  existsSync(path.join(LAB, ".profiles", "demo-local")) ? ok("auth profile demo-local") : bad("auth profile", "run lab login seeding (see report)");
  if (failures.length) { console.log(`\n${failures.length} check(s) failed — fix and re-run with --check.`); process.exit(1); }
  console.log("\nall checks passed");
}

function step(name, fn) {
  if (!STEPS.includes(name)) return;
  console.log(`\n### ${name}`);
  fn();
}

const npm = (args, cwd) =>
  // win32: .cmd shims need a shell (same lesson as lab scripts/render.mjs).
  execFileSync("npm", args.split(" "), {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, PATH: `${FFMPEG_BIN};${process.env.PATH}` },
  });

checkEnv();
if (CHECK_ONLY) process.exit(0);

const OUT = path.join(LAB, "projects", PROJECT, "out");
const projFile = (n) => path.join(OUT, n);
step("capture", () => npm(`run capture -- ${PROJECT}`, LAB));
step("tts", () => npm(`run tts -- ${PROJECT}${REDO ? ` --redo ${REDO}` : ""}`, LAB));
step("render", () => npm(`run render -- ${PROJECT} --stems`, LAB));
step("stems", () => console.log(`stems in ${projFile("stems/")} (captions.srt + narration.mp3 + clean video.mp4)`));
step("final", () => {
  const ff = (a) => execFileSync(path.join(FFMPEG_BIN, "ffmpeg.exe"), a, { stdio: "inherit" });
  const anim = path.join(REPO, BRAND.logoAnimation);
  const intro = projFile("logo-intro.mp4");
  const master = projFile(`${PROJECT}.mp4`);
  const final = projFile(`${PROJECT}-poc-final.mp4`);
  ff(["-y", "-loglevel", "error", "-ss", "0", "-t", String(BRAND.logoIntroSeconds), "-i", anim,
      "-f", "lavfi", "-t", String(BRAND.logoIntroSeconds), "-i", "anullsrc=r=44100:cl=stereo",
      "-vf", `scale=1080:1080,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=${BRAND.colors.cream}`,
      "-r", "30", "-c:v", BRAND.video.vcodec, "-pix_fmt", "yuv420p", "-c:a", BRAND.video.acodec, "-shortest", intro]);
  ff(["-y", "-loglevel", "error", "-i", intro, "-i", master,
      "-filter_complex", "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]",
      "-map", "[v]", "-map", "[a]", "-c:v", BRAND.video.vcodec, "-crf", "20",
      "-pix_fmt", "yuv420p", "-c:a", BRAND.video.acodec, final]);
  console.log(`\nFINAL: ${final}`);
});
console.log("\ndemo:generate complete");
