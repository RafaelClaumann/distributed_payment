const { updateTransactionStatus } = require("../lib/transaction.js");
const transactionStatus = require("../enums/transaction_status.js");

function scheduleApproval(transaction) {
  const delay = Math.random() * 9000 + 1000; // 1s ~ 10s

  setTimeout(async () => {
    await updateTransactionStatus(transaction.transaction_id, transactionStatus.SUCCESS);

    console.log(`[Approved] ${transaction.transaction_id} após ${(delay / 1000).toFixed(1)}s`,);
  }, delay);
}

module.exports = { scheduleApproval };
