import * as path from "node:path";

import * as cdk from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat, type NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import type { Construct } from "constructs";

export type NowThereStackProps = cdk.StackProps & {
  /** email for AWS Budgets alerts; no budget is created when empty */
  alertEmail?: string;
  /** monthly budget in USD */
  budgetUsd: number;
};

const BACKEND_DIR = path.join(__dirname, "..", "..", "backend");

/**
 * Cost profile (low traffic): everything here is pay-per-use with no always-on servers.
 *  - Lambda, API Gateway HTTP API, DynamoDB on-demand, S3, CloudFront, Cognito (Lite, <10k MAU)
 *  - No NAT gateway, no VPC, no public IPv4, no RDS.
 */
export class NowThereStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: NowThereStackProps) {
    super(scope, id, props);

    // ---------- Data ----------
    const table = new dynamodb.TableV2(this, "Table", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        gsi("GSI1"), // geo:    GEO#<geohash4>        / createdAt#id
        gsi("GSI2"), // user:   USER#<userId>         / createdAt#id
        gsi("GSI3") //  recent: RECENT#<yyyy-mm-dd>   / createdAt#id
      ]
    });

    // ---------- Media ----------
    // Private originals (with full EXIF). Only the processor reads them; auto-expire after 1 day as a safety net.
    const uploadBucket = new s3.Bucket(this, "UploadBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{ expiration: cdk.Duration.days(1), abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) }],
      cors: [{ allowedMethods: [s3.HttpMethods.POST], allowedOrigins: ["*"], allowedHeaders: ["*"] }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Public, metadata-stripped copies served through CloudFront (bucket itself stays private)
    const mediaBucket = new s3.Bucket(this, "MediaBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    const cdn = new cloudfront.Distribution(this, "MediaCdn", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(mediaBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, // includes Korea/Japan edges
      comment: "NowThere media"
    });
    const mediaBaseUrl = `https://${cdn.distributionDomainName}`;

    // ---------- Auth ----------
    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        nickname: { required: true, mutable: true }
      },
      passwordPolicy: { minLength: 8, requireSymbols: false, requireUppercase: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      featurePlan: cognito.FeaturePlan.LITE,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    const appClient = userPool.addClient("MobileClient", {
      generateSecret: false,
      authFlows: { userPassword: true, userSrp: true },
      preventUserExistenceErrors: true,
      idTokenValidity: cdk.Duration.hours(1),
      accessTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30)
    });

    // ---------- Compute ----------
    const commonFn: Omit<NodejsFunctionProps, "entry"> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64, // ~20% cheaper than x86
      projectRoot: BACKEND_DIR,
      depsLockFilePath: path.join(BACKEND_DIR, "package-lock.json"),
      bundling: {
        format: OutputFormat.CJS,
        minify: true,
        sourceMap: true,
        externalModules: [] // bundle the AWS SDK too, so we don't depend on what the runtime ships
      },
      environment: {
        TABLE_NAME: table.tableName,
        UPLOAD_BUCKET: uploadBucket.bucketName,
        MEDIA_BUCKET: mediaBucket.bucketName,
        MEDIA_BASE_URL: mediaBaseUrl,
        NODE_OPTIONS: "--enable-source-maps"
      }
    };

    const apiFn = new NodejsFunction(this, "ApiFn", {
      ...commonFn,
      entry: path.join(BACKEND_DIR, "src/handlers/lambda.ts"),
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      logGroup: new logs.LogGroup(this, "ApiLogs", {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      })
    });

    const mediaFn = new NodejsFunction(this, "MediaProcessorFn", {
      ...commonFn,
      entry: path.join(BACKEND_DIR, "src/handlers/mediaProcessor.ts"),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      logGroup: new logs.LogGroup(this, "MediaLogs", {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      })
    });

    table.grantReadWriteData(apiFn);
    uploadBucket.grantPut(apiFn); // needed to sign presigned POSTs

    table.grantReadWriteData(mediaFn);
    uploadBucket.grantRead(mediaFn);
    uploadBucket.grantDelete(mediaFn);
    mediaBucket.grantPut(mediaFn);

    uploadBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(mediaFn), {
      prefix: "uploads/",
      suffix: ".jpg"
    });

    // ---------- HTTP API ----------
    const api = new apigw.HttpApi(this, "HttpApi", {
      apiName: "nowthere-api",
      corsPreflight: {
        allowOrigins: ["*"],
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST, apigw.CorsHttpMethod.OPTIONS],
        maxAge: cdk.Duration.hours(1)
      }
    });

    // Cost/abuse guard: hard cap on request rate for the whole API
    const stage = api.defaultStage!.node.defaultChild as apigw.CfnStage;
    stage.defaultRouteSettings = { throttlingBurstLimit: 50, throttlingRateLimit: 20 };

    const integration = new HttpLambdaIntegration("ApiIntegration", apiFn);
    const authorizer = new HttpJwtAuthorizer(
      "CognitoAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      { jwtAudience: [appClient.userPoolClientId] }
    );

    // Public read routes
    for (const p of ["/health", "/v1/config", "/v1/map/pins", "/v1/posts", "/v1/posts/nearby", "/v1/posts/popular", "/v1/posts/{id}"]) {
      api.addRoutes({ path: p, methods: [apigw.HttpMethod.GET], integration });
    }
    // Authenticated routes (token verified by API Gateway before Lambda runs)
    api.addRoutes({ path: "/v1/posts", methods: [apigw.HttpMethod.POST], integration, authorizer });
    api.addRoutes({ path: "/v1/posts/{id}/like", methods: [apigw.HttpMethod.POST], integration, authorizer });
    api.addRoutes({ path: "/v1/me/posts", methods: [apigw.HttpMethod.GET], integration, authorizer });

    // ---------- Cost alarm ----------
    if (props.alertEmail) {
      new budgets.CfnBudget(this, "MonthlyBudget", {
        budget: {
          budgetName: "nowthere-monthly",
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: { amount: props.budgetUsd, unit: "USD" }
        },
        notificationsWithSubscribers: [
          notify("ACTUAL", 50, props.alertEmail),
          notify("ACTUAL", 100, props.alertEmail),
          notify("FORECASTED", 100, props.alertEmail)
        ]
      });
    }

    cdk.Tags.of(this).add("project", "nowthere");

    // ---------- Outputs (consumed by scripts/write-app-env.mjs) ----------
    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "Region", { value: this.region });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: appClient.userPoolClientId });
    new cdk.CfnOutput(this, "MediaBaseUrl", { value: mediaBaseUrl });
    new cdk.CfnOutput(this, "TableName", { value: table.tableName });
  }
}

function gsi(name: string): dynamodb.GlobalSecondaryIndexPropsV2 {
  return {
    indexName: name,
    partitionKey: { name: `${name}PK`, type: dynamodb.AttributeType.STRING },
    sortKey: { name: `${name}SK`, type: dynamodb.AttributeType.STRING },
    projectionType: dynamodb.ProjectionType.ALL
  };
}

function notify(type: "ACTUAL" | "FORECASTED", threshold: number, email: string) {
  return {
    notification: {
      notificationType: type,
      comparisonOperator: "GREATER_THAN",
      threshold,
      thresholdType: "PERCENTAGE"
    },
    subscribers: [{ subscriptionType: "EMAIL", address: email }]
  };
}
