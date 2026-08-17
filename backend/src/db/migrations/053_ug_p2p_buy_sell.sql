-- Launch mode: P2P for USDC buy/sell so traders hold float.
-- MarzPay stays on bills/airtime/data only (not this payment_config).

UPDATE countries SET
  payment_config = jsonb_build_object(
    'offramp', jsonb_build_array('p2p_trader'),
    'onramp', jsonb_build_array('p2p_trader'),
    'default_offramp_provider', 'p2p_trader',
    'default_onramp_provider', 'p2p_trader',
    'fallback_provider', 'p2p_trader',
    'launch_mode', 'uganda_p2p_exchange_marzpay_utilities'
  ),
  updated_at = NOW()
WHERE code = 'UG';
