# OrderFlow — Backend Serverless

Backend serverless para gestión de pedidos, construido con TypeScript, AWS CDK y arquitectura onion.

## Stack Tecnológico

| Componente          | Tecnología                       |
| ------------------- | -------------------------------- |
| Runtime             | Node.js 20.x + TypeScript 5.x    |
| IaC                 | AWS CDK (TypeScript)             |
| ORM                 | Kysely (MySQL compatible)        |
| Autenticación       | Amazon Cognito + JWT             |
| Secretos            | AWS Secrets Manager              |
| API                 | Amazon API Gateway HTTP          |
| Procesamiento async | Amazon SQS + DLQ                 |
| Tareas periódicas   | Amazon EventBridge               |
| Base de datos       | Aurora Serverless v2 (MySQL 8.0) |
| Tests               | Jest + ts-jest                   |
| CI/CD               | GitHub Actions (OIDC)            |

## Descripción de la aplicación

OrderFlow cubre 6 necesidades funcionales. Aquí cómo se resolvió cada una:

### 1. Usuarios y autenticación

Login y registro vía Amazon Cognito + JWT. Los handlers validan con Zod, verifican bcrypt contra la BD y delegan en Cognito para emitir tokens. API Gateway valida el JWT automáticamente (sin Lambda custom authorizer).

**Flujo**: `POST /auth/login` → valida input → busca usuario en BD → verifica password con bcrypt → `AdminInitiateAuth` en Cognito → devuelve tokens JWT → el cliente usa el `IdToken` en el header `Authorization` para endpoints protegidos.

**Archivos clave**: `src/modules/auth/interfaces/api/login.handler.ts`, `register.handler.ts`, `src/shared/infrastructure/aws/cognito.ts`

### 2. Gestión de pedidos

Cliente autenticado crea pedidos (con idempotencia vía header `Idempotency-Key`), lista los suyos y consulta detalles. Unique constraint en `orders.idempotency_key` garantiza que no haya duplicados.

**Flujo**: `POST /orders` (con JWT + Idempotency-Key) → valida input → resuelve userId desde Cognito `sub` → inserta en BD → encola mensaje en SQS → responde 201. `GET /orders` lista del usuario autenticado. `GET /orders/{id}` obtiene uno verificando pertenencia.

**Archivos clave**: `src/modules/orders/interfaces/api/order.handlers.ts`, `src/modules/orders/infrastructure/db/orders.repository.ts`

### 3. Procesamiento de pedidos (asíncrono)

Cada pedido se procesa en background vía SQS. El handler es invocado por el evento SQS, transiciona el estado PENDING → PROCESSING → COMPLETED (validado por `canTransition()`), y registra el historial en `order_status_history`.

**Flujo**: CreateOrder encola `{ orderId, action: "PROCESS_ORDER" }` → SQS dispara `ProcessOrderFunction` → cambia a PROCESSING → (simula trabajo) → cambia a COMPLETED. Si falla: 3 reintentos con backoff, luego a DLQ.

**Arquitectura**: SQS estándar + DLQ con `maxReceiveCount=3`, `visibilityTimeout=60s`.

**Archivos clave**: `src/modules/orders/infrastructure/sqs/process-order.handler.ts`, `src/shared/domain/value-objects/order-status.ts` (transiciones)

### 4. Administración

El módulo admin permite listar todos los pedidos y actualizar su estado (con validación de transiciones). Sigue el patrón puerto-adaptador: `OrderAdminPort` en shared define la interfaz, `OrderAdminAdapter` implementa con Kysely directo — sin importar infraestructura del módulo orders.

**Flujo**: `GET /admin/orders` → listar todos (opcional filter por status). `PATCH /admin/orders/{id}/status` → validar transición → actualizar + historial + notificar SNS.

**Transiciones válidas**: PENDING → PROCESSING, PENDING → CANCELLED, PROCESSING → COMPLETED, PROCESSING → FAILED.

**Archivos clave**: `src/modules/admin/interfaces/api/admin.handlers.ts`, `src/shared/infrastructure/db/order-admin.adapter.ts`, `src/shared/domain/ports/order-admin.port.ts`

### 5. Tareas recurrentes

Cada 5 minutos, EventBridge dispara `ReportMetricsFunction` que consulta la BD y loguea métricas con Pino (total orders, pendientes, completados hoy). Las alarmas CloudWatch monitorean errores de todas las Lambdas.

**Infraestructura**: Regla EventBridge `rate(5 minutes)` → target Lambda. 11 alarmas CloudWatch (1 por Lambda, errors > 0 en 5 min).

