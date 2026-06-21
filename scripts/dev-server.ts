/**
 * Dev Server — Simula API Gateway localmente
 * 
 * Uso: npx ts-node scripts/dev-server.ts
 * 
 * Este servidor emula API Gateway HTTP + Cognito JWT authorizer
 * para que puedas probar los endpoints sin deploy a AWS.
 * 
 * Características:
 * - Mock de Cognito (genera tokens JWT falsos)
 * - Mock de BD en memoria
 * - Mock de SQS (solo log)
 * - Recarga automática con --watch
 */

import http from 'http';

const PORT = 4000;

// ────────────────────────────────────────────
// Mock Database (in-memory)
// ────────────────────────────────────────────
interface MockUser {
  id: number;
  email: string;
  username: string;
  password: string;
  status: string;
}

interface MockOrder {
  id: number;
  user_id: number;
  status: string;
  total: number;
  items: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

const mockDb = {
  users: [
    { id: 1, email: 'admin@orderflow.com', username: 'admin', password: 'Admin123!', status: 'ACTIVE' },
    { id: 2, email: 'user@orderflow.com', username: 'user', password: 'User1234!', status: 'ACTIVE' },
  ] as MockUser[],
  orders: [] as MockOrder[],
  nextUserId: 3,
  nextOrderId: 1,
};

// ────────────────────────────────────────────
// Mock JWT — simple base64 encoded JSON
// ────────────────────────────────────────────
function createMockToken(userId: number, username: string, role = 'user'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: String(userId),
      username,
      role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  return `${header}.${payload}.mocksignature`;
}

// ────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────
function handleAuth(req: http.IncomingMessage, body: Record<string, unknown>) {
  if (req.url === '/auth/login' && req.method === 'POST') {
    const { username, password } = body as { username?: string; password?: string };
    const user = mockDb.users.find((u) => u.username === username);

    if (!user || user.password !== password) {
      return {
        statusCode: 401,
        body: JSON.stringify({ status: 'error', message: 'Usuario o contraseña incorrectos', data: null, error: false }),
      };
    }

    const token = createMockToken(user.id, user.username);
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        message: 'Login successful',
        data: {
          token: { AccessToken: token, IdToken: token, RefreshToken: token },
          user: { id: user.id, email: user.email, username: user.username, status: user.status },
        },
        error: false,
      }),
    };
  }

  if (req.url === '/auth/register' && req.method === 'POST') {
    const { email, username, password } = body as { email?: string; username?: string; password?: string };
    const exists = mockDb.users.find((u) => u.username === username || u.email === email);

    if (exists) {
      return {
        statusCode: 409,
        body: JSON.stringify({ status: 'error', message: 'El usuario ya existe', data: null, error: 'ConflictError' }),
      };
    }

    const newUser: MockUser = {
      id: mockDb.nextUserId++,
      email: email!,
      username: username!,
      password: password!,
      status: 'ACTIVE',
    };
    mockDb.users.push(newUser);

    return {
      statusCode: 201,
      body: JSON.stringify({
        status: 'success',
        message: 'User registered successfully',
        data: { id: newUser.id, email: newUser.email, username: newUser.username },
        error: false,
      }),
    };
  }

  return null;
}

