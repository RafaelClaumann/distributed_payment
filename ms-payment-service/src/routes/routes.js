const express = require("express");
const paymentController = require('../controllers/payment_controller.js')

const router = express.Router();

router.get("/", (res) => {
  res.redirect("/make-payment");
});

router.post("/make-payment", (req, res) => {
  paymentController.create(req, res);
});

module.exports = router;
