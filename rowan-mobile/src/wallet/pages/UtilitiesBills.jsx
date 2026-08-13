import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, AlertTriangle, Loader2 } from 'lucide-react'
import useWallet from '../hooks/useWallet'
import useRates from '../hooks/useRates'
import useUserCountry from '../hooks/useUserCountry'
import { getUtilityLimitsForCountry } from '../utils/country'
import useBiometricProtection from '../../shared/hooks/useBiometricProtection'
import BiometricLock from '../../shared/components/BiometricLock'
import {
  getUtilityQuote,
  getUtilityConfig,
  getUtilityHistory,
  getUtilityBillers,
  getUtilityBillLookup,
  getUtilityBillBouquets,
} from '../api/utilities'
import AmountInput from '../components/cashout/AmountInput'
import BillerPicker from '../components/utilities/BillerPicker'
import PhoneInput from '../components/cashout/PhoneInput'
import Button from '../components/ui/Button'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'

function isTvBiller(biller) {
  const id = String(biller?.id || '').toUpperCase()
  return id === 'DSTV' || id === 'GOTV'
}

function isNwsc(biller) {
  return String(biller?.id || '').toUpperCase() === 'NWSC'
}

function isElectricity(biller) {
  const id = String(biller?.id || '').toUpperCase()
  return id === 'LIGHT' || id === 'UMEME'
    || (String(biller?.type || '').toUpperCase() === 'ELECTRICITY_BILL_PAYMENT'
      && String(biller?.serviceType || '').toUpperCase() === 'PREPAID')
}

