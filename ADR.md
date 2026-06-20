# Architecture Decision Records — OrderFlow

## ADR-001: AWS CDK como IaC

**Contexto**: Necesitamos infraestructura reproducible, versionable y desplegable sin pasos manuales.

**Decisión**: Usamos AWS CDK (TypeScript) para definir toda la infraestructura como código.

**Alternativas consideradas**:
- **Serverless Framework**: Más rápido de prototipar pero no da control nativo sobre RDS, EC2, VPC, ni Aurora. El PDF del ejercicio exige CDK.
- **Terraform**: Excelente multi-cloud, pero añade complejidad de estado y lenguaje HCL.

**Trade-offs**:
- El CDK requiere más boilerplate inicial que Serverless Framework.
- A cambio, tenemos control total sobre cada recurso, tipado fuerte, y la posibilidad de usar constructos reutilizables.
- La curva de aprendizaje es mayor, pero el resultado es más mantenible.

---

## ADR-002: Stack único vs múltiples stacks

**Contexto**: Separación de responsabilidades y límites de despliegue.

**Decisión**: Stack único (`OrderFlowStack`) con toda la infraestructura.

**Alternativas consideradas**:
- **Stacks separados**: NetworkStack, DatabaseStack, AuthStack, ApiStack, AppStack. Mayor granularidad pero más complejidad operativa.

**Trade-offs**:
- Stack único: despliegues más largos, mayor riesgo de impacto, pero operación simple y sin dependencias circulares entre stacks.
- Para un proyecto de este tamaño, la simplicidad pesa más que la granularidad.
- Si el proyecto creciera, se podría dividir en stacks por dominio (auth, orders, admin) usando `cdk.Stack` separados con `crossRegionReferences`.

---

## ADR-003: Kysely como ORM

**Contexto**: Acceso a base de datos relacional con tipado fuerte.

**Decisión**: Kysely con patrón Singleton de pool de conexiones.

**Alternativas consideradas**:
- **Prisma**: Excelente developer experience, pero añade peso y genera cliente propio. No ideal para Lambda (capa adicional).
- **TypeORM**: Maduro pero con mucho overhead y configuración.
- **Drizzle**: Moderno, pero menos probado en producción que Kysely.

**Trade-offs**:
- Kysely es liviano, tipado manual de esquemas, sin generación automática.
- Control total sobre las queries SQL con inferencia de tipos.
- No tiene migraciones automáticas (usamos SQL plano para schema).

---

## ADR-004: Cognito para autenticación

**Contexto**: Necesitamos login con JWT, registro de usuarios y autorización en API Gateway.

**Decisión**: Amazon Cognito User Pool + JWT Authorizer en API Gateway HTTP.

**Alternativas consideradas**:
- **Auth0**: Excelente pero SaaS externo, costo adicional, y el PDF exige servicios AWS.
- **JWT custom**: Más control pero implementar refresh tokens, forgot password, etc. es complejo y riesgoso.

**Trade-offs**:
- Cognito está integrado nativamente con API Gateway (JWT Authorizer).
- La validación de tokens es automática, sin código Lambda para auth.
- Limitaciones en personalización de la UI de login (no aplica, es backend).
- Costo: Cognito es gratuito hasta 50,000 MAUs.

---

## ADR-005: Secrets Manager

**Contexto**: Gestión de credenciales de base de datos, Cognito y API keys.

**Decisión**: AWS Secrets Manager con rotación automática.

**Alternativas consideradas**:
- **SSM Parameter Store**: Más barato, pero sin rotación automática ni auditoría integrada.
- **.env files**: Inseguro, no versionable, no reproducible.

**Trade-offs**:
- Secrets Manager cuesta ~$0.40/secret/mes.
- Rotación automática, auditoría CloudTrail, integración nativa con RDS/Aurora.
- Las Lambdas lo consultan en cold start (caché en variable de entorno después).

---

## ADR-006: SQS para procesamiento asíncrono

**Contexto**: Los pedidos requieren validación y procesamiento que puede no ser instantáneo.

**Decisión**: SQS estándar con DLQ y maxReceiveCount=3.

**Alternativas consideradas**:
- **Síncrono**: El cliente espera hasta que se procese el pedido. Malo para UX y escalabilidad.
- **Step Functions**: Orquestación visual, pero más caro y complejo para este caso.
- **SQS FIFO**: Garantiza orden pero limita throughput (300 TPS). No necesario aquí.

**Trade-offs**:
- SQS estándar: alta throughput, "at least once delivery" (idempotencia lo resuelve).
- 3 reintentos con backoff automático (VisibilityTimeout progresivo).
- DLQ captura fallos permanentes para análisis.
- El desacople permite que la API responda 201 rápido mientras el pedido se procesa en background.

---

