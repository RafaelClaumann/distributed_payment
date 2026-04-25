const { getTransactionById, updateTransactionStatus } = require("../lib/transaction.js");
const { logDlqEvent } = require("../lib/dlq_events.js");
const { getChannel } = require("../lib/rabbit.js");
const { scheduleApproval } = require("./approval_job.js");
const transactionStatus = require("../enums/transaction_status.js");

const INTERVAL_MS = process.env.PAYMENT_JOB_REPROCESSING_INTERVAL_MS;
const MAX_ATTEMPTS = process.env.MAX_TRANSACTION_ATTEMPS;

function isTransactionSucceeded(transaction) {
    return transaction.status === transactionStatus.SUCCESS;
}

function isMaxAttemptsReached(transaction) {
    return transaction.attempts >= MAX_ATTEMPTS;
}

async function updateStatusAndLogDlqEvent(transaction, messageContent) {
    await updateTransactionStatus(transaction.transaction_id, transactionStatus.ERROR);
    await logDlqEvent(transaction.transaction_id, transaction.attempts, messageContent.error);
}

async function reprocessDlqMessages() {
    let message;
    const channel = await getChannel();
    const dlqName = process.env.PAYMENT_DLQ_QUEUE_NAME;

    while ((message = await channel.get(dlqName, { noAck: false })) !== false) {
        const messageContent = JSON.parse(message.content.toString());
        const transaction = await getTransactionById(messageContent.transaction_id);

        if (isTransactionSucceeded(transaction)) return;

        if (isMaxAttemptsReached(transaction)) {
            await updateStatusAndLogDlqEvent(transaction, messageContent);

            console.error(`[DLQ] [${transaction.transaction_id}] atingiu ${MAX_ATTEMPTS} tentativas — descartando`);
            channel.ack(message);
            continue;
        }

        console.log(`[DLQ] [${transaction.transaction_id}] Reprocessando - tentativa ${transaction.attempts}/${MAX_ATTEMPTS}`,);

        const delay = Math.pow(2, transaction.attempts) * 1000;
        setTimeout(() => scheduleApproval({ ...messageContent }), delay);
        channel.ack(message);
    }
}

function startDlqJob() {
    setInterval(reprocessDlqMessages, parseInt(INTERVAL_MS))
    console.log("[DLQ Job] Iniciado");
}

module.exports = { startDlqJob };
