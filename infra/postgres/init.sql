CREATE TABLE IF NOT EXISTS transactions (
    transaction_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);

INSERT INTO transactions (
    transaction_id,
    user_id,
    amount,
    currency,
    description,
    status,
    created_at
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    '123e4567-e89b-12d3-a456-426614174000',
    299.90,
    'BRL',
    'Compra na CompreFácil',
    'pending',
    '2026-04-17T14:30:00.000Z'
);
