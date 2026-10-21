// npm run deploy -- -c alertEmail=you@example.com -c budgetUsd=5
// Runs `cdk deploy` with any extra args, then writes app/.env from the stack outputs.
import { spawnSync } from "node:child_process";

const args = ["cdk", "deploy", "--require-approval", "never", "--outputs-file", "cdk-outputs.json", ...process.argv.slice(2)];
const res = spawnSync("npx", args, { stdio: "inherit", shell: process.platform === "win32" });
if (res.status !== 0) process.exit(res.status ?? 1);

await import("./write-app-env.mjs");