## ADR-007: Aurora Serverless v2

**Contexto**: Base de datos relacional MySQL compatible, con escalado elástico.

**Decisión**: Aurora Serverless v2 (MySQL 8.0 compatible).

**Alternativas consideradas**:
- **RDS MySQL provisioned**: Costo fijo, sin autoescalado.
- **DynamoDB**: No relacional, no soporta joins, queries complejas, ni transacciones ACID.

**Trade-offs**:
- Aurora Serverless v2 escala desde 0.5 ACU hasta 128 ACU bajo demanda.
- Pago por uso, sin capacidad provisionada.
- Latencia de cold start al escalar desde 0 (poco común en producción con uso constante).
- MySQL compatible, migración trivial desde RDS MySQL.

---

## ADR-008: Onion Architecture

**Contexto**: Organización del código en capas con dependencias hacia adentro.

**Decisión**: Domain → Application → Infrastructure → Interfaces.

**Alternativas consideradas**:
- **MVC**: Mezcla lógica de negocio con controladores.
- **Clean Architecture**: Similar pero con más reglas estrictas.
- **Vertical Slices**: Organiza por funcionalidad. Bueno pero menos conocido por el equipo.

**Trade-offs**:
- Onion: Separación clara de responsabilidades, testabilidad, dominio puro sin dependencias externas.
- Más archivos y carpetas, pero cada capa tiene una responsabilidad única.
- Las dependencias apuntan hacia adentro (el dominio no sabe de AWS, DB, etc.).

---

## ADR-009: EC2 Bastion Host

**Contexto**: El PDF exige explícitamente usar Amazon EC2.

**Decisión**: t4g.nano como bastion host en subnet pública para acceso SSH a RDS.

**Alternativas consideradas**:
- **No usar EC2**: No cumple con el requisito del PDF.
- **EC2 para procesamiento**: Worker en EC2 en vez de Lambda. Sobredimensionado para el caso.

**Trade-offs**:
- t4g.nano: ~$4.20/mes, free tier elegible por 12 meses.
- Solo sirve como jump box, no procesa workload.
- Cumple el requisito del PDF sin costo significativo.
- Alternativa futura: AWS Session Manager sin necesidad de bastion.

---

## ADR-010: API Gateway HTTP único

**Contexto**: Todos los módulos (auth, orders, admin, docs) comparten el mismo endpoint.

**Decisión**: Un único API Gateway HTTP API con rutas por módulo.

**Alternativas consideradas**:
- **API Gateway REST**: Más features (WAF, API keys, usage plans) pero más caro.
- **Múltiples API Gateways**: Aislamiento, pero complejidad operativa.
- **ALB + Lambda**: No tiene JWT Authorizer nativo.

**Trade-offs**:
- HTTP API: 70% más barato que REST API, latencia menor.
- JWT Authorizer nativo sin Lambda@Edge.
- Un solo dominio para toda la API, versionado vía paths (/v1/...).
- WAF se puede añadir después si es necesario.

---

## ADR-011: Zod para validación

**Contexto**: Validación de inputs de API (request body, query params).

**Decisión**: Zod schemas + `validateInput()` helper.

**Alternativas consideradas**:
- **Joi**: Popular pero sin inferencia de tipos TypeScript nativa.
- **Yup**: Similar a Joi, menos usado en el ecosistema.
- **class-validator**: Decoradores, requiere clases, más verboso.

**Trade-offs**:
- Zod: Inferencia de tipos automática (`z.infer`), schemas composables, mensajes de error personalizables.
- Se integra fácilmente con los DTOs de aplicación.
- La validación ocurre en la capa de interfaces (handler) antes de llegar al caso de uso.

---

## ADR-012: Tests unitarios con Jest

**Contexto**: Garantizar calidad y evitar regresiones.

**Decisión**: Jest + ts-jest con mocks de interfaces de repositorio.

**Alternativas consideradas**:
- **Vitest**: Más rápido, pero menos integración con el ecosistema AWS.
- **Mocha**: Más flexible, pero requiere más configuración.

**Trade-offs**:
- Jest: Estándar de facto, gran ecosistema, coverage integrado.
- Mockeamos las interfaces (IOmniRepository) no la implementación concreta.
- Los handlers se testean con eventos mock de API Gateway.
- Cobertura target: >95% statements, >91% branches.

---

## ADR-013: Idempotencia en pedidos

**Contexto**: Evitar duplicados por doble clic, reintentos de red o timeouts del cliente.

**Decisión**: Header `Idempotency-Key` (UUID v4) + unique constraint en RDS.

**Alternativas consideradas**:
- **DynamoDB TTL para idempotencia**: Servicio extra, costo adicional.
- **Redis/Memcached**: Cache externo, más latencia de red.
- **Solo lógica de aplicación**: Sin garantía a nivel BD.

