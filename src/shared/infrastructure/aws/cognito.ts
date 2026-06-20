import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminDeleteUserCommand,
  InitiateAuthCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'crypto';

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

function calculateSecretHash(username: string): string | undefined {
  const clientId = process.env.COGNITO_CLIENT_ID;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET;
  if (!clientSecret) return undefined;
  const hmac = crypto.createHmac('sha256', clientSecret);
  hmac.update(username + clientId);
  return hmac.digest('base64');
}

export async function loginUser(
  username: string,
  password: string
): Promise<InitiateAuthCommandOutput> {
  const authParams: Record<string, string> = {
    USERNAME: username,
    PASSWORD: password,
  };
  const secretHash = calculateSecretHash(username);
  if (secretHash) {
    authParams.SECRET_HASH = secretHash;
  }
  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: process.env.COGNITO_CLIENT_ID,
    AuthParameters: authParams,
  });
  return client.send(command);
}

export async function createUser(
  email: string,
  username: string,
  password: string
): Promise<string | undefined> {
  const command = new AdminCreateUserCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID,
    Username: username,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
    ],
    TemporaryPassword: password,
    MessageAction: 'SUPPRESS',
  });
  const response = await client.send(command);
  return response.User?.Username;
}

export async function getUserSub(username: string): Promise<string | undefined> {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username,
    });
    const response = await client.send(command);
    return response.Username;
  } catch {
    return undefined;
  }
}

export async function setUserPassword(
  username: string,
  password: string,
  permanent = true
): Promise<void> {
  const command = new AdminSetUserPasswordCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID,
    Username: username,
    Password: password,
    Permanent: permanent,
  });
  await client.send(command);
}

export async function deleteUser(username: string): Promise<void> {
  const command = new AdminDeleteUserCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID,
    Username: username,
  });
  await client.send(command);
}
