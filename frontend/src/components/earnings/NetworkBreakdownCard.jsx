import { BarChart3 } from 'lucide-react';
import Badge from '../ui/Badge';

/**
 * NetworkBreakdownCard — earnings by network.
 * Props: byNetwork (array of { network, usdc, transactionCount, percentOfTotal })
 */
export default function NetworkBreakdownCard({ byNetwork = [] }) {
  if (!byNetwork.length) return null;

  const total = byNetwork.reduce((s, n) => s + (n.usdc || 0), 0) || 1;

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className="text-rowan-yellow" />
        <h3 className="text-rowan-text font-bold text-sm">Earnings by Network</h3>
      </div>

      {byNetwork.map((net, i) => {
        const pct = net.percentOfTotal ?? ((net.usdc || 0) / total * 100);
        return (
          <div key={i}>
            <div className="flex items-center justify-between py-3 border-b border-rowan-border last:border-0">
              <Badge type="network" value={net.network} />
              <span className="text-rowan-muted text-xs">{net.transactionCount || 0} txs</span>
              <div className="text-right">
                <span className="text-rowan-yellow font-bold tabular-nums text-sm">
                  {(net.usdc || 0).toFixed(2)} USDC
                </span>
                <div className="text-rowan-muted text-xs">{pct.toFixed(1)}%</div>
              </div>
            </div>
            <div className="w-full h-0.5 bg-rowan-border">
              <div
                className="h-full bg-rowan-yellow transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