**Trade-offs**:
- La unique constraint en `orders.idempotency_key` es garantía absoluta a nivel BD.
- Check `SELECT ... WHERE idempotency_key = ?` antes de insertar optimiza el caso común.
- Si existe → 200 OK con el pedido existente (mismo response). El cliente sabe que ya se creó.
- La key se guarda permanentemente en el registro (no tiene TTL). Es parte del dato, no un cache.
- Sin servicios extra, sin DynamoDB, sin Redis.

---

## ADR-014: Logs estructurados con Pino

**Contexto**: Observabilidad básica para debugging y monitoreo.

**Decisión**: Pino para logs JSON estructurados → CloudWatch Logs + Alarma básica.

**Alternativas consideradas**:
- **Sentry**: Ideal para errores, pero añade dependencia externa y costo. Dejamos preparado pero no integrado.
- **AWS Lambda Advanced Logging**: Control de nivel de log, pero menos flexible que Pino.
- **Console.log simple**: Sin estructura, imposible de consultar con CloudWatch Logs Insights.

**Trade-offs**:
- Pino: ~40% más rápido que Winston/Bunyan, formato JSON nativo.
- En local usa `pino-pretty` para legibilidad humana.
- CloudWatch Logs Insights permite consultas SQL-like sobre los logs JSON.
- Alarma CloudWatch: Lambda errors > 0 en 5 minutos.

---

## ADR-015: CI/CD con GitHub Actions + OIDC

**Contexto**: Automatizar calidad y despliegue.

**Decisión**: GitHub Actions con OIDC para credenciales AWS (sin access keys estáticas).

**Alternativas consideradas**:
- **AWS CodePipeline**: Integración nativa pero límite de 60 builds/mes en free tier.
- **CircleCI/GitLab CI**: Alternativas SaaS, pero GitHub Actions ya está en el ecosistema.

**Trade-offs**:
- OIDC: elimina la necesidad de rotar AWS access keys.
- `ci.yml`: lint + typecheck + test + coverage en cada PR (feedback rápido).
- `deploy.yml`: `cdk deploy` en push a main (despliegue continuo).
- Caché de `node_modules` para acelerar builds (~40s vs ~2min sin caché).

---

## ADR-016: Puertos y Adaptadores entre módulos (Shared Kernel)

**Contexto**: El módulo `admin` necesita consultar y modificar pedidos, que son datos del módulo `orders`. Inicialmente `admin.repository.ts` importaba directamente `OrdersDbRepository` desde `@/modules/orders/infrastructure/db/orders.repository`, violando el principio de que los módulos no deben conocer la infraestructura interna de otros módulos.

**Decisión**: Cada módulo expone sus necesidades a través de **puertos** (interfaces) definidos en `shared/domain/ports/`. Las implementaciones concretas (**adaptadores**) viven en `shared/infrastructure/db/`.

**Arquitectura resultante**:

```
shared/domain/
├── ports/
│   └── order-admin.port.ts      ← Puerto que necesita admin
├── value-objects/
│   └── order-status.ts          ← Value object compartido
└── entities/
    ├── order.entity.ts
    ├── user.entity.ts
    └── product.entity.ts

shared/infrastructure/db/
└── order-admin.adapter.ts       ← Adaptador que implementa OrderAdminPort (usa Kysely directo)

modules/admin/
├── domain/repositories/
│   └── admin.repository.interface.ts  ← Ahora re-exporta OrderAdminPort
├── infrastructure/db/
│   └── admin.repository.ts            ← Delega en OrderAdminAdapter
├── application/uses-cases/
│   └── admin.use-cases.ts             ← Importa OrderStatus de shared/domain
└── interfaces/api/
    └── admin.handlers.ts              ← Importa OrderStatus de shared/domain
```

**Alternativas consideradas**:
- **Módulo admin con su propio repositorio que consulta BD directamente**: Duplica lógica de queries vs orders.repository.ts.
- **Inyección de dependencia cruzada**: El adaptador de admin usa OrdersDbRepository en el composition root. Aunque funcional, sigue habiendo acoplamiento.

**Trade-offs**:
- El puerto compartido (`OrderAdminPort`) define explícitamente qué operaciones necesita el módulo admin sobre orders.
- El adaptador (`OrderAdminAdapter`) usa Kysely directamente, sin depender del módulo orders.
- Los casos de uso de admin dependen únicamente de la interfaz (puerto), no de la implementación.
- Se duplica ligeramente la lógica de queries (vs OrdersDbRepository), pero se gana independencia total entre módulos.
- Los value objects compartidos (`OrderStatus`) también se movieron a `shared/domain/value-objects/` para evitar dependencias entre módulos a nivel de dominio.
