// Simula o processamento assíncrono de aprovação de uma transação.
// Após um delay aleatório entre 1s e 10s, tenta atualizar o status para SUCCESS no banco.
// Com 20% de chance (FAILURE_RATE) lança um erro simulando falha de processador externo —
// o erro é capturado e logado, sem derrubar o processo. Futuramente o caso de falha deve
// publicar na DLQ para reprocessamento.
// Chamado de forma não bloqueante logo após persistir a transação em PaymentService.

const { updateTransactionStatus } = require("../lib/transaction.js");
const transactionStatus = require("../enums/transaction_status.js");

const FAILURE_RATE = 0.2 // 20% de chance de falhar

function simulateError() {
  if (Math.random() < FAILURE_RATE) {
    throw new Error('Falha simulada no processamento externo')
  }
}

function scheduleApproval(transaction) {
  const delay = Math.random() * 9000 + 1000

  setTimeout(async () => {
    try {
      simulateError()

      await updateTransactionStatus(transaction.transaction_id, transactionStatus.SUCCESS)

      console.log(`[Approved] ${transaction.transaction_id} após ${(delay / 1000).toFixed(1)}s`)

    } catch (err) {
      console.error(`[Error] falha ao aprovar ${transaction.transaction_id}:`, err.message)
      // futuramente: publicar na DLQ
    }
  }, delay)
}

module.exports = { scheduleApproval }