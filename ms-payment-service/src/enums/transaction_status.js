const TransactionStatus = Object.freeze({
  PENDING: "pending",
  SUCCESS: "success",
  fromString(value) {
    const status = Object.values(this)
      .filter((s) => typeof s === "string")
      .find((s) => s === value?.toLowerCase());

    if (!status) {
      throw new Error(`Invalid transaction status: ${value}`);
    }

    return status;
  },
});

module.exports = TransactionStatus;
