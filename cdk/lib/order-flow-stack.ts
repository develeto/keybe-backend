import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwAuthorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as apigwIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';

export class OrderFlowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ──────────────────────────────────────────────
    // Secrets Manager — DB credentials
    // ──────────────────────────────────────────────
    const dbSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `order-flow-${this.stackName}-db-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    // ──────────────────────────────────────────────
    // VPC — 2 AZs, 1 public + 1 private subnet each
    // ──────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'OrderFlowVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { cidrMask: 24, name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
        { cidrMask: 24, name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      ],
    });

    // ──────────────────────────────────────────────
    // EC2 Bastion Host (t4g.nano — free tier eligible)
    // ──────────────────────────────────────────────
    const bastionSg = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
      vpc,
      description: 'Security group for bastion host',
      allowAllOutbound: true,
    });
    bastionSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH from anywhere');

    const bastionKeyPair = ec2.KeyPair.fromKeyPairName(this, 'BastionKeyPair', 'order-flow-bastion-key-v2');

    new ec2.Instance(this, 'BastionHost', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
      securityGroup: bastionSg,
      keyPair: bastionKeyPair,
    });

    // ──────────────────────────────────────────────
    // Aurora Serverless v2 — MySQL 8.0 compatible
    // ──────────────────────────────────────────────
    const dbSg = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'Security group for Aurora Serverless',
      allowAllOutbound: true,
    });
    dbSg.addIngressRule(
      ec2.Peer.securityGroupId(bastionSg.securityGroupId),
      ec2.Port.tcp(3306),
      'Allow MySQL from bastion'
    );

    // Lambda VPC Security Group
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    dbSg.addIngressRule(
      ec2.Peer.securityGroupId(lambdaSg.securityGroupId),
      ec2.Port.tcp(3306),
      'Allow MySQL from Lambda'
    );

    const cluster = new rds.DatabaseCluster(this, 'OrderFlowAuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.VER_3_08_0 }),
      credentials: rds.Credentials.fromSecret(dbSecret),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      writer: rds.ClusterInstance.serverlessV2('WriterInstance', { autoMinorVersionUpgrade: true }),
      readers: [
        rds.ClusterInstance.serverlessV2('ReaderInstance', { autoMinorVersionUpgrade: true, scaleWithWriter: true }),
      ],
      defaultDatabaseName: 'orderflow',
    });

    // ──────────────────────────────────────────────
    // Cognito User Pool
    // ──────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'OrderFlowUserPool', {
      userPoolName: 'order-flow-user-pool',
      selfSignUpEnabled: false,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      standardAttributes: { email: { required: true, mutable: true } },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'OrderFlowUserPoolClient', {
      userPool,
      generateSecret: false,
      authFlows: { userPassword: true },
    });

    // ──────────────────────────────────────────────
    // SQS Queue + DLQ
    // ──────────────────────────────────────────────
    const dlq = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: 'order-flow-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    const ordersQueue = new sqs.Queue(this, 'OrdersQueue', {
      queueName: 'order-flow-orders-queue',
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    });

    // ──────────────────────────────────────────────
    // SNS Topic — Order Status Change Notifications
    // ──────────────────────────────────────────────
    const orderStatusChangedTopic = new sns.Topic(this, 'OrderStatusChangedTopic', {
      topicName: 'order-flow-status-changed',
      displayName: 'OrderFlow Status Change Notifications',
    });

    // ──────────────────────────────────────────────
    // Lambda Execution Role
    // ──────────────────────────────────────────────
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'cognito-idp:AdminInitiateAuth',
        'cognito-idp:InitiateAuth',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminSetUserPassword',
        'sqs:SendMessage',
        'sqs:ReceiveMessage',
        'sqs:DeleteMessage',
        'sqs:GetQueueAttributes',
        'sns:Publish',
      ],
      resources: ['*'],
    }));

    // ──────────────────────────────────────────────
    // Lambda Configuration
    // ──────────────────────────────────────────────
    const lambdaConfig: Partial<nodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      role: lambdaRole,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: {
        DATABASE_URL: cdk.Fn.sub(
          'mysql://${user}:${password}@${host}:${port}/orderflow',
          {
            user: dbSecret.secretValueFromJson('username').unsafeUnwrap(),
            password: dbSecret.secretValueFromJson('password').unsafeUnwrap(),
            host: cluster.clusterEndpoint.hostname,
            port: cdk.Token.asString(cluster.clusterEndpoint.port),
          }
        ),
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        ORDERS_QUEUE_URL: ordersQueue.queueUrl,
        ORDER_STATUS_CHANGED_TOPIC_ARN: orderStatusChangedTopic.topicArn,
        STAGE: this.stackName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling: {
        target: 'node20',
        externalModules: ['mysql2', 'kysely', 'bcryptjs'],
        nodeModules: ['mysql2', 'kysely', 'bcryptjs'],
      },
    };

    // Helper
    const createLambda = (id: string, handler: string, entryPath: string, overrides?: Partial<nodejs.NodejsFunctionProps>) =>
      new nodejs.NodejsFunction(this, id, {
        ...lambdaConfig,
        ...overrides,
        entry: path.join(__dirname, '..', '..', 'src', entryPath),
        handler,
      });

    // ──────────────────────────────────────────────
    // Lambda Functions
    // ──────────────────────────────────────────────
    const loginFn = createLambda('LoginFunction', 'login', 'modules/auth/interfaces/api/login.handler.ts');
    const registerFn = createLambda('RegisterFunction', 'register', 'modules/auth/interfaces/api/register.handler.ts');

    const createOrderFn = createLambda('CreateOrderFunction', 'createOrder', 'modules/orders/interfaces/api/order.handlers.ts');
    const listOrdersFn = createLambda('ListOrdersFunction', 'listOrders', 'modules/orders/interfaces/api/order.handlers.ts');
    const getOrderFn = createLambda('GetOrderFunction', 'getOrder', 'modules/orders/interfaces/api/order.handlers.ts');

    const adminListOrdersFn = createLambda('AdminListOrdersFunction', 'adminListOrders', 'modules/admin/interfaces/api/admin.handlers.ts');
    const adminUpdateStatusFn = createLambda('AdminUpdateOrderStatusFunction', 'adminUpdateOrderStatus', 'modules/admin/interfaces/api/admin.handlers.ts');

    const processOrderFn = createLambda('ProcessOrderFunction', 'processOrderHandler', 'modules/orders/infrastructure/sqs/process-order.handler.ts', {
      timeout: cdk.Duration.seconds(60),
    });
    processOrderFn.addEventSource(new SqsEventSource(ordersQueue));

    const reportMetricsFn = createLambda('ReportMetricsFunction', 'reportMetrics', 'modules/orders/infrastructure/sqs/report-metrics.handler.ts', {
      timeout: cdk.Duration.seconds(30),
    });

    new events.Rule(this, 'MetricsReportRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new eventsTargets.LambdaFunction(reportMetricsFn)],
    });

    const openapiFn = createLambda('OpenApiSpecFunction', 'openapiSpec', 'docs/handlers/index.ts');
    const swaggerFn = createLambda('SwaggerUIFunction', 'swaggerUI', 'docs/handlers/index.ts');

    // ──────────────────────────────────────────────
    // API Gateway HTTP
    // ──────────────────────────────────────────────
    const httpApi = new apigw.HttpApi(this, 'OrderFlowHttpApi', {
      apiName: 'order-flow-api',
      description: 'OrderFlow API Gateway',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST, apigw.CorsHttpMethod.PATCH, apigw.CorsHttpMethod.DELETE],
        allowOrigins: ['*'],
      },
    });

    const issuerUrl = `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`;
    const jwtAuthorizer = new apigwAuthorizers.HttpJwtAuthorizer(
      'OrderFlowJwtAuthorizer',
      issuerUrl,
      { jwtAudience: [userPoolClient.userPoolClientId] }
    );

    const addRoute = (path: string, methods: apigw.HttpMethod[], fn: lambda.Function, auth = false) => {
      httpApi.addRoutes({
        path,
        methods,
        integration: new apigwIntegrations.HttpLambdaIntegration(`${fn.node.id}Integration`, fn),
        ...(auth ? { authorizer: jwtAuthorizer } : {}),
      });
    };

    addRoute('/auth/login', [apigw.HttpMethod.POST], loginFn);
    addRoute('/auth/register', [apigw.HttpMethod.POST], registerFn);
    addRoute('/orders', [apigw.HttpMethod.POST], createOrderFn, true);
    addRoute('/orders', [apigw.HttpMethod.GET], listOrdersFn, true);
    addRoute('/orders/{id}', [apigw.HttpMethod.GET], getOrderFn, true);
    addRoute('/admin/orders', [apigw.HttpMethod.GET], adminListOrdersFn, true);
    addRoute('/admin/orders/{id}/status', [apigw.HttpMethod.PATCH], adminUpdateStatusFn, true);
    addRoute('/docs/openapi.json', [apigw.HttpMethod.GET], openapiFn);
    addRoute('/docs/ui', [apigw.HttpMethod.GET], swaggerFn);

    orderStatusChangedTopic.grantPublish(lambdaRole);

    // ──────────────────────────────────────────────
    // CloudWatch Alarm — Lambda Errors
    // ──────────────────────────────────────────────
    const allFunctions = [
      loginFn, registerFn, createOrderFn, listOrdersFn, getOrderFn,
      adminListOrdersFn, adminUpdateStatusFn, processOrderFn, reportMetricsFn,
      openapiFn, swaggerFn,
    ];

    for (const fn of allFunctions) {
      const errorMetric = fn.metricErrors({ period: cdk.Duration.minutes(5) });
      new cloudwatch.Alarm(this, `${fn.node.id}ErrorAlarm`, {
        metric: errorMetric,
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `${fn.node.id} has errors > 0 in 5 minutes`,
      });
    }

    // ──────────────────────────────────────────────
    // Outputs
    // ──────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.url!, description: 'API Gateway URL' });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId, description: 'Cognito User Pool ID' });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId, description: 'Cognito User Pool Client ID' });
    new cdk.CfnOutput(this, 'OrdersQueueUrl', { value: ordersQueue.queueUrl, description: 'Orders SQS Queue URL' });
    new cdk.CfnOutput(this, 'DatabaseEndpoint', { value: cluster.clusterEndpoint.hostname, description: 'Aurora Cluster Endpoint' });
    new cdk.CfnOutput(this, 'SwaggerUrl', { value: `${httpApi.url}docs/ui`, description: 'Swagger UI URL' });
    new cdk.CfnOutput(this, 'OrderStatusChangedTopicArn', { value: orderStatusChangedTopic.topicArn, description: 'SNS Topic for order status changes' });
  }
}
