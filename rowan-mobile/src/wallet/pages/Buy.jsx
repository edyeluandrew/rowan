import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Coins, UserCheck } from 'lucide-react'
import useActiveTransaction from '../hooks/useActiveTransaction'
import useUserCountry from '../hooks/useUserCountry'
import { getBuyQuote } from '../api/buy'
import { hashPhoneNumber } from '../utils/crypto'
import { NETWORKS } from '../utils/constants'
import { getNetworksForCountry } from '../utils/country'
import AmountInput from '../components/cashout/AmountInput'
import NetworkSelector from '../components/cashout/NetworkSelector'
import Button from '../components/ui/Button'

export default function Buy() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    selectedAd,
    payoutSettingId: presetPayoutSettingId,
    traderName: presetTraderName,
    network: presetNetwork,
  } = location.state || {}

  const { country, fiatCurrency: userFiat } = useUserCountry()
  const { activeTransaction, loading: activeLoading } = useActiveTransaction()
  const [fiatAmount, setFiatAmount] = useState('')
  const [network, setNetwork] = useState(presetNetwork || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const payoutSettingId = presetPayoutSettingId || selectedAd?.payoutSettingId || selectedAd?.id

  useEffect(() => {
    if (!payoutSettingId) {
      navigate('/wallet/marketplace', { replace: true, state: { tab: 'buy' } })
    }
  }, [payoutSettingId, navigate])

  useEffect(() => {
    if (!activeLoading && activeTransaction?.id) {
      navigate(`/wallet/transaction/${activeTransaction.id}`, { replace: true })
    }
  }, [activeLoading, activeTransaction, navigate])

  const countryNetworks = useMemo(
    () => Object.keys(getNetworksForCountry(country)),
    [country]
  )

  const netFiat = parseFloat(fiatAmount) || 0
  const currency = network ? NETWORKS[network]?.currency : userFiat
  const minNetFiat = selectedAd?.minAmount ?? null
  const maxNetFiat = selectedAd?.maxAmount ?? null
  const belowMin = minNetFiat != null && netFiat > 0 && netFiat < minNetFiat
  const exceedsMax = maxNetFiat != null && netFiat > maxNetFiat

  const canProceed =
    payoutSettingId &&
    network &&
    netFiat > 0 &&
    !belowMin &&
    !exceedsMax &&
    !loading

  const handleGetQuote = async () => {
    if (!canProceed) return
    setLoading(true)
    setError(null)
    try {
      const phoneHash = await hashPhoneNumber('buy-placeholder')
      const quote = await getBuyQuote({
        fiatAmount: netFiat,
        network,
        phoneHash,
        payoutSettingId,
      })
      navigate('/wallet/buy/confirm', {
        state: {
          quote: {
            ...quote,
            fiatCurrency: quote.fiatCurrency || currency,
          },
          network,
          traderName: presetTraderName || selectedAd?.traderName,
          selectedAd: selectedAd,
        },
      })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not get quote')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Buy USDC</h1>
      </div>

      {(presetTraderName || selectedAd?.traderName) && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4 flex items-start gap-3">
          <UserCheck size={20} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-rowan-text text-sm font-semibold">Trader</p>
            <p className="text-rowan-muted text-sm">{presetTraderName || selectedAd?.traderName}</p>
          </div>
        </div>
      )}

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4 flex items-start gap-3">
        <Coins size={20} className="text-rowan-yellow shrink-0 mt-0.5" />
        <p className="text-rowan-muted text-sm">
          Enter how much mobile money you will send. You receive USDC in your wallet after the trader confirms payment.
        </p>
      </div>

      <NetworkSelector
        networks={countryNetworks}
        value={network}
        onChange={setNetwork}
        disabled={!!presetNetwork}
      />

      <div className="mt-4">
        <AmountInput
          label={`Amount to pay (${currency})`}
          value={fiatAmount}
          onChange={setFiatAmount}
          currency={currency}
        />
        {minNetFiat != null && maxNetFiat != null && (
          <p className="text-rowan-muted text-xs mt-2">
            Trader limits: {minNetFiat.toLocaleString()} – {maxNetFiat.toLocaleString()} {currency}
          </p>
        )}
        {belowMin && <p className="text-rowan-red text-xs mt-2">Amount below trader minimum</p>}
        {exceedsMax && <p className="text-rowan-red text-xs mt-2">Amount above trader maximum</p>}
      </div>

      {error && (
        <p className="text-rowan-red text-sm mt-4">{error}</p>
      )}

      <Button className="w-full mt-8" disabled={!canProceed} loading={loading} onClick={handleGetQuote}>
        Get Quote
      </Button>
    </div>
  )
}