**Archivos clave**: `src/modules/orders/infrastructure/sqs/report-metrics.handler.ts`, `cdk/lib/order-flow-stack.ts:248-251`

### 6. Avisos de cambios de estado

Cuando un pedido cambia de estado (por admin o por procesamiento asíncrono), se publica un mensaje JSON en un tópico SNS. Cualquier servicio externo puede suscribirse (email, SMS, Lambda, SQS, HTTP).

**Formato del mensaje SNS**:

```json
{
  "event": "order.status.changed",
  "orderId": 1,
  "fromStatus": "PENDING",
  "toStatus": "PROCESSING",
  "timestamp": "2026-06-20T16:00:00.000Z"
}
```

**Arquitectura**: `OrderNotificationPort` (interfaz) → `OrderNotificationAdapter` → `publishToTopic()` en SNS. El topic ARN se inyecta vía env var `ORDER_STATUS_CHANGED_TOPIC_ARN`.

**Tópico SNS**: `arn:aws:sns:us-east-1:266176113590:order-flow-status-changed`

**Archivos clave**: `src/shared/domain/ports/order-notification.port.ts`, `src/shared/infrastructure/notifications/order-notification.adapter.ts`, `src/shared/infrastructure/aws/sns.ts`

---

## Stack Tecnológico

## Prerrequisitos

- Node.js 20+
- pnpm
- AWS CLI configurado con perfil `keybe`
- Cuenta AWS con permisos para crear recursos CDK

```bash
aws configure --profile keybe
# AWS Access Key ID: <tu-access-key>
# AWS Secret Access Key: <tu-secret-key>
# Default region: us-east-1
# Default output: json
```

## Instalación

```bash
# Instalar dependencias
pnpm install

# Compilar TypeScript
pnpm tsc

# Bootstrapear CDK (solo primera vez por cuenta/región)
pnpm cdk:bootstrap

# Desplegar (~15 min la primera vez)
pnpm cdk:deploy
```

## Obtener Outputs del Deploy

```bash
# Desde la terminal (después del deploy)
aws cloudformation describe-stacks --stack-name OrderFlowStack \
  --query "Stacks[0].Outputs" --profile keybe --region us-east-1

# O desde consola AWS → CloudFormation → Stacks → OrderFlowStack → Outputs
```

Los outputs incluyen:

- `ApiUrl` — URL base de API Gateway
- `SwaggerUrl` — URL de Swagger UI
- `UserPoolId` / `UserPoolClientId` — IDs de Cognito
- `DatabaseEndpoint` — Endpoint de Aurora
- `OrdersQueueUrl` — URL de SQS

## EC2 Bastion — SSH Setup

Cada desarrollador debe crear su propio key pair para acceder al bastión:

```bash
# 1. Crear key pair en AWS
aws ec2 create-key-pair --key-name "order-flow-bastion-$USER" \
  --query "KeyMaterial" --output text --profile keybe > ~/.ssh/order-flow-bastion-$USER.pem

chmod 400 ~/.ssh/order-flow-bastion-$USER.pem


# 2. Asociar al bastión existente
BASTION_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=OrderFlowStack/BastionHost" \
  --query "Reservations[*].Instances[*].InstanceId" --output text --profile keybe --region us-east-1)
aws ec2 modify-instance-attribute --instance-id $BASTION_ID \
  --key-name "order-flow-bastion-$USER" --profile keybe

# Nota: modificar el key pair requiere reemplazar la instancia.
# Alternativa recomendada: actualizar cdk/lib/order-flow-stack.ts para usar
# keyPair con el nombre de tu key, luego hacer cdk deploy.

# 3. Conectar
ssh -i ~/.ssh/order-flow-bastion-$USER.pem ec2-user@<bastion-public-ip>
```

> **⚠️ Importante:** El CDK usa `keyPair` en el construct `Instance`. Si cambias de desarrollador, actualiza el nombre del key pair en `cdk/lib/order-flow-stack.ts` y redepliega.

## Base de Datos

### Obtener credenciales

```bash
aws secretsmanager get-secret-value --secret-id order-flow-OrderFlowStack-db-credentials \
  --query "SecretString" --output text --profile keybe
```

### Inicializar (schema + seed)

```bash
# Conectar al bastión primero, luego:
mysql -h <aurora-endpoint> -u admin -p orderflow < database/schema.sql
mysql -h <aurora-endpoint> -u admin -p orderflow < database/seed.sql
```

