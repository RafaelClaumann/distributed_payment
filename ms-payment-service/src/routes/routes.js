const express = require('express')

const router = express.Router();

router.get("/", (req, res) => {
  res.redirect("/make-payment");
});

router.get("/make-payment", (req, res) => {
  res.send("Make Payment");
});

module.exports = router;
