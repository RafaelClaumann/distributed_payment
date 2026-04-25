# ms-notification-service — Guia de Implementação

> Para quem vai criar esse serviço do zero. Não é necessário conhecer o projeto antes.

---

## Antes de começar: entendendo o papel desse serviço

Imagine que você acabou de fazer uma compra online. Segundos depois chega uma mensagem no celular: _"Seu pagamento está sendo processado."_ Mais tarde: _"Pagamento aprovado!"_

É exatamente isso que o `ms-notification-service` faz. Ele não processa pagamentos — ele **escuta** o que está acontecendo no sistema e avisa o usuário.

Quem produz os eventos é o `ms-payment-service`. Toda vez que um pagamento é criado ou aprovado, ele publica uma mensagem numa fila do RabbitMQ. O `ms-notification-service` fica conectado nessa fila e reage quando uma mensagem chega.

Os dois serviços **não se falam diretamente**. Não existe uma chamada HTTP entre eles. A comunicação é toda via fila:

```
ms-payment-service  ──publica mensagem──►  fila RabbitMQ  ──entrega──►  ms-notification-service
```

Isso se chama comunicação assíncrona. Se o notification-service cair por alguns minutos, as mensagens ficam guardadas na fila e serão processadas quando ele voltar.

---

## Pré-requisitos

- Node.js v18+ instalado
- Docker rodando (para subir o RabbitMQ e o PostgreSQL)
- O `ms-payment-service` rodando para gerar mensagens nas filas

---

## Passo 1 — Criar a branch

Todo desenvolvimento novo começa criando uma branch a partir da `main`. A `main` representa o código estável — você nunca deve desenvolver diretamente nela.

Abra o terminal na raiz do projeto `distributed_payment` e execute:

```bash
git checkout main
git pull origin main
git checkout -b feat/notification_service
```

Para confirmar que está na branch certa:

```bash
git branch
# deve aparecer: * feat/notification_service
```

---

## Passo 2 — Iniciar o projeto

Entre na pasta `ms-notification-service` e inicialize o projeto Node.js:

```bash
cd ms-notification-service
npm init -y
```

O `npm init -y` cria o arquivo `package.json` automaticamente com valores padrão. É nesse arquivo que o npm registra as dependências do projeto.

Agora instale as dependências:

```bash
npm install amqplib dotenv
npm install --save-dev nodemon
```

- `amqplib` é a biblioteca que permite falar com o RabbitMQ
- `dotenv` carrega as variáveis de ambiente do arquivo `.env`
- `nodemon` reinicia o serviço automaticamente quando você salva um arquivo (só em desenvolvimento, por isso `--save-dev`)

Abra o `package.json` que foi gerado e adicione o campo `"type"` e o campo `"scripts"`:

```json
{
  "name": "ms-notification-service",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  ...
}
```

---

## Passo 3 — Criar os arquivos de configuração

Crie um arquivo `.gitignore` na raiz de `ms-notification-service`. Esse arquivo diz ao git o que não deve ser versionado:

```
node_modules/
.env
```

Crie um arquivo `nodemon.json` para configurar o hot-reload:

```json
{
  "watch": ["src", ".env"],
  "ext": "js,json,env"
}
```

Crie um arquivo `.env_example`. Esse arquivo vai para o git e serve de modelo para quem clonar o projeto:

```
RABBITMQ_URL=amqp://admin:admin@localhost:5672
PAYMENT_REQUEST_QUEUE_NAME=payment.request
PAYMENT_RESULT_QUEUE_NAME=payment.result
```

Agora crie o `.env` a partir desse modelo (esse **não** vai para o git):

```bash
cp .env_example .env
```

---

## Passo 4 — Criar a estrutura de pastas e arquivos

Abra a pasta `ms-notification-service` no seu editor (VS Code, por exemplo) e crie a seguinte estrutura de pastas e arquivos:

