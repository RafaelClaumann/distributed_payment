const valitadeService = require("./validation_service.js");
const transactionStatus = require("../enums/transaction_status.js");

var payments = [
  {
    transactionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    userId: "123e4567-e89b-12d3-a456-426614174000",
    amount: 299.9,
    currency: "BRL",
    description: "Compra na CompreFácil",
    status: transactionStatus.PENDING,
    createdAt: "2026-04-17T14:30:00.000Z",
  },
];

exports.savePayment = async (req) => {
  let transactionToSave = {
    transactionId: crypto.randomUUID(),
    userId: req.body.user_id,
    amount: req.body.amount,
    currency: req.body.currency,
    description: req.body.description,
    status: transactionStatus.fromString("pending"),
    createdAt: Date.now(),
  };

  let isValid = valitadeService.validateJson(req.body);
  if (!isValid) {
    throw new Error("Invalid payload");
  }

  console.log("Salvando pagamento: ", transactionToSave);
  payments.push(transactionToSave);

  return payments.at(-1);
};
