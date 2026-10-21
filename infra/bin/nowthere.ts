#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { NowThereStack } from "../lib/nowthere-stack";

const app = new cdk.App();

new NowThereStack(app, "NowThere", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-2" // Seoul
  },
  // npx cdk deploy -c alertEmail=you@example.com -c budgetUsd=5
  alertEmail: app.node.tryGetContext("alertEmail") ?? process.env.NOWTHERE_ALERT_EMAIL,
  budgetUsd: Number(app.node.tryGetContext("budgetUsd") ?? 5)
});
