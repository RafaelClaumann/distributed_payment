const valitadeService = require("./validation_service.js");
const transactionStatus = require("../enums/transaction_status.js");
const transactionService = require("../lib/transaction.js");

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
    status: transactionStatus.fromString("pending"),
  });

  console.log("Saving transaction: ", transactionToSave);
  return transactionToSave;
};
