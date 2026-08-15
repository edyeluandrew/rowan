-- After 050_uganda_only_p2p_launch: keep UG-only, but cash-out via MarzPay
-- disbursement with P2P fallback. Buy stays P2P.

UPDATE countries SET
  payment_config = jsonb_build_object(
    'offramp', jsonb_build_array('marz_pay', 'p2p_trader'),
    'onramp', jsonb_build_array('p2p_trader'),
    'default_offramp_provider', 'marz_pay',
    'fallback_provider', 'p2p_trader',
    'launch_mode', 'uganda_marzpay_offramp'
  ),
  updated_at = NOW()
WHERE code = 'UG';

COMMENT ON COLUMN transactions.payout_provider IS 'marz_pay | yellow_pay | p2p_trader — primary rail attempted or used';
COMMENT ON COLUMN transactions.aggregator_ref IS 'External reference from MarzPay, Yellow Pay, or other aggregator';
