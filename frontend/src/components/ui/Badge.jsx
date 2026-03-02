import { NETWORKS, TX_STATES } from '../../utils/constants';

const networkMap = {
  MTN_UG:    NETWORKS.MTN_UG,
  AIRTEL_UG: NETWORKS.AIRTEL_UG,
  MPESA_KE:  NETWORKS.MPESA_KE,
  MPESA_TZ:  NETWORKS.MPESA_TZ,
  // Fallback-friendly aliases
  'MTN MoMo':  NETWORKS.MTN_UG,
  'Airtel UG':  NETWORKS.AIRTEL_UG,
  'M-Pesa KE':  NETWORKS.MPESA_KE,
  'M-Pesa TZ':  NETWORKS.MPESA_TZ,
};

export default function Badge({ type = 'status', value }) {
  if (type === 'network') {
    const net = networkMap[value] || { label: value, color: 'bg-rowan-muted/20 text-rowan-muted' };
    return (
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${net.color}`}>
        {net.label}
      </span>
    );
  }

  /* status badge */
  const state = TX_STATES[value] || { label: value, badge: 'bg-rowan-muted/15 text-rowan-muted' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${state.badge}`}>
      {state.label}
    </span>
  );
}
