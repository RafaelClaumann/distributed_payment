const { query } = require("./db.js");

async function createTransaction(data) {
  const { rows } = await query(
    `INSERT INTO transactions 
      (transaction_id, user_id, amount, currency, description, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.transaction_id,
      data.user_id,
      data.amount,
      data.currency,
      data.description,
      data.status,
    ],
  );

  return rows[0];
}

async function getTransactionById(id) {
  const { rows } = await query(
    `SELECT * FROM transactions WHERE transaction_id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

async function getTransactionsByUser(userId) {
  const { rows } = await query(
    `SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

async function updateTransactionStatus(id, status) {
  const { rows } = await query(
    `UPDATE transactions SET status = $1 WHERE transaction_id = $2 RETURNING *`,
    [status, id],
  );
  return rows[0] ?? null;
}

async function deleteTransaction(id) {
  await query(`DELETE FROM transactions WHERE transaction_id = $1`, [id]);
}

module.exports = {
  createTransaction,
  getTransactionById,
  getTransactionsByUser,
  updateTransactionStatus,
  deleteTransaction,
};
