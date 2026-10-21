// After `npm run deploy`, copy stack outputs into app/.env so the mobile app points at the new backend.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outputs = JSON.parse(readFileSync(join(here, "..", "cdk-outputs.json"), "utf8")).NowThere;

const env = [
  `EXPO_PUBLIC_API_URL=${outputs.ApiUrl}`,
  `EXPO_PUBLIC_AWS_REGION=${outputs.Region}`,
  `EXPO_PUBLIC_COGNITO_CLIENT_ID=${outputs.UserPoolClientId}`,
  ""
].join("\n");

const target = join(here, "..", "..", "app", ".env");
writeFileSync(target, env);
console.log(`\nWrote ${target}\n${env}`);