```
ms-notification-service/
└── src/
    ├── index.js
    ├── lib/
    │   └── rabbit.js
    ├── services/
    │   └── notification_service.js
    └── consumers/
        ├── payment_received_consumer.js
        └── payment_approved_consumer.js
```

**Por que essa separação?**

- `lib/` guarda o código que fala com serviços externos — no caso, a conexão com o RabbitMQ
- `services/` guarda a lógica de negócio — aqui fica o código que "envia" a notificação
- `consumers/` orquestra: pega a mensagem da fila, extrai o que precisa e chama o service

Essa divisão faz com que cada parte do código tenha uma responsabilidade clara. Se amanhã você quiser trocar o `console.log` por um envio de e-mail real, só mexe em `notification_service.js` — o resto não muda.

---

## Passo 5 — Implementar os arquivos

### `src/lib/rabbit.js`

Esse arquivo tem uma responsabilidade só: criar e manter a conexão com o RabbitMQ. Para não abrir uma conexão nova toda vez, verificamos se já existe uma — se sim, reutilizamos.

```js
const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://admin:admin@localhost:5672";

let channel;

async function getChannel() {
  if (channel) return channel;

  const conn = await amqp.connect(RABBITMQ_URL);
  channel = await conn.createChannel();

  conn.on("error", (err) => {
    console.error("[RabbitMQ] Conexão perdida:", err.message);
    channel = null;
  });

  console.log("[RabbitMQ] Conectado");
  return channel;
}

module.exports = { getChannel };
```

---

### `src/services/notification_service.js`

Aqui mora o código que "envia" a notificação. Por enquanto é um `console.log`, mas é aqui que você colocaria o envio de e-mail ou SMS quando quiser evoluir o serviço.

```js
exports.notify = (userId, eventType, message) => {
  const timestamp = new Date().toISOString();
  console.log(`[Notification] [${timestamp}] user: ${userId} | event: ${eventType} | ${message}`);
};
```

---

### `src/consumers/payment_received_consumer.js`

Esse consumer escuta a fila `payment.request`. Toda vez que o `ms-payment-service` cria um pagamento novo, uma mensagem chega aqui.

```js
const { getChannel } = require("../lib/rabbit.js");
const notificationService = require("../services/notification_service.js");

async function start() {
  const channel = await getChannel();
  const queue = process.env.PAYMENT_REQUEST_QUEUE_NAME;

  await channel.assertQueue(queue, { durable: true });
  channel.prefetch(1);

  channel.consume(queue, (message) => {
    if (!message) return;

    try {
      const content = JSON.parse(message.content.toString());

      notificationService.notify(
        content.user_id,
        content.event,
        `Seu pagamento de ${content.currency} ${content.amount} está em análise. (ID: ${content.transaction_id})`
      );

      channel.ack(message);
    } catch (err) {
      console.error("[PaymentReceived] Erro ao processar mensagem:", err.message);
      channel.nack(message, false, false);
    }
  });

  console.log(`[PaymentReceived] Consumindo fila "${queue}"`);
}

module.exports = { start };
```

Três conceitos que aparecem aqui pela primeira vez:

- **`prefetch(1)`** — processa uma mensagem de cada vez. Só busca a próxima depois de terminar a atual.
- **`ack`** — depois de processar com sucesso, avisamos ao RabbitMQ que pode remover a mensagem da fila. Sem o `ack`, a mensagem fica presa e será reentregue.
- **`nack`** — se der erro, avisamos que não conseguimos processar. O `false` no final diz para não recolocar a mensagem na fila — se recolocasse, entraria em loop infinito de erro.

---

### `src/consumers/payment_approved_consumer.js`

Muito parecido com o anterior, mas escuta a fila `payment.result` e notifica que o pagamento foi confirmado.

