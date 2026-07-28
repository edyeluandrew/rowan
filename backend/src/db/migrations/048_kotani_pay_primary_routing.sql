-- Phase 2: Kotani Pay primary automated rail (sandbox approved)

UPDATE countries SET
  payment_config = jsonb_build_object(
    'offramp', jsonb_build_array('kotani_pay', 'p2p_trader'),
    'onramp', jsonb_build_array('kotani_pay', 'p2p_trader'),
    'default_offramp_provider', 'kotani_pay',
    'fallback_provider', 'p2p_trader'
  ),
  updated_at = NOW()
WHERE code IN ('UG', 'KE', 'TZ', 'RW', 'NG', 'GH');

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS aggregator_settlement_tx TEXT;

COMMENT ON COLUMN transactions.aggregator_settlement_tx IS 'On-chain USDC tx from Rowan escrow to aggregator (Kotani escrowAddress)';
