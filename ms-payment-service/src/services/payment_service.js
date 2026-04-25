const valitadeService = require("./validation_service.js");
const transactionStatus = require("../enums/transaction_status.js");
const transactionService = require("../lib/transaction.js");
const { scheduleApproval } = require("../jobs/approval_job.js");
const { publish } = require("../lib/rabbit.js");

exports.savePayment = async (req) => {
  let isValid = valitadeService.validateJson(req.body);
  if (!isValid) {
    throw new Error("Invalid payload");
  }

  const transactionToSave = await transactionService.createTransaction({
    transaction_id: crypto.randomUUID(),
    user_id: req.body.user_id,
    amount: req.body.amount,
    currency: req.body.currency,
    description: req.body.description,
    status: transactionStatus.PENDING,
  });

  await publish(process.env.PAYMENT_REQUEST_QUEUE_NAME, {
    ...transactionToSave,
    event: "PAYMENT_RECEIVED",
  });

  scheduleApproval(transactionToSave);

  console.log(`[PaymentService] [${transactionToSave.transaction_id}] saved transaction`);
  return transactionToSave;
};
