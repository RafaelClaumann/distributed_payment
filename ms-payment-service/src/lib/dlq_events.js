const { query } = require("./db.js");

async function logDlqEvent(transactionId, attempts, error) {
  const { rows } = await query(
    `INSERT INTO dlq_events (transaction_id, attempts, error)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [transactionId, attempts, error],
  );
  return rows[0];
}

async function getDlqEventsByTransaction(transactionId) {
  const { rows } = await query(
    `SELECT * FROM dlq_events WHERE transaction_id = $1 ORDER BY created_at ASC`,
    [transactionId],
  );
  return rows;
}

module.exports = { logDlqEvent, getDlqEventsByTransaction };
