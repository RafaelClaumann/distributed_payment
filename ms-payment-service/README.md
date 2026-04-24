# ms-payment-service

Microsserviço responsável por processar transações de pagamento.

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18+
- npm

---

## Instalação

```bash
cd ms-payment-service
npm install
```

---

## Como rodar

### Desenvolvimento (com hot-reload via nodemon)

```bash
npm run dev
```

### Produção

```bash
npm start
```

O servidor sobe na porta **3000**.

---

## Endpoints

| Método | Rota            | Descrição                        |
|--------|-----------------|----------------------------------|
| GET    | `/`             | Redireciona para `/make-payment` |
| POST   | `/make-payment` | Cria uma transação de pagamento  |

### POST `/make-payment`

**Body (JSON):**

```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "amount": 299.90,
  "currency": "BRL",
  "description": "Compra na CompreFácil"
}
```

**Resposta (201):**

```json
{
  "transactionId": "uuid-gerado",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "amount": 299.90,
  "currency": "BRL",
  "description": "Compra na CompreFácil",
  "status": "pending",
  "createdAt": 1713400000000
}
```

---

## Estrutura do projeto

```
ms-payment-service/
└── src/
    ├── index.js                  # Entry point — Express + middlewares
    ├── controllers/
    │   └── payment_controller.js # Recebe a requisição e delega ao service
    ├── routes/
    │   └── routes.js             # Definição das rotas
    └── services/
        └── payment_service.js    # Lógica de negócio (armazenamento em memória)
```
