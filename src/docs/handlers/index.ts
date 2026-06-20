import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

function buildOpenApiSpec(baseUrl?: string) {
  const servers = [
    {
      url: baseUrl ?? 'http://localhost:4000',
      description: 'Current API',
    },
  ];

  return {
  openapi: '3.0.0',
  info: {
    title: 'OrderFlow API',
    version: '1.0.0',
    description: 'API de gestión de pedidos OrderFlow',
    contact: {
      name: 'OrderFlow Team',
    },
  },
  servers,
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['username', 'password'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login exitoso' },
          '401': { description: 'Credenciales inválidas' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registrar nuevo usuario',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  username: { type: 'string' },
                  password: { type: 'string', minLength: 8 },
                },
                required: ['email', 'username', 'password'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Usuario creado' },
          '409': { description: 'Usuario ya existe' },
        },
      },
    },
    '/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Crear un pedido',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'Key de idempotencia para evitar duplicados',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'number' },
                        quantity: { type: 'number', minimum: 1 },
                        price: { type: 'number', minimum: 0 },
                      },
                      required: ['product_id', 'quantity', 'price'],
                    },
                  },
                },
                required: ['items'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Pedido creado' },
          '200': { description: 'Pedido ya existente (idempotencia)' },
        },
      },
      get: {
        tags: ['Orders'],
        summary: 'Listar mis pedidos',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'number', default: 20 } },
          { name: 'offset', in: 'query', schema: { type: 'number', default: 0 } },
        ],
        responses: {
          '200': { description: 'Lista de pedidos' },
        },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Obtener detalle de un pedido',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'number' } },
        ],
        responses: {
          '200': { description: 'Detalle del pedido' },
          '404': { description: 'Pedido no encontrado' },
        },
      },
    },
    '/admin/orders': {
      get: {
        tags: ['Admin'],
        summary: 'Listar todos los pedidos (admin)',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'number', default: 20 } },
          { name: 'offset', in: 'query', schema: { type: 'number', default: 0 } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Lista de pedidos' },
        },
      },
    },
    '/admin/orders/{id}/status': {
      patch: {
        tags: ['Admin'],
        summary: 'Actualizar estado de un pedido (admin)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'number' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['VALIDATING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED'],
                  },
                },
                required: ['status'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Estado actualizado' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  };
}

function getBaseUrl(event: APIGatewayProxyEvent): string {
  const stage = event.requestContext?.stage || 'dev';
  const domainName = event.requestContext?.domainName || 'localhost:4000';
  const protocol = event.headers?.['X-Forwarded-Proto'] || 'https';
  const stagePath = stage === '$default' ? '' : `/${stage}`;
  return `${protocol}://${domainName}${stagePath}`;
}

export const openapiSpec = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const baseUrl = getBaseUrl(event);
  const spec = buildOpenApiSpec(baseUrl);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(spec, null, 2),
  };
};

export const swaggerUI = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const isOffline = process.env.IS_OFFLINE === 'true';
  const baseUrl = isOffline ? 'http://localhost:4000' : getBaseUrl(event);
  const specUrl = `${baseUrl}/docs/openapi.json`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OrderFlow API - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '${specUrl}',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
      layout: "BaseLayout",
    });
  </script>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
    body: html,
  };
};
