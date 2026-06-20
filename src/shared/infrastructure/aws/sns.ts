import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const client = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

export async function publishToTopic(
  topicArn: string,
  message: Record<string, unknown>,
  subject?: string
): Promise<void> {
  await client.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message),
      Subject: subject,
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: (message.event as string) || 'order.status.changed',
        },
      },
    })
  );
}
