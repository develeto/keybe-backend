# OrderFlow — Plan de Arquitectura

## Stack Tecnológico
- **Runtime**: Node.js 20.x + TypeScript 5.x
- **IaC**: AWS CDK (TypeScript)
- **ORM**: Kysely (MySQL compatible)
- **Auth**: Amazon Cognito + JWT
- **Secretos**: AWS Secrets Manager
- **API**: Amazon API Gateway HTTP (único para todos los módulos)
- **Procesamiento async**: Amazon SQS + DLQ
- **Tareas periódicas**: Amazon EventBridge
- **Red**: VPC con subnets privadas/públicas, EC2 bastion (t4g.nano)
- **Tests**: Jest + ts-jest
- **CI/CD**: GitHub Actions (OIDC)
- **Documentación**: Swagger UI (Lambda dedicada)

## Onion Architecture

```
src/
├── modules/
│   ├── auth/         # Autenticación (login, register, JWT)
│   ├── orders/       # Gestión de pedidos (crear, consultar, procesar)
│   └── admin/        # Administración (listar/actualizar pedidos)
│       ├── domain/       → Entities, ValueObjects, Repository interfaces
│       ├── application/  → Use cases, DTOs (Zod schemas)
│       ├── infrastructure/ → DB repositorios, AWS adapters
│       └── interfaces/   → Lambda handlers (API)
├── shared/
│   ├── domain/
│   ├── infrastructure/
│   │   ├── db/kysely-client.ts        # Singleton Kysely pool
│   │   ├── cache/in-memory-cache.ts   # Singleton cache
│   │   ├── aws/cognito.ts             # Cognito wrapper
│   │   └── aws/secrets-manager.ts     # Secrets Manager
│   ├── utils/
│   │   ├── http-response.utils.ts     # ResponseHelper
│   │   ├── error-handler.utils.ts     # Custom errors
│   │   └── validate-input.utils.ts    # Zod validation
│   └── types/
└── docs/              # Swagger OpenAPI Lambda
```

## CDK Stack

```
cdk/
├── bin/order-flow.ts
├── lib/
│   ├── order-flow-stack.ts   # Stack único con toda la infra
│   └── constructs/
│       └── lambda-function.ts # Lambda construct reutilizable
```

### Recursos en CDK
- VPC (2 AZs, público + privado, 1 NAT Gateway)
- Aurora Serverless v2 (MySQL 8.0, 1 ACU min, 8 ACU max)
- Cognito User Pool + Client + grupo "admins"
- API Gateway HTTP + JWT Authorizer
- SQS Queue + DLQ (maxReceiveCount: 3)
- EventBridge Rule (cada 5 min, target Lambda report)
- Lambdas (login, register, createOrder, listOrders, getOrder, processOrder, adminListOrders, adminUpdateStatus, reportMetrics, swaggerUI, openapiSpec)
- EC2 t4g.nano bastion host (ARM64/Graviton, Amazon Linux 2023)
- Secrets Manager (DB credentials auto-generadas)
- IAM roles con mínimo privilegio

## API Endpoints

| Endpoint | Método | Auth | Lambda |
|----------|--------|------|--------|
| `POST /auth/login` | POST | No | LoginHandler |
| `POST /auth/register` | POST | No | RegisterHandler |
| `GET /orders` | GET | JWT | ListOrdersHandler |
| `POST /orders` | POST | JWT+Idempotency-Key | CreateOrderHandler |
| `GET /orders/{id}` | GET | JWT | GetOrderHandler |
| `GET /admin/orders` | GET | JWT+Admin | AdminListOrdersHandler |
| `PATCH /admin/orders/{id}/status` | PATCH | JWT+Admin | AdminUpdateOrderStatusHandler |
| `GET /docs/openapi.json` | GET | No | OpenApiSpecHandler |
| `GET /docs/ui` | GET | No | SwaggerUIHandler |