export default function UtilitiesBills() {
  const navigate = useNavigate()
  const { isLocked } = useBiometricProtection()
  const { country, fiatCurrency } = useUserCountry()
  const { usdcAvailable, usdcBalance, hasUsdcTrustline } = useWallet()
  const spendableUsdc = usdcAvailable ?? usdcBalance
  const { rates } = useRates(fiatCurrency)

  const [selectedBiller, setSelectedBiller] = useState(null)
  const [billers, setBillers] = useState([])
  const [nwscAreas, setNwscAreas] = useState([])
  const [billersLoading, setBillersLoading] = useState(false)
  const [billersError, setBillersError] = useState(null)
  const [accountNumber, setAccountNumber] = useState('')
  const [notifyPhone, setNotifyPhone] = useState('')
  const [area, setArea] = useState('')
  const [fiatAmount, setFiatAmount] = useState('')
  const [bouquets, setBouquets] = useState([])
  const [bouquetCode, setBouquetCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [utilityConfig, setUtilityConfig] = useState(null)
  const [history, setHistory] = useState([])
  const [billLookup, setBillLookup] = useState(null)
  const [billLookupLoading, setBillLookupLoading] = useState(false)

  useEffect(() => {
    getUtilityConfig().then(setUtilityConfig).catch(() => {})
    getUtilityHistory(5)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : []
        setHistory(list.filter((r) => (r.type || r.utility_type) === 'bill'))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setBillersLoading(true)
    setBillersError(null)
    setSelectedBiller(null)
    setArea('')
    setBouquetCode('')
    setBouquets([])
    getUtilityBillers(country)
      .then((data) => {
        setBillers(data.billers || [])
        setNwscAreas(data.nwscAreas || [])
      })
      .catch((err) => {
        setBillers([])
        setBillersError(err.response?.data?.error || err.message)
      })
      .finally(() => setBillersLoading(false))
  }, [country])

  useEffect(() => {
    if (!isTvBiller(selectedBiller)) {
      setBouquets([])
      setBouquetCode('')
      return undefined
    }
    let cancelled = false
    getUtilityBillBouquets(selectedBiller.id)
      .then((data) => {
        if (cancelled) return
        const list = data.bouquets || data.bouquet_details || []
        setBouquets(list)
      })
      .catch(() => {
        if (!cancelled) setBouquets([])
      })
    return () => { cancelled = true }
  }, [selectedBiller])

  const selectedBouquet = bouquets.find((b) => b.code === bouquetCode)
  const currency = selectedBiller?.currency || fiatCurrency
  const usdcToFiatRate = rates?.usdcToFiat || 0
  const feePercent = utilityConfig?.feePercent ?? 1
  const providerFee = Number(utilityConfig?.marzPayBillFeeFiat || 1200)
  const countryLimits = getUtilityLimitsForCountry(country)
  const minFiat = selectedBiller?.minAmount ?? utilityConfig?.minFiatAmount ?? countryLimits.min
  const maxFiat = selectedBiller?.maxAmount ?? utilityConfig?.maxFiatAmount ?? countryLimits.max

  const netFiat = isTvBiller(selectedBiller)
    ? Number(selectedBouquet?.price || 0)
    : (parseFloat(fiatAmount) || 0)
  const chargeableFiat = netFiat > 0 ? netFiat + providerFee : 0

  useEffect(() => {
    const cleanAccount = accountNumber.replace(/\s+/g, '')
    if (!selectedBiller || cleanAccount.length < 4) {
      setBillLookup(null)
      return undefined
    }
    if (isNwsc(selectedBiller) && !area) {
      setBillLookup(null)
      return undefined
    }

    let cancelled = false
    const timer = setTimeout(() => {
      setBillLookupLoading(true)
      getUtilityBillLookup({
        billerId: selectedBiller.id,
        subscriberAccount: cleanAccount,
        fiatAmount: Math.round(netFiat) || undefined,
        serviceType: selectedBiller.serviceType,
        area: isNwsc(selectedBiller) ? area : undefined,
      })
        .then((data) => {
          if (!cancelled) setBillLookup(data)
        })
        .catch(() => {
          if (!cancelled) setBillLookup(null)
        })
        .finally(() => {
          if (!cancelled) setBillLookupLoading(false)
        })
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [selectedBiller, accountNumber, area, netFiat])

  const usdcEstimate = usdcToFiatRate > 0 && chargeableFiat > 0
    ? (chargeableFiat / usdcToFiatRate) * (1 + feePercent / 100)
    : 0

  const walletMaxFiat = usdcToFiatRate > 0 && spendableUsdc != null
    ? (spendableUsdc * usdcToFiatRate / (1 + feePercent / 100)) - providerFee
    : null

  const accountValid = accountNumber.replace(/\s+/g, '').length >= 4
  const phoneValid = notifyPhone.replace(/\D/g, '').length >= 9
  const exceedsWallet = walletMaxFiat != null && netFiat > walletMaxFiat
  const belowMin = !isTvBiller(selectedBiller) && netFiat > 0 && netFiat < minFiat
  const aboveMax = !isTvBiller(selectedBiller) && netFiat > maxFiat
  const areaOk = !isNwsc(selectedBiller) || !!area
  const bouquetOk = !isTvBiller(selectedBiller) || !!bouquetCode

  const canProceed =
    !!selectedBiller &&
    accountValid &&
    phoneValid &&
    areaOk &&
    bouquetOk &&
    netFiat >= minFiat &&
    (isTvBiller(selectedBiller) || netFiat <= maxFiat) &&
    hasUsdcTrustline !== false &&
    !exceedsWallet

  if (isLocked) return <BiometricLock />

  const handleGetQuote = async () => {
    if (!canProceed) return
    setLoading(true)
    setError(null)
    try {
      const cleanAccount = accountNumber.replace(/\s+/g, '')
      const billerLabel = selectedBouquet
        ? `${selectedBiller.name} · ${selectedBouquet.name}`
        : selectedBiller.name

      const quote = await getUtilityQuote({
        country: selectedBiller.countryCode || country,
        type: 'bill',
        billerId: selectedBiller.id,
        billerName: selectedBiller.name,
        billerServiceType: selectedBiller.serviceType,
        billerType: selectedBiller.type,
        subscriberAccount: cleanAccount,
        fiatAmount: Math.round(netFiat),
        bundleDescription: billerLabel,
        area: isNwsc(selectedBiller) ? area : undefined,
        bouquetCode: isTvBiller(selectedBiller) ? bouquetCode : undefined,
        notifyPhone,
        customerName: billLookup?.customerName || undefined,
      })

      navigate('/wallet/utilities/confirm', {
        state: {
          quote: {
            ...quote,
            subscriberName: billLookup?.customerName || null,
          },
          phone: cleanAccount,
          utilityType: 'bill',
          mockPurchaseAllowed: utilityConfig?.mockPurchaseAllowed,
          billLookup,
        },
      })
    } catch (err) {
      const data = err.response?.data
      setError(data?.error || data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  const usingMarz = (utilityConfig?.billsProvider || 'marzpay') === 'marzpay'

  return (
    <div className="px-4 pb-8">
      <p className="text-rowan-muted text-xs mb-4">
        Pay UMEME, water, and TV with USDC
      </p>

      <UsdcTrustlineSetup compact />

      {usingMarz && utilityConfig?.marzPayMock && (
        <div className="bg-rowan-mint border border-rowan-green/30 rounded-xl p-3 mb-4">
          <p className="text-rowan-text text-xs">
            Bills run on MarzPay sandbox/mock until live API keys are set. Add MARZPAY_API_KEY and MARZPAY_API_SECRET, then fund the MarzPay UGX wallet.
          </p>
        </div>
      )}

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-6">
        <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">USDC balance</p>
        <span className="text-rowan-text text-2xl font-bold tabular-nums">
          {spendableUsdc != null ? Number(spendableUsdc).toFixed(2) : '—'} USDC
        </span>
      </div>

      <p className="text-rowan-muted text-xs uppercase tracking-wider mb-3 px-1">
        Select provider
      </p>
      {billersError && (
        <div className="mb-3 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-3">
          <p className="text-rowan-yellow text-sm">{billersError}</p>
        </div>
      )}
      <BillerPicker
        billers={billers}
        selected={selectedBiller}
        onSelect={(biller) => {
          setSelectedBiller(biller)
          setBillLookup(null)
          setFiatAmount('')
          setBouquetCode('')
          setArea('')
        }}
        loading={billersLoading}
        country={country}
      />

      <div className="mt-6">
        <label className="block text-rowan-muted text-xs font-medium mb-2 uppercase tracking-wider">
          {isTvBiller(selectedBiller) ? 'Smartcard / IUC number' : 'Meter / account number'}
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder={isTvBiller(selectedBiller) ? 'e.g. 7039132763' : 'e.g. 04123456789'}
          className="w-full bg-rowan-surface border border-rowan-border rounded-xl px-4 py-3 text-rowan-text min-h-11"
        />
      </div>

      <div className="mt-4">
        <p className="text-rowan-muted text-xs mb-2 px-1">
          Phone for SMS confirmation (MTN or Airtel)
        </p>
        <PhoneInput
          phone={notifyPhone}
          onPhoneChange={setNotifyPhone}
          network="MTN_UG"
        />
      </div>

      {isNwsc(selectedBiller) && (
        <div className="mt-4">
          <label className="block text-rowan-muted text-xs font-medium mb-2 uppercase tracking-wider">
            NWSC area
          </label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full bg-rowan-surface border border-rowan-border rounded-xl px-4 py-3 text-rowan-text min-h-11"
          >
            <option value="">Select area</option>
            {(selectedBiller.areaOptions?.length ? selectedBiller.areaOptions : nwscAreas).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}

      {isTvBiller(selectedBiller) && (
        <div className="mt-4">
          <label className="block text-rowan-muted text-xs font-medium mb-2 uppercase tracking-wider">
            Bouquet
          </label>
          <select
            value={bouquetCode}
            onChange={(e) => setBouquetCode(e.target.value)}
            className="w-full bg-rowan-surface border border-rowan-border rounded-xl px-4 py-3 text-rowan-text min-h-11"
          >
            <option value="">Select package</option>
            {bouquets.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name} · {Number(item.price).toLocaleString()} UGX · {item.period_label || ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedBiller && !isTvBiller(selectedBiller) && (
        <div className="mt-6">
          <AmountInput
            fiatAmount={fiatAmount}
            onFiatAmountChange={setFiatAmount}
            currency={currency}
            cryptoEstimate={usdcEstimate}
            cryptoLabel="USDC"
            platformFeeFiat={chargeableFiat * (feePercent / 100)}
            maxFiat={Math.min(maxFiat, walletMaxFiat ?? maxFiat)}
          />
          <p className="text-rowan-muted text-xs mt-2 px-1">
            Min {minFiat.toLocaleString()} · Max {maxFiat.toLocaleString()} {currency}
            {' · '}MarzPay fee {providerFee.toLocaleString()} {currency} per bill
          </p>
        </div>
      )}

      {isTvBiller(selectedBiller) && selectedBouquet && (
        <div className="mt-4 bg-rowan-surface border border-rowan-border rounded-xl p-4">
          <p className="text-rowan-text text-sm font-semibold">{selectedBouquet.name}</p>
          <p className="text-rowan-muted text-xs mt-1">
            {Number(selectedBouquet.price).toLocaleString()} UGX
            {selectedBouquet.period_label ? ` · ${selectedBouquet.period_label}` : ''}
            {' + '}{providerFee.toLocaleString()} UGX service fee
          </p>
          <p className="text-rowan-yellow text-sm font-semibold mt-2 tabular-nums">
            ≈ {usdcEstimate.toFixed(4)} USDC
          </p>
        </div>
      )}

      {selectedBiller && (
        <div className="mt-3 bg-rowan-surface border border-rowan-border rounded-xl p-3 space-y-2">
          {billLookupLoading && (
            <div className="flex items-center gap-2 text-rowan-muted text-xs">
              <Loader2 size={14} className="animate-spin" />
              Checking account…
            </div>
          )}
          {!billLookupLoading && billLookup?.customerName && (
            <p className="text-rowan-text text-sm">
              <span className="text-rowan-muted">Name: </span>
              <span className="font-semibold">{billLookup.customerName}</span>
            </p>
          )}
          {!billLookupLoading && billLookup?.outstandingBalance > 0 && (
            <p className="text-rowan-muted text-xs">
              Outstanding: {Number(billLookup.outstandingBalance).toLocaleString()} {currency}
            </p>
          )}
          {!billLookupLoading && isElectricity(selectedBiller) && !billLookup?.customerName && (
            <p className="text-rowan-muted text-xs">
              Token (if returned by the provider) shows on the receipt after payment.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4">
          <p className="text-rowan-red text-sm">{error}</p>
        </div>
      )}

      {(exceedsWallet || belowMin || aboveMax) && (
        <div className="mt-4 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div className="text-rowan-yellow text-sm">
            {exceedsWallet && <p>Amount exceeds your available USDC</p>}
            {belowMin && <p>Minimum payment is {minFiat.toLocaleString()} {currency}</p>}
            {aboveMax && <p>Maximum payment is {maxFiat.toLocaleString()} {currency}</p>}
          </div>
        </div>
      )}

      <div className="mt-8">
        <Button onClick={handleGetQuote} loading={loading} disabled={!canProceed}>
          <Zap size={18} className="mr-2" />
          Get quote
        </Button>
      </div>

      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="text-rowan-text text-sm font-semibold mb-3">Recent bills</h2>
          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/wallet/utilities/status/${item.id}`, { state: { quote: item } })}
                className="w-full bg-rowan-surface border border-rowan-border rounded-xl p-3 text-left"
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="text-rowan-text text-sm font-medium truncate">
                    {item.bundleDescription || item.operatorName || 'Bill payment'}
                  </span>
                  <span className={`text-xs font-medium shrink-0 ${
                    item.status === 'COMPLETED' ? 'text-rowan-green'
                      : item.status === 'FAILED' ? 'text-rowan-red'
                        : 'text-rowan-muted'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-rowan-muted text-xs mt-1 tabular-nums">
                  {Number(item.fiatAmount).toLocaleString()} {item.fiatCurrency}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