function handleOrders(req: http.IncomingMessage, body: Record<string, unknown>, mockUser?: MockUser) {
  const path = req.url || '/';
  const method = req.method || 'GET';

  // Extract order ID from path: /orders/123
  const orderIdMatch = path.match(/^\/orders\/(\d+)$/);

  if (path === '/orders' && method === 'POST') {
    if (!mockUser) {
      return {
        statusCode: 401,
        body: JSON.stringify({ status: 'error', message: 'Unauthorized', data: null, error: false }),
      };
    }

    const idempotencyKey = (req.headers['idempotency-key'] || req.headers['Idempotency-Key']) as string;
    if (!idempotencyKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: 'error', message: 'Idempotency-Key header is required', data: null, error: false }),
      };
    }

    // Check idempotency
    const existing = mockDb.orders.find((o) => o.idempotency_key === idempotencyKey);
    if (existing) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'success',
          message: 'Order already exists',
          data: { ...existing, items: JSON.parse(existing.items), duplicated: true },
          error: false,
        }),
      };
    }

    const { items } = body as { items?: Array<{ product_id: number; quantity: number; price: number }> };
    if (!items || items.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: 'error', message: 'Order must have at least one item', data: null, error: false }),
      };
    }

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const newOrder: MockOrder = {
      id: mockDb.nextOrderId++,
      user_id: mockUser.id,
      status: 'PENDING',
      total,
      items: JSON.stringify(items),
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockDb.orders.push(newOrder);

    console.log(`  [SQS] Encolando procesamiento de orden #${newOrder.id}`);

    return {
      statusCode: 201,
      body: JSON.stringify({
        status: 'success',
        message: 'Order created successfully',
        data: { ...newOrder, items, duplicated: false },
        error: false,
      }),
    };
  }

  if (path === '/orders' && method === 'GET') {
    if (!mockUser) {
      return {
        statusCode: 401,
        body: JSON.stringify({ status: 'error', message: 'Unauthorized', data: null, error: false }),
      };
    }

    const userOrders = mockDb.orders.filter((o) => o.user_id === mockUser.id);
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        message: 'Orders retrieved successfully',
        data: { orders: userOrders, total: userOrders.length },
        error: false,
      }),
    };
  }

  if (orderIdMatch && method === 'GET') {
    if (!mockUser) {
      return {
        statusCode: 401,
        body: JSON.stringify({ status: 'error', message: 'Unauthorized', data: null, error: false }),
      };
    }

    const orderId = parseInt(orderIdMatch[1], 10);
    const order = mockDb.orders.find((o) => o.id === orderId && o.user_id === mockUser.id);
    if (!order) {
      return {
        statusCode: 404,
        body: JSON.stringify({ status: 'error', message: 'Order not found', data: null, error: false }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        message: 'Order retrieved successfully',
        data: { ...order, items: JSON.parse(order.items) },
        error: false,
      }),
    };
  }

  return null;
}

function handleAdmin(req: http.IncomingMessage, body: Record<string, unknown>) {
  const path = req.url || '/';
  const method = req.method || 'GET';

  const statusMatch = path.match(/^\/admin\/orders\/(\d+)\/status$/);

  if (path === '/admin/orders' && method === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        message: 'Orders retrieved successfully',
        data: {
          orders: mockDb.orders.map((o) => ({ ...o, items: JSON.parse(o.items) })),
          total: mockDb.orders.length,
        },
        error: false,
      }),
    };
  }

  if (statusMatch && method === 'PATCH') {
    const orderId = parseInt(statusMatch[1], 10);
    const { status: newStatus } = body as { status?: string };
    const validStatuses = ['PENDING', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED'];

    if (!newStatus || !validStatuses.includes(newStatus)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: 'error', message: `Invalid status. Valid: ${validStatuses.join(', ')}`, data: null, error: false }),
      };
    }

    const order = mockDb.orders.find((o) => o.id === orderId);
    if (!order) {
      return {
        statusCode: 404,
        body: JSON.stringify({ status: 'error', message: 'Order not found', data: null, error: false }),
      };
    }

    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['VALIDATING', 'PROCESSING', 'CANCELLED'],
      VALIDATING: ['PROCESSING', 'FAILED', 'CANCELLED'],
      PROCESSING: ['COMPLETED', 'FAILED'],
      COMPLETED: [],
      CANCELLED: [],
      FAILED: [],
    };

    if (!(allowedTransitions[order.status] || []).includes(newStatus)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          status: 'error',
          message: `Cannot transition from ${order.status} to ${newStatus}`,
          data: null,
          error: false,
        }),
      };
    }

    order.status = newStatus;
    order.updated_at = new Date().toISOString();

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        message: 'Order status updated successfully',
        data: { id: order.id, status: order.status },
        error: false,
      }),
    };
  }

  return null;
}

