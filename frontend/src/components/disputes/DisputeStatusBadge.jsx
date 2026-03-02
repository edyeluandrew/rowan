import { ShieldX, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';

/**
 * DisputeStatusBadge — maps dispute status to colored badge with Lucide icon.
 * Props: status (string)
 */
const BADGE_MAP = {
  OPEN:                 { cls: 'bg-rowan-red/15 text-rowan-red border border-rowan-red/30', Icon: ShieldX },
  UNDER_REVIEW:         { cls: 'bg-rowan-yellow/15 text-rowan-yellow border border-rowan-yellow/30', Icon: ShieldAlert },
  RESOLVED_TRADER_WIN:  { cls: 'bg-rowan-green/15 text-rowan-green', Icon: ShieldCheck },
  RESOLVED_USER_WIN:    { cls: 'bg-rowan-red/15 text-rowan-red', Icon: ShieldOff },
};

const LABEL_MAP = {
  OPEN:                'Open',
  UNDER_REVIEW:        'Under Review',
  RESOLVED_TRADER_WIN: 'Resolved — You Won',
  RESOLVED_USER_WIN:   'Resolved — User Won',
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
