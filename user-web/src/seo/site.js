/**
 * Public-site SEO constants for https://rowanpay.app
 * Wallet/app routes are intentionally excluded from indexing.
 */

export const SITE_URL = 'https://rowanpay.app'
export const SITE_NAME = 'Rowan Pay'

export const DEFAULT_TITLE = 'Rowan Pay - Send, receive, and spend USDC on bills'
export const DEFAULT_DESCRIPTION =
  'Rowan Pay is the wallet for buying and selling USDC with local traders, and paying airtime, data, and bills.'

export const OG_IMAGE_PATH = '/og-share.png'
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

export const LEGAL_PAGES = {
  '/legal/terms': {
    title: 'Terms of Service | Rowan',
    description: 'Rowan user terms for the wallet, P2P buy and sell, and utility payments.',
  },
  '/legal/privacy': {
    title: 'Privacy Policy | Rowan',
    description: 'How Rowan collects, uses, and shares personal data.',
  },
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    alternateName: 'Rowan',
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
