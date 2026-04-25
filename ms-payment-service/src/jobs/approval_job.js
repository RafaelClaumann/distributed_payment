// Simula o processamento assíncrono de aprovação de uma transação.
// Após um delay aleatório entre 1s e 10s, tenta atualizar o status para SUCCESS no banco.
// Com 20% de chance (FAILURE_RATE) lança um erro simulando falha de processador externo —
// o erro é capturado e logado, sem derrubar o processo. Futuramente o caso de falha deve
// publicar na DLQ para reprocessamento.
// Chamado de forma não bloqueante logo após persistir a transação em PaymentService.

require("dotenv").config();

const {
  updateTransactionStatus,
  incrementAttempts,
} = require("../lib/transaction.js");
const transactionStatus = require("../enums/transaction_status.js");
const { publish, publishToPaymentDlq } = require("../lib/rabbit.js");

function simulateError() {
  if (Math.random() < process.env.TRANSACTION_PROCESSING_FAILURE_RATE) {
    throw new Error("Falha simulada no processamento externo");
  }
}

function buildPayload(transaction, event, message, extraFields = {}) {
  return {
    ...transaction,
    event,
    message,
    processed_at: new Date().toISOString(),
    ...extraFields,
  };
}

function scheduleApproval(transaction) {
  const delay = Math.random() * 9000 + 1000;

  setTimeout(async () => {
    try {
      simulateError();

      await updateTransactionStatus(
        transaction.transaction_id,
        transactionStatus.SUCCESS,
      );

      console.log(
        `[Approved] ${transaction.transaction_id} após ${(delay / 1000).toFixed(1)}s`,
      );

      await publish(
        process.env.PAYMENT_RESULT_QUEUE_NAME,
        buildPayload(
          transaction,
          "PAYMENT_APPROVED",
          "Seu pagamento foi confirmado!",
          { status: transactionStatus.SUCCESS },
        ),
      );
    } catch (err) {
      const updated = await incrementAttempts(transaction.transaction_id);
      console.error(
        `[Error] falha ao aprovar ${transaction.transaction_id}:`,
        err.message,
      );

      await publishToPaymentDlq(
        buildPayload(
          transaction,
          "PAYMENT_FAILED",
          "Falha no processamento do pagamento.",
          { error: err.message, attempts: updated.attempts },
        ),
      );
    }
  }, delay);
}

module.exports = { scheduleApproval };
