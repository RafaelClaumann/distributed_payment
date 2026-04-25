// Simula o processamento assíncrono de aprovação de uma transação.
// Após um delay aleatório entre 1s e 10s, tenta atualizar o status para SUCCESS no banco.
// Com 20% de chance (FAILURE_RATE) lança um erro simulando falha de processador externo —
// o erro é capturado e logado, sem derrubar o processo. Futuramente o caso de falha deve
// publicar na DLQ para reprocessamento.
// Chamado de forma não bloqueante logo após persistir a transação em PaymentService.

require("dotenv").config();

const { updateTransactionStatus, incrementAttempts } = require("../lib/transaction.js");
const transactionStatus = require("../enums/transaction_status.js");
const { publish, publishToPaymentDlq } = require("../lib/rabbit.js");

function simulatePaymentProcessingError() {
  if (Math.random() < process.env.TRANSACTION_PROCESSING_FAILURE_RATE) {
    throw new Error("Falha simulada no processamento externo");
  }
}

function buildMessage(transaction, event, extraFields = {}) {
  return {
    ...transaction,
    event,
    processed_at: new Date().toISOString(),
    ...extraFields,
  };
}

function scheduleApproval(transaction) {
  const delay = Math.random() * 9000 + 1000;

  setTimeout(async () => {
    try {
      simulatePaymentProcessingError();

      await updateTransactionStatus(transaction.transaction_id, transactionStatus.SUCCESS);
      const message = buildMessage(transaction, "PAYMENT_APPROVED", { status: transactionStatus.SUCCESS })
      await publish(process.env.PAYMENT_RESULT_QUEUE_NAME, message);

      console.log(`[Approved] [${transaction.transaction_id}] após ${(delay / 1000).toFixed(1)}s`);
    } catch (err) {

      const updatedTransaction = await incrementAttempts(transaction.transaction_id,);
      if (updatedTransaction.attempts <= process.env.MAX_TRANSACTION_ATTEMPS) {
        const message = buildMessage(transaction, "PAYMENT_FAILED", { error: err.message, });
        await publishToPaymentDlq(message);
      }

      console.error(`[Error] [${transaction.transaction_id}] falha ao aprovar:`, err.message);
    }
  }, delay);
}

module.exports = { scheduleApproval };
