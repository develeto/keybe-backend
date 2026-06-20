import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

export interface LambdaFunctionProps {
  entry: string;
  handler: string;
  role: iam.Role;
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  environment?: { [key: string]: string };
  timeout?: cdk.Duration;
  memorySize?: number;
  bundling?: Partial<nodejs.NodejsFunctionProps['bundling']>;
}

export class LambdaFunction extends Construct {
  public readonly function: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaFunctionProps) {
    super(scope, id);

    this.function = new nodejs.NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      role: props.role,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securityGroup],
      entry: path.join(__dirname, '..', '..', '..', 'src', props.entry),
      handler: props.handler,
      environment: props.environment,
      timeout: props.timeout ?? cdk.Duration.seconds(30),
      memorySize: props.memorySize ?? 256,
      bundling: {
        target: 'node20',
        externalModules: ['mysql2', 'kysely', 'bcryptjs'],
        nodeModules: ['mysql2', 'kysely', 'bcryptjs'],
        ...props.bundling,
      },
    });
  }
}