```js
const { getChannel } = require("../lib/rabbit.js");
const notificationService = require("../services/notification_service.js");

async function start() {
  const channel = await getChannel();
  const queue = process.env.PAYMENT_RESULT_QUEUE_NAME;

  await channel.assertQueue(queue, { durable: true, arguments: {
    "x-dead-letter-exchange": "",
    "x-dead-letter-routing-key": "payment.dlq",
  }});
  channel.prefetch(1);

  channel.consume(queue, (message) => {
    if (!message) return;

    try {
      const content = JSON.parse(message.content.toString());

      notificationService.notify(
        content.user_id,
        content.event,
        `Pagamento aprovado! ${content.currency} ${content.amount} confirmado. (ID: ${content.transaction_id})`
      );

      channel.ack(message);
    } catch (err) {
      console.error("[PaymentApproved] Erro ao processar mensagem:", err.message);
      channel.nack(message, false, false);
    }
  });

  console.log(`[PaymentApproved] Consumindo fila "${queue}"`);
}

module.exports = { start };
```

Uma diferença em relação ao consumer anterior: o `assertQueue` aqui precisa informar os `arguments` de Dead Letter Queue. Isso porque a fila `payment.result` foi criada com essa configuração pelo Docker — se o seu `assertQueue` declarar propriedades diferentes, o RabbitMQ rejeita a conexão.

---

### `src/index.js`

O ponto de entrada do serviço. Inicializa os dois consumers e fica aguardando mensagens.

```js
require("dotenv").config();

const paymentReceivedConsumer = require("./consumers/payment_received_consumer.js");
const paymentApprovedConsumer = require("./consumers/payment_approved_consumer.js");

async function main() {
  console.log("[ms-notification-service] Iniciando...");

  await paymentReceivedConsumer.start();
  await paymentApprovedConsumer.start();

  console.log("[ms-notification-service] Pronto — aguardando mensagens.");
}

main().catch((err) => {
  console.error("[ms-notification-service] Falha ao iniciar:", err.message);
  process.exit(1);
});
```

O processo não precisa de nenhum loop para continuar rodando. O `channel.consume()` mantém a conexão com o RabbitMQ aberta, e enquanto isso o processo fica vivo esperando mensagens chegarem.

---

## Passo 6 — Testar o fluxo completo

### Subir a infraestrutura

Na raiz do projeto `distributed_payment`:

```bash
./start.sh
```

Aguarde os containers subirem. Você pode verificar se as filas foram criadas no painel do RabbitMQ: http://localhost:15672 (usuário `admin`, senha `admin`) → aba **Queues**.

### Subir o ms-payment-service

Em um terminal:

```bash
cd ms-payment-service
npm run dev
```

### Subir o ms-notification-service

Em outro terminal:

```bash
cd ms-notification-service
npm run dev
```

Você deve ver:

```
[RabbitMQ] Conectado
[PaymentReceived] Consumindo fila "payment.request"
[PaymentApproved] Consumindo fila "payment.result"
[ms-notification-service] Pronto — aguardando mensagens.
```

### Disparar um pagamento

Em um terceiro terminal:

```bash
curl -X POST http://localhost:3000/make-payment \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "amount": 299.90,
    "currency": "BRL",
    "description": "Compra de teste"
  }'
```

### O que você deve ver

No terminal do **ms-notification-service**, imediatamente:

```
[Notification] [...] user: 123e4567-... | event: PAYMENT_RECEIVED | Seu pagamento de BRL 299.90 está em análise.
```

Entre 1 e 10 segundos depois:

```
[Notification] [...] user: 123e4567-... | event: PAYMENT_APPROVED | Pagamento aprovado! BRL 299.90 confirmado.
```

> Há 20% de chance do pagamento falhar na primeira tentativa. Se isso acontecer, o `ms-payment-service` tenta novamente automaticamente — a notificação de aprovação pode demorar um pouco mais.

---

## Referência das mensagens

Para ver todos os campos que chegam nas mensagens e entender o comportamento das filas em detalhe, consulte o [OVERVIEW.md](../ms-payment-service/OVERVIEW.md) do `ms-payment-service`.
