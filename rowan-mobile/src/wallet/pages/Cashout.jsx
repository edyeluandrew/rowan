import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ArrowDownToLine } from 'lucide-react'
import useRates from '../hooks/useRates'
import useWallet from '../hooks/useWallet'
import { getQuote } from '../api/cashout'
import { hashPhoneNumber } from '../utils/crypto'
import { MIN_XLM_AMOUNT, NETWORKS, COUNTRY_CODES } from '../utils/constants'
import AmountInput from '../components/cashout/AmountInput'
import NetworkSelector from '../components/cashout/NetworkSelector'
import PhoneInput from '../components/cashout/PhoneInput'
import Button from '../components/ui/Button'

export default function Cashout() {
  const navigate = useNavigate()
  const { rates, allRates } = useRates()
  const { balance } = useWallet()
  const [amount, setAmount] = useState('')
  const [network, setNetwork] = useState(null)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const xlmAmount = parseFloat(amount) || 0
  // allRates may be array [{network, rate, fee}] or object {NETWORK_KEY: rate}
  const selectedRate = network && allRates
    ? Array.isArray(allRates)
      ? allRates.find((r) => r.network === network)
      : allRates[network] != null
        ? { rate: allRates[network], fee: 0 }
        : null
    : null
  const rateValue = selectedRate?.rate || 0
  const currency = network ? NETWORKS[network]?.currency : null
  const feeXlm = selectedRate?.fee || 0
  const fiatAmount = xlmAmount && rateValue ? xlmAmount * rateValue : 0
  const fiatFee = feeXlm * rateValue
  const netFiat = fiatAmount - fiatFee
  const maxAmount = balance || 0

  const canProceed =
    xlmAmount >= MIN_XLM_AMOUNT &&
    xlmAmount <= maxAmount &&
    network &&
    phone.length >= 7

  const handleGetQuote = async () => {
    if (!canProceed) return
    setLoading(true)
    setError(null)
    try {
      const networkConfig = NETWORKS[network]
      const derivedCountryCode = networkConfig
        ? COUNTRY_CODES[networkConfig.country]?.code || '+256'
        : '+256'
      const cleanPhone = phone.replace(/\D/g, '')
      const fullPhone = `${derivedCountryCode}${cleanPhone}`
      const phoneHash = await hashPhoneNumber(fullPhone)
      const quote = await getQuote({ xlmAmount, network, phoneHash })
      navigate('/wallet/cashout/confirm', { state: { quote, network, phone: fullPhone } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Cash Out</h1>
      </div>

      <AmountInput
        xlmAmount={amount}
        onAmountChange={setAmount}
        fiatAmount={netFiat}
        currency={currency}
        rate={rateValue}
        fee={feeXlm}
        netFiat={netFiat}
      />

      <div className="mt-6">
        <NetworkSelector selected={network} onSelect={setNetwork} />
      </div>

      <div className="mt-6">
        <PhoneInput
          phone={phone}
          onPhoneChange={setPhone}
          network={network}
        />
      </div>

      {error && <p className="text-rowan-red text-sm mt-4">{error}</p>}

      <div className="mt-8">
        <Button onClick={handleGetQuote} loading={loading} disabled={!canProceed}>
          <ArrowDownToLine size={18} className="mr-2" />
          Get Quote
        </Button>
      </div>
    </div>
  )
}
