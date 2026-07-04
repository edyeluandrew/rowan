import { ShieldX, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';

/**
 * DisputeStatusBadge — maps dispute status to colored badge with Lucide icon.
 * Props: status (string)
 */
const BADGE_MAP = {
  OPEN:                 { cls: 'bg-rowan-red/15 text-rowan-red border border-rowan-red/30', Icon: ShieldX },
  TRADER_RESPONDED:     { cls: 'bg-rowan-blue/15 text-rowan-blue border border-rowan-blue/30', Icon: ShieldCheck },
  UNDER_REVIEW:         { cls: 'bg-rowan-yellow/15 text-rowan-yellow border border-rowan-yellow/30', Icon: ShieldAlert },
  ESCALATED:            { cls: 'bg-rowan-orange/15 text-rowan-orange border border-rowan-orange/30', Icon: ShieldAlert },
  RESOLVED_FOR_TRADER:  { cls: 'bg-rowan-green/15 text-rowan-green', Icon: ShieldCheck },
  RESOLVED_FOR_USER:    { cls: 'bg-rowan-red/15 text-rowan-red', Icon: ShieldOff },
  DISMISSED:            { cls: 'bg-rowan-muted/20 text-rowan-muted border border-rowan-border', Icon: ShieldOff },
  CLOSED:               { cls: 'bg-rowan-muted/20 text-rowan-muted border border-rowan-border', Icon: ShieldCheck },
};

const LABEL_MAP = {
  OPEN:                'Open',
  TRADER_RESPONDED:    'Response Submitted',
  UNDER_REVIEW:        'Under Review',
  ESCALATED:           'Escalated',
  RESOLVED_FOR_TRADER: 'Resolved — You Won',
  RESOLVED_FOR_USER:   'Resolved — User Won',
  DISMISSED:           'Dismissed',
  CLOSED:              'Closed',
};

export default function DisputeStatusBadge({ status }) {
  const badge = BADGE_MAP[status] || { cls: 'bg-rowan-muted/15 text-rowan-muted', Icon: ShieldAlert };
  const label = LABEL_MAP[status] || status;
  const { cls, Icon } = badge;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}
