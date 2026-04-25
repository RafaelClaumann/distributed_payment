CREATE TABLE IF NOT EXISTS transactions (
    transaction_id UUID PRIMARY KEY,
    user_id        UUID           NOT NULL,
    amount         NUMERIC(10,2)  NOT NULL,
    currency       VARCHAR(10)    NOT NULL,
    description    TEXT,
    status         VARCHAR(20)    NOT NULL,
    attempts       INT            NOT NULL DEFAULT 0,
    created_at     TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

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
