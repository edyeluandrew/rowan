-- Uganda-only launch: deactivate other corridors; P2P is the only live fiat rail.

UPDATE countries
SET active = false,
    updated_at = NOW()
WHERE code <> 'UG';

UPDATE countries
SET active = true,
    payment_config = jsonb_build_object(
      'offramp', jsonb_build_array('p2p_trader'),
      'onramp', jsonb_build_array('p2p_trader'),
      'default_offramp_provider', 'p2p_trader',
      'fallback_provider', 'p2p_trader',
      'launch_mode', 'uganda_only_p2p'
    ),
    updated_at = NOW()
WHERE code = 'UG';

COMMENT ON TABLE countries IS
  'Country registry. Launch: only UG active with P2P rails; re-enable corridors when compliance ready.';
