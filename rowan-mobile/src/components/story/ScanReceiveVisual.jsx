/**
 * Slide 3: someone scans your Rowan QR and the USDC lands in your wallet.
 */
import QRCode from 'react-qr-code';
import { Check, ArrowDownLeft } from 'lucide-react';

const DEMO_ADDRESS = 'GAIUDOEXAMPLE7ROWANRECEIVEPEERDEMO4W2A54XXXX';

export default function ScanReceiveVisual() {
  return (
    <div className="ob-stage py-2">
      <div className="relative w-full max-w-[290px]">
        {/* QR being scanned */}
        <div className="rounded-3xl bg-rowan-surface border border-rowan-border p-3.5 shadow-sm">
          <div className="relative mx-auto w-[136px]">
            <div className="ob-scan-frame rounded-2xl bg-white p-2.5">
              <QRCode
                value={DEMO_ADDRESS}
                size={116}
                fgColor="#000000"
                bgColor="#FFFFFF"
                style={{ width: '100%', height: 'auto' }}
              />
              <span className="ob-scan-beam" aria-hidden="true" />
            </div>
            <span className="ob-scan-corner ob-scan-corner--tl" aria-hidden="true" />
            <span className="ob-scan-corner ob-scan-corner--tr" aria-hidden="true" />
            <span className="ob-scan-corner ob-scan-corner--bl" aria-hidden="true" />
            <span className="ob-scan-corner ob-scan-corner--br" aria-hidden="true" />
          </div>

          <p className="mt-2.5 text-center text-[11px] font-medium text-rowan-muted">
            Your receive code · GAIU…A54X
          </p>
        </div>

        {/* Incoming payment receipt */}
        <div className="ob-receipt mt-3 rounded-2xl bg-rowan-dark px-4 py-3 shadow-[0_12px_28px_rgba(11,15,12,0.28)]">
          <div className="flex items-center gap-3">
            <span className="relative flex h-9 w-9 flex-none items-center justify-center rounded-full bg-rowan-green">
              <Check size={17} className="text-white" strokeWidth={3} />
              <span
                className="ob-tick-ring absolute inset-0 rounded-full border-2 border-rowan-green"
                aria-hidden="true"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-tight text-white">Received 25.00 USDC</p>
              <p className="mt-0.5 truncate text-[11px] text-white/60">from GAIU…A54X</p>
            </div>
            <ArrowDownLeft size={17} className="flex-none text-rowan-green" />
          </div>
        </div>
      </div>
    </div>
  );
}
