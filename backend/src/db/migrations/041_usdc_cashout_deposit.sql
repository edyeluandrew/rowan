-- USDC-native cash-out: user sends USDC to escrow instead of XLM.

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deposit_asset TEXT NOT NULL DEFAULT 'USDC';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS usdc_deposit_amount NUMERIC(18,7);

COMMENT ON COLUMN quotes.deposit_asset IS 'Asset the user must send to escrow: USDC (default) or XLM (legacy).';
COMMENT ON COLUMN quotes.usdc_deposit_amount IS 'Exact USDC amount the user must send when deposit_asset = USDC.';
