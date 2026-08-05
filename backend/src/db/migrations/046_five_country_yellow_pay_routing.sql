-- Phase 2 C9: Five-country launch corridors + Yellow Pay primary routing

-- Standard payment_config: Yellow Pay first, P2P trader fallback
UPDATE countries SET
  payment_config = jsonb_build_object(
    'offramp', jsonb_build_array('yellow_pay', 'p2p_trader'),
    'onramp', jsonb_build_array('yellow_pay', 'p2p_trader'),
    'default_offramp_provider', 'yellow_pay',
    'fallback_provider', 'p2p_trader'
  ),
  updated_at = NOW()
WHERE code IN ('UG', 'KE', 'TZ', 'RW');

INSERT INTO countries (code, name, currency_code, phone_prefix, flag_emoji, sort_order, kyc_config, payment_config)
VALUES
  ('NG', 'Nigeria', 'NGN', '+234', '🇳🇬', 5,
   '{"tier1_daily_usd":50,"tier2_daily_usd":1000}'::jsonb,
   '{"offramp":["yellow_pay","p2p_trader"],"onramp":["yellow_pay","p2p_trader"],"default_offramp_provider":"yellow_pay","fallback_provider":"p2p_trader"}'::jsonb),
  ('GH', 'Ghana', 'GHS', '+233', '🇬🇭', 6,
   '{"tier1_daily_usd":50,"tier2_daily_usd":1000}'::jsonb,
   '{"offramp":["yellow_pay","p2p_trader"],"onramp":["yellow_pay","p2p_trader"],"default_offramp_provider":"yellow_pay","fallback_provider":"p2p_trader"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  currency_code = EXCLUDED.currency_code,
  phone_prefix = EXCLUDED.phone_prefix,
  flag_emoji = EXCLUDED.flag_emoji,
  sort_order = EXCLUDED.sort_order,
  kyc_config = EXCLUDED.kyc_config,
  payment_config = EXCLUDED.payment_config,
  active = true,
  updated_at = NOW();

INSERT INTO country_payment_methods (country_code, network_code, label, provider, sort_order)
VALUES
  ('NG', 'MTN_NG', 'MTN MoMo', 'momo', 1),
  ('NG', 'AIRTEL_NG', 'Airtel Money', 'momo', 2),
  ('GH', 'MTN_GH', 'MTN MoMo', 'momo', 1),
  ('GH', 'AIRTELTIGO_GH', 'AirtelTigo Money', 'momo', 2),
  ('GH', 'VODAFONE_GH', 'Vodafone Cash', 'momo', 3)
ON CONFLICT (country_code, network_code) DO UPDATE SET
  label = EXCLUDED.label,
  provider = EXCLUDED.provider,
  sort_order = EXCLUDED.sort_order,
  active = true;
