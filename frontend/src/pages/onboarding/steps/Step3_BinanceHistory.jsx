import { useState } from 'react';
import DocumentUploader from '../../../components/onboarding/DocumentUploader';
import Button from '../../../components/ui/Button';

const ACTIVE_OPTIONS = [
  { value: 'less_than_6', label: 'Less than 6 months' },
  { value: '6_to_12', label: '6-12 months' },
  { value: '1_to_2_years', label: '1-2 years' },
  { value: '2_plus_years', label: '2+ years' },
];

/**
 * Step3_BinanceHistory — P2P trading history form.
 * Props: formData, setFormData, goNext
 */
export default function Step3_BinanceHistory({ formData, setFormData, goNext }) {
  const saved = formData.binance || {};
  const [binanceUid, setBinanceUid] = useState(saved.binanceUid || '');
  const [tradeCount, setTradeCount] = useState(saved.binanceTradeCount || '');
  const [completionRate, setCompletionRate] = useState(saved.binanceCompletionRate || '');
  const [activeMonths, setActiveMonths] = useState(saved.binanceActiveMonths || '');
  const [screenshot, setScreenshot] = useState(saved.screenshot || null);
  const [errors, setErrors] = useState({});

  const belowThreshold =
    (tradeCount && parseInt(tradeCount) < 100) ||
    (completionRate && parseFloat(completionRate) < 95);

  const validate = () => {
    const e = {};
    if (!binanceUid.trim()) e.binanceUid = 'Binance UID or Username is required';
    if (!tradeCount || parseInt(tradeCount) < 0) e.tradeCount = 'Number of trades is required';
    if (!completionRate || parseFloat(completionRate) < 0 || parseFloat(completionRate) > 100) {
      e.completionRate = 'Valid completion rate (0-100) is required';
    }
    if (!activeMonths) e.activeMonths = 'Please select how long you have been active';
    if (!screenshot) e.screenshot = 'Binance P2P profile screenshot is required';
    return e;
  };

  const handleContinue = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setFormData((prev) => ({
      ...prev,
      binance: {
        binanceUid,
        binanceTradeCount: parseInt(tradeCount),
        binanceCompletionRate: parseFloat(completionRate),
        binanceActiveMonths: activeMonths,
        screenshot,
      },
    }));
    goNext();
  };

  const inputCls = 'bg-rowan-surface border border-rowan-border text-rowan-text rounded px-4 py-3.5 w-full focus:outline-none focus:border-rowan-yellow placeholder-rowan-muted text-sm';

  return (
    <div>
      <h2 className="text-rowan-text font-bold text-xl">Your Binance P2P history</h2>
      <p className="text-rowan-muted text-sm mt-1 mb-6">
        We require a minimum of 100 completed trades with 95% completion rate.
      </p>

      {/* Threshold cards */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-rowan-surface border border-rowan-border rounded-md p-3 text-center">
          <p className="text-rowan-yellow font-bold text-xl">100+</p>
          <p className="text-rowan-muted text-xs">Trades</p>
          <p className="text-rowan-muted text-[10px]">Minimum required</p>
        </div>
        <div className="flex-1 bg-rowan-surface border border-rowan-border rounded-md p-3 text-center">
          <p className="text-rowan-yellow font-bold text-xl">95%+</p>
          <p className="text-rowan-muted text-xs">Completion</p>
          <p className="text-rowan-muted text-[10px]">Minimum required</p>
        </div>
      </div>

      {/* Binance UID */}
      <label className="block mb-1 text-rowan-muted text-xs">Binance UID or Username</label>
      <input
        type="text"
        value={binanceUid}
        onChange={(e) => setBinanceUid(e.target.value)}
        placeholder="Enter your Binance UID"
        className={inputCls}
      />
      {errors.binanceUid && <p className="text-rowan-red text-xs mt-1">{errors.binanceUid}</p>}

      {/* Number of Trades */}
      <label className="block mb-1 text-rowan-muted text-xs mt-4">Number of Completed P2P Trades</label>
      <input
        type="number"
        value={tradeCount}
        onChange={(e) => setTradeCount(e.target.value)}
        placeholder="e.g. 250"
        min="0"
        className={inputCls}
      />
      {errors.tradeCount && <p className="text-rowan-red text-xs mt-1">{errors.tradeCount}</p>}

      {/* Completion Rate */}
      <label className="block mb-1 text-rowan-muted text-xs mt-4">Completion Rate %</label>
      <input
        type="number"
        value={completionRate}
        onChange={(e) => setCompletionRate(e.target.value)}
        placeholder="e.g. 98.5"
        min="0"
        max="100"
        step="0.1"
        className={inputCls}
      />
      {errors.completionRate && <p className="text-rowan-red text-xs mt-1">{errors.completionRate}</p>}

      {/* Active Duration */}
      <label className="block mb-1 text-rowan-muted text-xs mt-4">How long active on Binance P2P</label>
      <select
        value={activeMonths}
        onChange={(e) => setActiveMonths(e.target.value)}
        className={inputCls}
      >
        <option value="" className="text-rowan-muted">Select duration</option>
        {ACTIVE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {errors.activeMonths && <p className="text-rowan-red text-xs mt-1">{errors.activeMonths}</p>}

      {/* Screenshot Upload */}
      <div className="mt-4">
        <DocumentUploader
          label="Screenshot of your Binance P2P profile showing your stats"
          required
          onFileSelected={(base64, name, ext) =>
            setScreenshot(base64 === null ? null : { base64, name, ext })
          }
          currentFile={screenshot}
        />
        {errors.screenshot && <p className="text-rowan-red text-xs mt-1">{errors.screenshot}</p>}
      </div>

      {/* Threshold warning */}
      {belowThreshold && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-md p-3 mt-4">
          <p className="text-rowan-yellow text-sm">
            Your stats are below our minimum requirements. You can still submit but your application will require manual review.
          </p>
        </div>
      )}

      <div className="mt-8">
        <Button variant="primary" size="lg" onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