## Idempotencia en Pedidos
- Header obligatorio `Idempotency-Key` (UUID v4) en `POST /orders`
- Check `SELECT idempotency_key FROM orders WHERE idempotency_key = ?` antes de crear
- Unique constraint en columna `orders.idempotency_key` (garantía BD)
- Si existe → 200 OK con el pedido existente
- Si no → se crea con esa key en la misma transacción

## Flujo de Procesamiento
```
POST /orders (con Idempotency-Key)
  → CreateOrderHandler
    → valida con Zod
    → check idempotencia
    → inserta order (status: PENDING)
    → envía mensaje a SQS
    → retorna 201 Created

SQS Queue (VisibilityTimeout: 30s, maxReceiveCount: 3)
  → ProcessOrderHandler
    → actualiza status a PROCESSING
    → procesa items, calcula totales
    → actualiza status a COMPLETED
    → si falla → SQS reintenta hasta 3 veces
    → si persiste → DLQ

DLQ → Lambda de análisis + Alarma CloudWatch

EventBridge (cada 5 min)
  → ReportMetricsHandler
    → agrega métricas de pedidos
```

## CI/CD (GitHub Actions)
- `ci.yml`: lint + typecheck + test + coverage en cada PR
- `deploy.yml`: cdk deploy via OIDC en push a main

## Tests
- Unitarios con Jest + ts-jest
- Mocks de interfaces de repositorio
- Cobertura target: >95% statements, >91% branches

## Base de Datos
```sql
users: id (PK, auto), email (unique), username (unique), password_hash, status, created_at, updated_at
orders: id (PK, auto), user_id (FK), status, total, items (JSON), idempotency_key (unique), created_at, updated_at
order_status_history: id (PK, auto), order_id (FK), from_status, to_status, created_at
products: id (PK, auto), name, description, price, stock, created_at, updated_at
```

## Observabilidad
- Logs JSON estructurados con Pino → CloudWatch Logs
- Alarma CloudWatch: Lambda errors > 0 en 5 min

---

## Estado del Deploy

| Recurso | Estado | Detalle |
|---------|--------|---------|
| VPC | ✅ Desplegada | 2 AZs, 1 NAT Gateway |
| Aurora Serverless v2 | ✅ Desplegado | MySQL 8.0, min 1 ACU, max 8 ACU |
| Cognito User Pool | ✅ Desplegado | Pool + Client + grupo "admins" |
| API Gateway HTTP | ✅ Desplegado | JWT Authorizer + 9 rutas |
| SQS Queue + DLQ | ✅ Desplegado | maxReceiveCount: 3 |
| EventBridge Rule | ✅ Desplegado | Cada 5 min |
| 11 Lambda Functions | ✅ Desplegadas | Node.js 20, arm64 |
| EC2 Bastion | ✅ Desplegado | t4g.nano, key pair: order-flow-bastion-key-v2 |
| DB Schema + Seed | ✅ Ejecutado | 4 tablas, 8 productos |
| Tests | ✅ 59 tests | 9 suites pasando |
| Arquitectura de módulos | ✅ Corregido | Admin ya no importa infraestructura de orders. Puerto compartido en `shared/domain/ports/` |
| `shared/domain/` | ✅ Implementado | Entidades (Order, User, Product), value-objects (OrderStatus), ports (OrderAdminPort) |
| `shared/types/` | ✅ Implementado | ApiResponse, Pagination, types compartidos |
| `cdk/lib/constructs/lambda-function.ts` | ✅ Implementado | LambdaFunction construct reutilizable |
| CI/CD | ✅ Configurado | pnpm + OIDC + quality gate en ci.yml y deploy.yml |

### Próximos pasos
- [x] Crear usuario admin en Cognito
- [x] Probar endpoints con curl/Postman
- [x] Configurar CI/CD (GitHub Actions + OIDC)
- [ ] Configurar dominio custom para API Gateway
- [ ] Agregar más tests de integración
- [ ] Eliminar `credentials.txt` con secrets productivos
- [ ] Agregar tests CDK en `cdk/test/`
- [ ] Implementar patrones de resiliencia en `src/shared/infrastructure/resilience/`
