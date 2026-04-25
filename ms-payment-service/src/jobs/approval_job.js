const { updateTransactionStatus } = require("../lib/transaction.js");
const transactionStatus = require("../enums/transaction_status.js");

// Simula o processamento assíncrono de aprovação de uma transação.
// Após um delay aleatório entre 1s e 10s, atualiza o status para SUCCESS no banco.
// Chamado de forma não bloqueante logo após persistir a transação em PaymentService.
function scheduleApproval(transaction) {
  const delay = Math.random() * 9000 + 1000; // 1s ~ 10s

  setTimeout(async () => {
    await updateTransactionStatus(transaction.transaction_id, transactionStatus.SUCCESS);

    console.log(`[Approved] ${transaction.transaction_id} após ${(delay / 1000).toFixed(1)}s`,);
  }, delay);
}

module.exports = { scheduleApproval };
