const paymentService = require("../services/payment_service.js");

exports.create = async (req, res) => {
  let transaction;
  try {
    transaction = await paymentService.savePayment(req);
  } catch (error) {
    res.status(400).json({ error: "Invalid payload" });
  }

  res.status(201).json(transaction);
};
