#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OrderFlowStack } from '../lib/order-flow-stack';

const app = new cdk.App();

new OrderFlowStack(app, 'OrderFlowStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  description: 'OrderFlow - Backend Serverless para gestión de pedidos',
});
