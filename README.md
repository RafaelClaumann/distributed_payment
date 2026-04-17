# Sistemas Distribuídos — Aplicação de Pagamento

## Contexto

O comércio eletrônico movimenta grandes volumes de transações, mas manter infraestrutura computacional sempre disponível — independentemente dos picos de demanda — representa um custo operacional elevado.

A solução proposta passa pela separação de responsabilidades em serviços independentes, cada um escalável conforme a sua própria demanda. Dessa forma, os recursos computacionais deixam de ficar ociosos e seus custos passam a ser proporcionais ao uso.

A empresa **CompreFácil**, que concentra grande parte das suas vendas no e-commerce, decidiu reestruturar sua plataforma com base nessa abordagem, adotando a **arquitetura de microsserviços** para reduzir custos operacionais e garantir alta disponibilidade.

---

## Objetivo

Implementar dois serviços distribuídos e independentes que se comunicam de forma assíncrona:

- **Serviço de Pagamento** — processa solicitações de transação
- **Serviço de Notificação** — notifica o usuário sobre o andamento da transação

---

## Requisitos

1. Criar um projeto **Node.js** para o serviço de pagamento, expondo interfaces REST e AMQP
2. Criar um projeto **Node.js** para o serviço de notificação, expondo interfaces REST e AMQP
3. Usar **Docker Compose** para provisionar:
   - Banco de dados **PostgreSQL**
   - Sistema de mensageria **RabbitMQ**
4. Implementar o fluxo de comunicação assíncrono entre os serviços

---

## Fluxo de Processamento

O fluxo abaixo é **totalmente assíncrono** e inicia quando o serviço de pagamento recebe uma solicitação de transação:

```
1. Pagamento armazena a transação com status "pendente"
2. Pagamento publica mensagem na fila → Notificação informa o usuário sobre o recebimento da solicitação
3. Pagamento confirma a transação e atualiza o status para "sucesso"
4. Pagamento publica mensagem na fila → Notificação informa o usuário sobre a confirmação da transação
```

---

## Resultado Esperado

- Serviço de pagamento executando de forma independente do serviço de notificação
- Serviço de notificação executando de forma independente do serviço de pagamento
- Comunicação assíncrona entre os serviços via mensageria (RabbitMQ)
- Fluxo de processamento completo funcionando de ponta a ponta

---

## Critérios de Avaliação

| Critério | Descrição |
|---|---|
| Serviços independentes | Cada serviço deve funcionar sem depender diretamente do outro |
| Comunicação assíncrona | Troca de mensagens via RabbitMQ, sem chamadas síncronas entre serviços |
| Fluxo de processamento | O fluxo completo descrito acima deve ser executado corretamente |

---

## Prazo de Entrega

| Data | Condição |
|---|---|
| até **28/04/2026** às 23h59 (Brasília) | 100% da nota |
| até **30/04/2026** às 23h59 (Brasília) | 60% da nota |
