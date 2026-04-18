const paymentService = require('../services/payment_service.js')

exports.create = async (req, res) => {
  console.log("body: ", req.body)
  const transaction = await paymentService.savePayment(req);
  res.status(201).json(transaction)
}