O desde tu máquina local si tienes acceso a la VPC (VPN/tunnel):

```bash
mysql -h <aurora-endpoint> -u admin -p -P 3306 orderflow < database/schema.sql
mysql -h <aurora-endpoint> -u admin -p -P 3306 orderflow < database/seed.sql
```

### Verificar

```bash
mysql -h <aurora-endpoint> -u admin -p orderflow -e "SHOW TABLES;"
# Debe mostrar: order_status_history, orders, products, users

mysql -h <aurora-endpoint> -u admin -p orderflow -e "SELECT * FROM products;"
# Debe mostrar 8 productos seed (laptop, mouse, keyboard, etc.)
```

El esquema está en `database/schema.sql`. Seed data en `database/seed.sql`.

## Crear Usuario Admin en Cognito

```bash
# 1. Obtener IDs de Cognito de los outputs del stack
# 2. Crear usuario admin
aws cognito-idp admin-create-user \
  --user-pool-id <user-pool-id> \
  --username admin \
  --temporary-password "Admin1234!" \
  --user-attributes Name=email,Value=admin@orderflow.com \
  --profile keybe --region us-east-1

# 3. Establecer password permanente
aws cognito-idp admin-set-user-password \
  --user-pool-id <user-pool-id> \
  --username admin \
  --password "Admin1234!" \
  --permanent \
  --profile keybe --region us-east-1

# 4. Agregar al grupo admins
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <user-pool-id> \
  --username admin \
  --group-name admins \
  --profile keybe --region us-east-1
```

## API Endpoints

### Autenticación (públicos)

```bash
# Login
curl -X POST <api-url>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin1234!"}'

# Registro
curl -X POST <api-url>/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"testuser","password":"Test1234!"}'
```

### Pedidos (requieren JWT)

```bash
# Obtener token
TOKEN=$(curl -s -X POST <api-url>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin1234!"}' | jq -r '.data.token.IdToken')

# Crear pedido (con idempotencia)
curl -X POST <api-url>/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"items":[{"product_id":1,"quantity":2,"price":1499.99}]}'

# Listar mis pedidos
curl -X GET <api-url>/orders \
  -H "Authorization: Bearer $TOKEN"

# Obtener pedido por ID
curl -X GET <api-url>/orders/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Admin (requieren JWT + rol admin)

```bash
# Listar todos los pedidos
curl -X GET <api-url>/admin/orders \
  -H "Authorization: Bearer $TOKEN"

# Actualizar estado de pedido
curl -X PATCH <api-url>/admin/orders/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"COMPLETED"}'
```

### Documentación

```bash
# Swagger UI (abrir en navegador)
open <swagger-url>

# OpenAPI spec (JSON)
curl <api-url>/docs/openapi.json
```

## Verificar Componentes

1. **EC2 Bastion**: SSH a la instancia bastion

   ```bash
   ssh -i ~/.ssh/order-flow-bastion-<username>.pem ec2-user@<bastion-public-ip>
   ```

2. **SQS DLQ**: Ver mensajes fallidos

   ```bash
   aws sqs receive-message --queue-url <dlq-url> --profile keybe
   ```

3. **CloudWatch Logs**: Ver logs de Lambda

   ```bash
   aws logs describe-log-groups --log-group-name-prefix /aws/lambda/OrderFlowStack- --profile keybe
   ```

4. **RDS Query**: Tablas disponibles
   ```bash
   mysql -h <aurora-endpoint> -u admin -p orderflow -e "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA='orderflow'"
   ```

## Idempotencia

Todos los `POST /orders` requieren header `Idempotency-Key: uuid-v4`.

- Si el pedido ya existe con esa key → 200 OK (mismo response)
- Si es nuevo → 201 Created
- La base de datos tiene unique constraint en `orders.idempotency_key`

## Tests

```bash
# Unit tests
npm test

# Con cobertura
npm run test:coverage

# Smoke test e2e (requiere API deployada)
# Editar test/e2e/smoke-test.ps1 con la URL y ejecutar
pwsh test/e2e/smoke-test.ps1
```

## CI/CD

Los workflows de GitHub Actions están en `.github/workflows/`:

- `ci.yml`: Se ejecuta en cada PR — lint, typecheck, tests, coverage
- `deploy.yml`: Se ejecuta en push a main — `cdk deploy` vía OIDC

## Decisiones de Arquitectura

Ver [ADR.md](./ADR.md) para el detalle completo de decisiones técnicas, alternativas descartadas y trade-offs asumidos.
