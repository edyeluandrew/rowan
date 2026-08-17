-- Collect Money funds the same UGX wallet that Send Money pays from.
-- Uganda buy prefers MarzPay collections; P2P remains fallback.

UPDATE countries SET
  payment_config = jsonb_build_object(
    'offramp', jsonb_build_array('marz_pay', 'p2p_trader'),
    'onramp', jsonb_build_array('marz_pay', 'p2p_trader'),
    'default_offramp_provider', 'marz_pay',
    'default_onramp_provider', 'marz_pay',
    'fallback_provider', 'p2p_trader',
    'launch_mode', 'uganda_marzpay_loop'
  ),
  updated_at = NOW()
WHERE code = 'UG';
