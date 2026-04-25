# ms-payment-service

Microsserviço responsável por processar transações de pagamento em um sistema distribuído. Expõe uma API HTTP para receber pedidos de pagamento, persiste os dados no PostgreSQL e publica eventos no RabbitMQ para integração com outros serviços (ex: `ms-notification-service`).

---

## Sumário

- [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Infraestrutura (Docker)](#infraestrutura-docker)
- [Configuração](#configuração)
- [Como Rodar](#como-rodar)
- [API HTTP](#api-http)
- [Fluxo de Processamento](#fluxo-de-processamento)
- [Jobs em Background](#jobs-em-background)
- [RabbitMQ](#rabbitmq)
- [Banco de Dados](#banco-de-dados)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        ms-payment-service                       │
│                                                                 │
│  POST /make-payment                                             │
│       │                                                         │
│       ▼                                                         │
│  [Valida os dados com AJV]                                      │
│       │                                                         │
│       ▼                                                         │
│  [Salva no PostgreSQL]  ── status: "pending"                    │
│       │                                                         │
│       ▼                                                         │
│  [Publica: PAYMENT_RECEIVED] ──────────────► payment.request   │
│       │                                                         │
│       ▼                                                         │
│  [Retorna HTTP 201]                                             │
│       │                                                         │
│       ▼ (approval_job — delay aleatório entre 1s e 10s)        │
│  [Processa o pagamento]                                         │
│       │                                                         │
│       ├── Sucesso (80%) ──► [Atualiza: "success"]              │
│       │                      [Publica: PAYMENT_APPROVED] ─────► payment.result
│       │                                                         │
│       └── Falha (20%) ───► [Incrementa attempts]               │
│                             [Publica: PAYMENT_FAILED] ────────► payment.dlq
│                                                                 │
│  [dlq_job — roda a cada 10s]                                    │
│       │                                                         │
│       ├── attempts < MAX ──► Reagenda com backoff exponencial  │
│       └── attempts >= MAX ──► status: "error" + log dlq_events │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18+
- npm
- [Docker](https://www.docker.com/) e Docker Compose

---

## Infraestrutura (Docker)

### Subindo com o script `start.sh`

Na raiz do projeto existe o script `start.sh`, que verifica se o Docker está rodando e sobe os containers automaticamente:

```bash
# Na raiz do projeto distributed_payment
chmod +x start.sh
./start.sh
```

O script:
1. Verifica se o Docker está rodando (sai com erro se não estiver)
2. Entra na pasta `infra/`
3. Executa `docker compose up -d`
4. Exibe as URLs de acesso

### Subindo manualmente

```bash
docker compose -f infra/compose.yaml up -d
```

### Derrubando a infraestrutura

```bash
# Para os containers (mantém os volumes — dados persistem)
docker compose -f infra/compose.yaml down

# Para os containers e remove os volumes (apaga todos os dados)
docker compose -f infra/compose.yaml down -v
```

> Use `down -v` quando quiser começar do zero (banco limpo, filas recriadas).

### O que sobe

| Serviço            | Imagem                 | Porta(s)              | Credenciais             | Interface Web          |
|--------------------|------------------------|-----------------------|-------------------------|------------------------|
| **RabbitMQ**       | `rabbitmq:3-management`| `5672` / `15672` (UI) | admin / admin           | http://localhost:15672 |
| **rabbitmq-setup** | `rabbitmq:3-management`| —                     | —                       | —                      |
| **PostgreSQL**     | `postgres:15`          | `5432`                | admin / admin           | —                      |
| **pgAdmin**        | `dpage/pgadmin4`       | `5050`                | admin@admin.com / admin | http://localhost:5050  |

#### `rabbitmq-setup`

Container auxiliar que roda uma vez após o RabbitMQ ficar saudável. Executa o script `infra/rabbitmq/setup.sh`, que cria via `rabbitmqadmin`:

- Exchange `payment.exchange` (tipo `direct`, durável)
- Fila `payment.dlq` (durável)
- Fila `payment.request` (durável)
- Fila `payment.result` (durável, com Dead Letter Queue apontando para `payment.dlq`)
- Bindings entre o exchange e as filas `payment.request` e `payment.result`

> Isso significa que mensagens não processadas na fila `payment.result` são automaticamente redirecionadas para `payment.dlq` pelo broker.

#### PostgreSQL

O banco é inicializado automaticamente com o script `infra/postgres/init.sql`, que:

- Cria as tabelas `transactions` e `dlq_events`
- Cria a função `set_updated_at()` e o trigger `trg_transactions_updated_at`, que atualiza automaticamente o campo `updated_at` a cada `UPDATE` na tabela `transactions`
- Insere uma transação de exemplo com status `"pending"` para facilitar testes iniciais

---

## Configuração

### 1. Instalar dependências

```bash
cd ms-payment-service
npm install
```

### 2. Criar o arquivo `.env`

```bash
cp .env_example .env
```

### 3. Variáveis de ambiente

| Variável                               | Padrão                              | Descrição                                            |
|----------------------------------------|-------------------------------------|------------------------------------------------------|
| `SERVER_PORT`                          | `3000`                              | Porta da API HTTP                                    |
| `DB_HOST`                              | `localhost`                         | Host do PostgreSQL                                   |
| `DB_PORT`                              | `5432`                              | Porta do PostgreSQL                                  |
| `DB_USER`                              | `admin`                             | Usuário do banco                                     |
| `DB_PASSWORD`                          | `admin`                             | Senha do banco                                       |
| `DB_NAME`                              | `app_db`                            | Nome do banco de dados                               |
| `RABBITMQ_URL`                         | `amqp://admin:admin@localhost:5672` | URL de conexão com o RabbitMQ                        |
| `PAYMENT_REQUEST_QUEUE_NAME`           | `payment.request`                   | Fila de pedidos recebidos                            |
| `PAYMENT_RESULT_QUEUE_NAME`            | `payment.result`                    | Fila de pagamentos aprovados                         |
| `PAYMENT_DLQ_QUEUE_NAME`              | `payment.dlq`                       | Dead Letter Queue (falhas)                           |
| `PAYMENT_JOB_REPROCESSING_INTERVAL_MS` | `10000`                             | Intervalo do `dlq_job` em milissegundos              |
| `TRANSACTION_PROCESSING_FAILURE_RATE`  | `0.2`                               | Taxa de falha simulada no processamento (0.2 = 20%)  |
| `MAX_TRANSACTION_ATTEMPS`              | `3`                                 | Máximo de tentativas antes de recusar o pagamento    |

---

## Como Rodar

### Desenvolvimento (hot-reload via nodemon)

```bash
npm run dev
```

O nodemon observa mudanças em `src/` e no arquivo `.env` (extensões: `.js`, `.json`, `.env`).

### Produção

```bash
npm start
```

O servidor sobe na porta definida em `SERVER_PORT` (padrão: **3000**).

**O que acontece na startup:**
1. Conecta ao PostgreSQL — encerra o processo com `exit(-1)` se falhar
2. Inicia o `dlq_job` em background
3. A conexão com o RabbitMQ é lazy — ocorre na primeira publicação

---

## API HTTP

### `POST /make-payment`

Cria uma nova transação de pagamento.

**URL:** `http://localhost:3000/make-payment`

#### Request

**Headers:**
```
Content-Type: application/json
```

**Body:**

```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "amount": 299.90,
  "currency": "BRL",
  "description": "Compra na CompreFácil"
}
```

| Campo         | Tipo   | Obrigatório | Descrição                                |
|---------------|--------|-------------|------------------------------------------|
| `user_id`     | string | sim         | ID do usuário (qualquer string; UUID recomendado) |
| `amount`      | number | sim         | Valor do pagamento (ex: `299.90`)        |
| `currency`    | string | sim         | Código da moeda (ex: `"BRL"`, `"USD"`)  |
| `description` | string | sim         | Descrição livre do pagamento             |

> Campos extras no body são rejeitados (`additionalProperties: false` no schema AJV).

#### Respostas

**Sucesso — HTTP 201**

```json
{
  "transaction_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "amount": "299.90",
  "currency": "BRL",
  "description": "Compra na CompreFácil",
  "status": "pending",
  "attempts": 0,
  "created_at": "2026-04-25T14:00:00.000Z",
  "updated_at": "2026-04-25T14:00:00.000Z"
}
```

> O status retornado é sempre `"pending"`. O resultado real (aprovado ou recusado) chega de forma assíncrona via RabbitMQ.

**Erro de validação — HTTP 400**

```json
{
  "error": "Invalid payload"
}
```

Ocorre quando algum campo obrigatório está ausente, tem tipo incorreto ou há campos não permitidos no body.

---

## Fluxo de Processamento

### 1. Recebimento (síncrono)

Ao receber um `POST /make-payment` válido, o serviço:

1. Gera um `transaction_id` com `crypto.randomUUID()`
2. Persiste a transação no PostgreSQL com `status = "pending"` e `attempts = 0`
3. Publica `PAYMENT_RECEIVED` na fila `payment.request`
4. Agenda o processamento assíncrono (`approval_job`)
5. Retorna HTTP 201 com a transação criada

### 2. Processamento assíncrono (`approval_job`)

Após um delay **aleatório entre 1s e 10s**, tenta processar o pagamento:

**Sucesso (80% dos casos):**
- Atualiza `status` para `"success"` no banco
- Publica `PAYMENT_APPROVED` na fila `payment.result`

**Falha (20% dos casos, controlado por `TRANSACTION_PROCESSING_FAILURE_RATE`):**
- Incrementa `attempts` no banco
- Se `attempts <= MAX_TRANSACTION_ATTEMPS`: publica `PAYMENT_FAILED` na fila `payment.dlq`
- Se `attempts > MAX_TRANSACTION_ATTEMPS`: descarta (o `dlq_job` já terá tratado os limites)

### 3. Reprocessamento (`dlq_job`)

Roda a cada `PAYMENT_JOB_REPROCESSING_INTERVAL_MS` ms (padrão: 10s). Drena a fila `payment.dlq` mensagem por mensagem usando `channel.get()` (pull):

| Condição                                 | Ação                                                                   |
|------------------------------------------|------------------------------------------------------------------------|
| Transação já com `status = "success"`    | Ignora e para                                                          |
| `attempts < MAX_TRANSACTION_ATTEMPS`     | Reagenda `approval_job` com backoff exponencial: `2^attempts` segundos |
| `attempts >= MAX_TRANSACTION_ATTEMPS`    | Atualiza `status` para `"error"`, registra em `dlq_events`, faz `ack` |

**Backoff exponencial por tentativa:**

| Tentativa | Delay antes do reprocessamento |
|-----------|-------------------------------|
| 1         | 2s (`2^1`)                    |
| 2         | 4s (`2^2`)                    |
| 3         | 8s (`2^3`) — última, depois vira `"error"` |

---

## Jobs em Background

### `approval_job`

Simula o processamento assíncrono de um pagamento.

- Disparado por `scheduleApproval(transaction)` logo após salvar no banco
- Usa `setTimeout` com delay aleatório entre 1.000ms e 10.000ms
- Não é bloqueante — o HTTP 201 é retornado imediatamente
- A taxa de falha é configurável via `TRANSACTION_PROCESSING_FAILURE_RATE`

### `dlq_job`

Consome a fila `payment.dlq` e decide o destino de cada mensagem falha.

- Iniciado na startup via `startDlqJob()`
- Usa `setInterval` com o intervalo em `PAYMENT_JOB_REPROCESSING_INTERVAL_MS`
- Usa `channel.get()` (pull — não cria um consumer permanente)
- Faz `ack` explícito após processar cada mensagem

---

## RabbitMQ

### Exchange e Bindings

| Propriedade | Valor              |
|-------------|--------------------|
| Nome        | `payment.exchange` |
| Tipo        | `direct`           |
| Durável     | `true`             |

| Fila              | Routing key       | Dead Letter Queue |
|-------------------|-------------------|-------------------|
| `payment.request` | `payment.request` | —                 |
| `payment.result`  | `payment.result`  | `payment.dlq`     |
| `payment.dlq`     | —                 | —                 |

> A fila `payment.result` tem DLQ configurada no broker (`x-dead-letter-routing-key: payment.dlq`). Se uma mensagem nessa fila não for processada corretamente pelo consumidor, o RabbitMQ a redireciona automaticamente para `payment.dlq`.

### Publicação

As mensagens são enviadas diretamente para as filas via `sendToQueue` (sem roteamento pelo exchange). Todas as mensagens são persistentes (`persistent: true`).

### Filas e Mensagens

#### `payment.request` — Pagamento recebido

Publicada imediatamente após salvar no banco.

```json
{
  "transaction_id": "a1b2c3d4-...",
  "user_id": "123e4567-...",
  "amount": "299.90",
  "currency": "BRL",
  "description": "Compra na CompreFácil",
  "status": "pending",
  "attempts": 0,
  "created_at": "2026-04-25T14:00:00.000Z",
  "updated_at": "2026-04-25T14:00:00.000Z",
  "event": "PAYMENT_RECEIVED"
}
```

---

#### `payment.result` — Pagamento aprovado

Publicada quando o processamento assíncrono tem sucesso.

```json
{
  "transaction_id": "a1b2c3d4-...",
  "user_id": "123e4567-...",
  "amount": "299.90",
  "currency": "BRL",
  "description": "Compra na CompreFácil",
  "status": "success",
  "attempts": 1,
  "created_at": "2026-04-25T14:00:00.000Z",
  "updated_at": "2026-04-25T14:00:00.000Z",
  "event": "PAYMENT_APPROVED",
  "processed_at": "2026-04-25T14:00:05.000Z"
}
```

---

#### `payment.dlq` — Pagamento falhou

Publicada quando o processamento falha. Consumida internamente pelo `dlq_job`. Serviços externos podem consumir para notificação — **não reprocessar**, pois o `ms-payment-service` já faz isso.

```json
{
  "transaction_id": "a1b2c3d4-...",
  "user_id": "123e4567-...",
  "amount": "299.90",
  "currency": "BRL",
  "description": "Compra na CompreFácil",
  "status": "pending",
  "attempts": 1,
  "created_at": "2026-04-25T14:00:00.000Z",
  "updated_at": "2026-04-25T14:00:00.000Z",
  "event": "PAYMENT_FAILED",
  "processed_at": "2026-04-25T14:00:03.000Z",
  "error": "Falha simulada no processamento externo",
  "failed_at": "2026-04-25T14:00:03.100Z"
}
```

---

### Resumo das Filas

| Fila              | Evento             | Quando ocorre                         | `status` na mensagem                     |
|-------------------|--------------------|---------------------------------------|------------------------------------------|
| `payment.request` | `PAYMENT_RECEIVED` | Pagamento criado, aguardando processo | `"pending"`                              |
| `payment.result`  | `PAYMENT_APPROVED` | Pagamento aprovado com sucesso        | `"success"`                              |
| `payment.dlq`     | `PAYMENT_FAILED`   | Falha no processamento                | `"pending"` (ainda em retry) ou `"error"` (esgotado) |

---

## Banco de Dados

O serviço usa **PostgreSQL 15**. Pool de conexões configurado em `src/lib/db.js`:

| Parâmetro                  | Valor    | Descrição                               |
|----------------------------|----------|-----------------------------------------|
| `min`                      | 2        | Conexões mínimas mantidas abertas       |
| `max`                      | 10       | Conexões máximas simultâneas            |
| `connectionTimeoutMillis`  | 3.000ms  | Tempo máximo para obter conexão do pool |
| `idleTimeoutMillis`        | 30.000ms | Tempo até fechar conexão ociosa         |
| `statement_timeout`        | 10.000ms | Tempo máximo de execução de uma query   |

### Tabela `transactions`

| Coluna           | Tipo          | Constraints          | Descrição                              |
|------------------|---------------|----------------------|----------------------------------------|
| `transaction_id` | UUID          | PK                   | Identificador único do pagamento       |
| `user_id`        | UUID          | NOT NULL             | ID do usuário                          |
| `amount`         | NUMERIC(10,2) | NOT NULL             | Valor do pagamento                     |
| `currency`       | VARCHAR(10)   | NOT NULL             | Código da moeda (ex: `BRL`)            |
| `description`    | TEXT          |                      | Descrição do pagamento                 |
| `status`         | VARCHAR(20)   | NOT NULL             | `"pending"`, `"success"` ou `"error"` |
| `attempts`       | INT           | NOT NULL, DEFAULT 0  | Número de tentativas de processamento  |
| `created_at`     | TIMESTAMP     | NOT NULL, DEFAULT NOW() | Data de criação                     |
| `updated_at`     | TIMESTAMP     | NOT NULL, DEFAULT NOW() | Última atualização (via trigger)    |

> O campo `updated_at` é atualizado automaticamente pelo trigger `trg_transactions_updated_at` a cada `UPDATE` na tabela.

### Tabela `dlq_events`

Registra um evento a cada vez que uma transação esgota as tentativas e é recusada definitivamente.

| Coluna           | Tipo      | Constraints          | Descrição                                |
|------------------|-----------|----------------------|------------------------------------------|
| `id`             | SERIAL    | PK                   | ID auto-incrementado                     |
| `transaction_id` | UUID      | NOT NULL, FK         | Referência à transação em `transactions` |
| `attempts`       | INT       | NOT NULL             | Total de tentativas feitas               |
| `error`          | TEXT      |                      | Mensagem de erro do último processamento |
| `created_at`     | TIMESTAMP | NOT NULL, DEFAULT NOW() | Quando o evento foi registrado        |

### Status possíveis de uma transação

| Status      | Descrição                                                          |
|-------------|--------------------------------------------------------------------|
| `"pending"` | Criada, aguardando processamento                                   |
| `"success"` | Processada com sucesso                                             |
| `"error"`   | Recusada — esgotou o máximo de tentativas (`MAX_TRANSACTION_ATTEMPS`) |

### Dados de seed

O `init.sql` insere uma transação de exemplo no banco ao subir pela primeira vez:

| Campo            | Valor                                  |
|------------------|----------------------------------------|
| `transaction_id` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `user_id`        | `123e4567-e89b-12d3-a456-426614174000` |
| `amount`         | `299.90`                               |
| `currency`       | `BRL`                                  |
| `description`    | `Compra na CompreFácil`                |
| `status`         | `pending`                              |

---

## Estrutura do Projeto

```
ms-payment-service/
├── .env                    # Variáveis de ambiente (não versionar)
├── .env_example            # Modelo das variáveis de ambiente
├── nodemon.json            # Configuração do nodemon (observa src/ e .env)
├── package.json            # Dependências e scripts npm
└── src/
    ├── index.js                        # Entry point — Express + inicia dlq_job
    ├── controllers/
    │   └── payment_controller.js       # Recebe HTTP, chama service, responde
    ├── routes/
    │   └── routes.js                   # Definição das rotas Express
    ├── services/
    │   ├── payment_service.js          # Orquestra: valida → salva → publica → agenda
    │   └── validation_service.js       # Schema AJV para validar o body da requisição
    ├── jobs/
    │   ├── approval_job.js             # Processa pagamento com delay + taxa de falha simulada
    │   └── dlq_job.js                  # Consome payment.dlq e aplica retry com backoff
    ├── lib/
    │   ├── db.js                       # Pool de conexões PostgreSQL
    │   ├── rabbit.js                   # Conexão e funções publish/publishToPaymentDlq
    │   ├── transaction.js              # Queries: create, get, updateStatus, incrementAttempts
    │   └── dlq_events.js              # Queries: logDlqEvent, getDlqEventsByTransaction
    └── enums/
        └── transaction_status.js       # Constantes: PENDING, SUCCESS, ERROR
```

### Dependências

| Pacote     | Uso                                                      |
|------------|----------------------------------------------------------|
| `express`  | Framework HTTP                                           |
| `pg`       | Driver PostgreSQL (pool de conexões via `pg.Pool`)       |
| `amqplib`  | Cliente RabbitMQ (AMQP 0-9-1)                            |
| `ajv`      | Validação de schema JSON (payload do endpoint)           |
| `dotenv`   | Carrega variáveis do arquivo `.env`                      |
| `nodemon`  | Hot-reload em desenvolvimento (devDependency)            |
