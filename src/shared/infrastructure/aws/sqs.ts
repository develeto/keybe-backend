import {
  SQSClient,
  SendMessageCommand,
  SendMessageCommandOutput,
} from '@aws-sdk/client-sqs';

const client = new SQSClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export async function sendMessage(
  queueUrl: string,
  body: Record<string, unknown>,
  delaySeconds = 0
): Promise<SendMessageCommandOutput> {
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(body),
    DelaySeconds: delaySeconds,
  });
  return client.send(command);
}
