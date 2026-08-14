/**
 * Public-site SEO constants for https://rowanpay.app
 * Wallet/app routes are intentionally excluded from indexing.
 */

export const SITE_URL = 'https://rowanpay.app'
export const SITE_NAME = 'Rowan'

export const DEFAULT_TITLE = 'Rowan | Mobile Money & Digital Asset Infrastructure'
export const DEFAULT_DESCRIPTION =
  'Send and receive USDC, cash out to mobile money, and pay airtime, data, and bills. All in one Rowan wallet.'

export const OG_IMAGE_PATH = '/og-image.png'
export const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`

/** Routes search engines should not index (auth + wallet app). */
export const NOINDEX_PATH_PREFIXES = [
  '/wallet',
  '/wallet-setup',
  '/create-wallet',
  '/backup-wallet',
  '/import-wallet',
  '/register',
  '/wallet-2fa-verify',
]

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/rowan-mark-512.png`,
    description: DEFAULT_DESCRIPTION,
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  }
}