function handleDocs(req: http.IncomingMessage) {
  if (req.url === '/docs/openapi.json' && req.method === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'OrderFlow API', version: '1.0.0' },
        servers: [{ url: `http://localhost:${PORT}`, description: 'Dev server' }],
      }),
    };
  }

  if (req.url === '/docs/ui' && req.method === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<!DOCTYPE html><html><head><title>OrderFlow API Docs</title></head><body>
<h1>OrderFlow API</h1>
<p>Dev server running on <a href="/docs/openapi.json">OpenAPI JSON</a></p>
<p>Use the curl commands from README.md</p>
</body></html>`,
    };
  }

  return null;
}

// ────────────────────────────────────────────
// Server
// ────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Collect body
  let rawBody = '';
  req.on('data', (chunk) => (rawBody += chunk));
  req.on('end', () => {
    const body = rawBody ? JSON.parse(rawBody) : {};

    // Parse authorization header for mock user
    const authHeader = req.headers['authorization'] as string;
    let mockUser: MockUser | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        mockUser = mockDb.users.find((u) => u.id === Number(payload.sub));
      } catch {
        // Invalid token
      }
    }

    // Log request
    console.log(`\n  → ${req.method} ${req.url}`);
    if (mockUser) console.log(`  👤 ${mockUser.username} (ID: ${mockUser.id})`);

    // Route
    let response = handleAuth(req, body);
    if (!response) response = handleOrders(req, body, mockUser);
    if (!response) response = handleAdmin(req, body, mockUser);
    if (!response) response = handleDocs(req);

    if (!response) {
      response = {
        statusCode: 404,
        body: JSON.stringify({ status: 'error', message: 'Not found' }),
      };
    }

    const statusCode = response.statusCode || 200;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...(response.headers || {}),
    };

    res.writeHead(statusCode, headers);
    res.end(response.body);

    // Pretty print response
    const color = statusCode < 300 ? '\x1b[32m' : statusCode < 500 ? '\x1b[33m' : '\x1b[31m';
    console.log(`  ${color}← ${statusCode}\x1b[0m`);
    try {
      const parsed = JSON.parse(response.body);
      console.log(`  ${color}📦 ${JSON.stringify(parsed, null, 2).slice(0, 500)}\x1b[0m`);
    } catch {
      console.log(`  📦 ${response.body.slice(0, 200)}`);
    }
  });
});

server.listen(PORT, () => {
  console.log('\n══════════════════════════════════════════');
  console.log('  🚀 OrderFlow Dev Server');
  console.log(`  📍 http://localhost:${PORT}`);
  console.log('\n  Usuarios de prueba:');
  console.log('    admin / Admin123! (rol admin)');
  console.log('    user  / User1234! (rol user)');
  console.log('\n  Endpoints:');
  console.log('    POST   /auth/login');
  console.log('    POST   /auth/register');
  console.log('    POST   /orders         (requiere JWT + Idempotency-Key)');
  console.log('    GET    /orders         (requiere JWT)');
  console.log('    GET    /orders/:id     (requiere JWT)');
  console.log('    GET    /admin/orders   (requiere JWT)');
  console.log('    PATCH  /admin/orders/:id/status (requiere JWT)');
  console.log('    GET    /docs/ui');
  console.log('    GET    /docs/openapi.json');
  console.log('\n  Ejemplo rápido (PowerShell):');
  console.log('    1. Login:');
  console.log('       curl -X POST http://localhost:4000/auth/login ^');
  console.log('         -H "Content-Type: application/json" ^');
  console.log('         -d \'{"username":"user","password":"User1234!"}\'');
  console.log('\n    2. Crear pedido (reemplaza TOKEN):');
  console.log('       curl -X POST http://localhost:4000/orders ^');
  console.log('         -H "Content-Type: application/json" ^');
  console.log('         -H "Authorization: Bearer TOKEN" ^');
  console.log('         -H "Idempotency-Key: $(New-Guid)" ^');
  console.log('         -d \'{"items":[{"product_id":1,"quantity":2,"price":10}]}\'');
  console.log('══════════════════════════════════════════\n');
});
