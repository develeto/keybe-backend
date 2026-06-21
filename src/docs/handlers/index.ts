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
    description: 'API de gestión de pedidos OrderFlow. Sistema serverless con autenticación via Cognito, procesamiento asíncrono de órdenes, y notificaciones en tiempo real.',
    contact: {
      name: 'OrderFlow Team',
    },
  },
  servers,
  paths: {
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Iniciar sesión',
        description: 'Autentica un usuario con credenciales y devuelve JWT tokens (IdToken, AccessToken, RefreshToken) de Amazon Cognito. El IdToken se usa para autorizar requests posteriores.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', example: 'Admin1234!' },
                },
                required: ['username', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login exitoso. Devuelve tokens JWT y datos del usuario.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        token: {
                          type: 'object',
                          properties: {
                            IdToken: { type: 'string', description: 'JWT para autorizar requests' },
                            AccessToken: { type: 'string' },
                            RefreshToken: { type: 'string' },
                          },
                        },
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'number' },
                            username: { type: 'string' },
                            email: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Credenciales inválidas (usuario no existe o password incorrecto)',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { error: { type: 'string' } } },
              },
            },
          },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Registrar nuevo usuario',
        description: 'Crea un nuevo usuario en el sistema. El password debe tener al menos 8 caracteres. El email debe ser único.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email', example: 'user@example.com' },
                  username: { type: 'string', example: 'testuser' },
                  password: { type: 'string', minLength: 8, example: 'Test1234!' },
                },
                required: ['email', 'username', 'password'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Usuario creado exitosamente. Se debe hacer login después con las credenciales.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'number' },
                            username: { type: 'string' },
                            email: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '409': {
            description: 'El usuario ya existe (email o username duplicado)',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { error: { type: 'string' } } },
              },
            },
          },
          '400': {
            description: 'Validación fallida (password muy corto, email inválido, etc.)',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { error: { type: 'string' } } },
              },
            },
          },
        },
      },
    },
    '/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Crear un pedido',
        description: 'Crea un nuevo pedido para el usuario autenticado. Requiere header Idempotency-Key para garantizar que no se crean duplicados. Si se reintenta con la misma key, devuelve el pedido original (200 OK).',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'UUID v4 único para esta solicitud. Si se reintenta con la misma key, devuelve el resultado anterior.',
            example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
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
                    minItems: 1,
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'number', example: 1 },
                        quantity: { type: 'number', minimum: 1, example: 2 },
                        price: { type: 'number', minimum: 0, example: 1499.99 },
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
          '201': {
            description: 'Pedido creado exitosamente. El estado inicial es PENDING y se encola automáticamente para procesamiento asíncrono.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] },
                        items: { type: 'array' },
                        created_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          '200': {
            description: 'Pedido ya existe (misma Idempotency-Key). Devuelve el pedido original.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        status: { type: 'string' },
                        items: { type: 'array' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'No autorizado (falta JWT válido)',
          },
          '400': {
            description: 'Validación fallida (Idempotency-Key faltante, items vacío, etc.)',
          },
        },
      },
      get: {
        tags: ['Orders'],
        summary: 'Listar mis pedidos',
        description: 'Lista todos los pedidos del usuario autenticado con paginación. Cada usuario solo ve sus propios pedidos.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'number', default: 20 }, description: 'Cantidad de resultados (máx 100)' },
          { name: 'offset', in: 'query', schema: { type: 'number', default: 0 }, description: 'Desplazamiento para paginación' },
        ],
        responses: {
          '200': {
            description: 'Lista de pedidos del usuario con información de paginación.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        items: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'number' },
                              status: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                            },
                          },
                        },
                        pagination: {
                          type: 'object',
                          properties: {
                            limit: { type: 'number' },
                            offset: { type: 'number' },
                            total: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'No autorizado',
          },
        },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Obtener detalle de un pedido',
        description: 'Obtiene el detalle completo de un pedido incluyendo historial de cambios de estado. Solo el propietario del pedido o un admin puede verlo.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'number' }, description: 'ID del pedido', example: 1 },
        ],
        responses: {
          '200': {
            description: 'Detalle del pedido con historial de transiciones de estado.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        status: { type: 'string' },
                        user_id: { type: 'number' },
                        items: { type: 'array' },
                        created_at: { type: 'string', format: 'date-time' },
                        status_history: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              status: { type: 'string' },
                              changed_at: { type: 'string', format: 'date-time' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Pedido no encontrado o no pertenece al usuario autenticado',
          },
          '401': {
            description: 'No autorizado',
          },
        },
      },
    },
    '/admin/orders': {
      get: {
        tags: ['Admin'],
        summary: 'Listar todos los pedidos (admin)',
        description: 'Lista TODOS los pedidos del sistema (no solo del usuario). Requiere rol admin. Soporta filtrado por estado.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'number', default: 20 }, description: 'Cantidad de resultados' },
          { name: 'offset', in: 'query', schema: { type: 'number', default: 0 }, description: 'Desplazamiento para paginación' },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
            },
            description: 'Filtrar por estado (opcional)',
          },
        ],
        responses: {
          '200': {
            description: 'Lista de todos los pedidos con paginación.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        items: { type: 'array' },
                        pagination: {
                          type: 'object',
                          properties: {
                            limit: { type: 'number' },
                            offset: { type: 'number' },
                            total: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '403': {
            description: 'Acceso denegado (usuario no es admin)',
          },
          '401': {
            description: 'No autorizado',
          },
        },
      },
    },
    '/admin/orders/{id}/status': {
      patch: {
        tags: ['Admin'],
        summary: 'Actualizar estado de un pedido (admin)',
        description: 'Cambia el estado de un pedido manualmente. Valida que la transición sea permitida (ej: PENDING → PROCESSING es válido, pero COMPLETED → PENDING no). Publica notificación en SNS cuando el estado cambia.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'number' }, description: 'ID del pedido', example: 1 },
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
                    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED'],
                    description: 'Nuevo estado del pedido',
                  },
                },
                required: ['status'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Estado actualizado exitosamente. Se registra en el historial y se publica notificación SNS.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        status: { type: 'string' },
                        updated_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Transición de estado inválida. Ver mensaje de error para detalles.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'string',
                      example: 'Invalid transition from COMPLETED to PENDING',
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Pedido no encontrado',
          },
          '403': {
            description: 'Acceso denegado (usuario no es admin)',
          },
          '401': {
            description: 'No autorizado',
          },
        },
      },
    },
    '/admin/products': {
      post: {
        tags: ['Products'],
        summary: 'Crear un producto (admin)',
        description: 'Crea un nuevo producto en el catálogo global. Requiere autenticación.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Nombre del producto', example: 'Laptop Gamer' },
                  description: { type: 'string', description: 'Descripción del producto', example: 'RTX 4070, 32GB RAM', nullable: true },
                  price: { type: 'number', description: 'Precio', example: 24999.99 },
                  stock: { type: 'integer', description: 'Stock disponible (default: 0)', example: 10 },
                  status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'], description: 'Estado del producto (default: ACTIVE)' },
                },
                required: ['name', 'price'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Producto creado exitosamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                        description: { type: 'string', nullable: true },
                        price: { type: 'number' },
                        stock: { type: 'integer' },
                        status: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Validación fallida (nombre vacío, precio negativo, etc.)' },
          '401': { description: 'No autorizado' },
        },
      },
      get: {
        tags: ['Products'],
        summary: 'Listar todos los productos (admin)',
        description: 'Lista todos los productos del catálogo, incluyendo INACTIVE. Requiere autenticación.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'number', default: 20 }, description: 'Cantidad de resultados' },
          { name: 'offset', in: 'query', schema: { type: 'number', default: 0 }, description: 'Desplazamiento para paginación' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] }, description: 'Filtrar por estado (opcional)' },
        ],
        responses: {
          '200': {
            description: 'Lista de productos con paginación.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        products: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'number' },
                              name: { type: 'string' },
                              price: { type: 'number' },
                              stock: { type: 'integer' },
                              status: { type: 'string' },
                            },
                          },
                        },
                        total: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'No autorizado' },
        },
      },
    },
    '/admin/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Obtener detalle de un producto (admin)',
        description: 'Obtiene el detalle completo de un producto por su ID. Requiere autenticación.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'number' }, description: 'ID del producto', example: 1 },
        ],
        responses: {
          '200': {
            description: 'Detalle del producto.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                        description: { type: 'string', nullable: true },
                        price: { type: 'number' },
                        stock: { type: 'integer' },
                        status: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': { description: 'Producto no encontrado' },
          '401': { description: 'No autorizado' },
        },
      },
      patch: {
        tags: ['Products'],
        summary: 'Actualizar un producto (admin)',
        description: 'Actualiza parcial o totalmente un producto. Todos los campos son opcionales. Requiere autenticación.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'number' }, description: 'ID del producto', example: 1 },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Nombre del producto' },
                  description: { type: 'string', nullable: true },
                  price: { type: 'number', description: 'Precio' },
                  stock: { type: 'integer', description: 'Stock disponible' },
                  status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'], description: 'Estado' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Producto actualizado exitosamente.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                        price: { type: 'number' },
                        stock: { type: 'integer' },
                        status: { type: 'string' },
                        updated_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': { description: 'Producto no encontrado' },
          '400': { description: 'Validación fallida' },
          '401': { description: 'No autorizado' },
        },
      },
    },
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'Listar productos activos',
        description: 'Lista solo los productos activos (status=ACTIVE) del catálogo. No requiere admin.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'number', default: 20 }, description: 'Cantidad de resultados' },
          { name: 'offset', in: 'query', schema: { type: 'number', default: 0 }, description: 'Desplazamiento para paginación' },
        ],
        responses: {
          '200': {
            description: 'Lista de productos activos con paginación.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        products: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'number' },
                              name: { type: 'string' },
                              description: { type: 'string', nullable: true },
                              price: { type: 'number' },
                              stock: { type: 'integer' },
                            },
                          },
                        },
                        total: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'No autorizado' },
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
        description: 'JWT token obtenido del endpoint /auth/login. Usar como: Authorization: Bearer {IdToken}',
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

