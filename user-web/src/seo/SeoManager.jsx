/**
 * Lightweight head manager for SPA routes (public site at https://rowanpay.app).
 * Homepage metadata lives in index.html for crawlers; this adjusts private routes.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { NOINDEX_PATH_PREFIXES, SITE_URL, DEFAULT_TITLE, LEGAL_PAGES } from './site'

function pathShouldNoIndex(pathname) {
  return NOINDEX_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function upsertMeta(attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export default function SeoManager() {
  const { pathname } = useLocation()

  useEffect(() => {
    const isPrivate = pathShouldNoIndex(pathname) || pathname === '/404'
    const isHome = pathname === '/'

    if (isPrivate) {
      document.title = isHome ? DEFAULT_TITLE : `Rowan`
      upsertMeta('name', 'robots', 'noindex, nofollow')
      return undefined
    }

    if (isHome) {
      document.title = DEFAULT_TITLE
      upsertMeta('name', 'robots', 'index, follow, max-image-preview:large')
      upsertLink('canonical', `${SITE_URL}/`)
      return undefined
    }

    const legal = LEGAL_PAGES[pathname]
    if (legal) {
      document.title = legal.title
      upsertMeta('name', 'robots', 'index, follow')
      upsertMeta('name', 'description', legal.description)
      upsertLink('canonical', `${SITE_URL}${pathname}`)
      return undefined
    }

    // Unknown public paths (e.g. 404) — do not index
    upsertMeta('name', 'robots', 'noindex, follow')
    return undefined
  }, [pathname])

  return null
}
