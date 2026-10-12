/**
 * Trader site for partners.rowanpay.app.
 * No customer wallet session, biometric lock, or wallet routes.
 */
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import SeoManager from '../seo/SeoManager'
import LegalDoc from '../pages/LegalDoc'
import SplashScreen from '../SplashScreen'

const TraderWeb = lazy(() => import('./TraderWeb'))

export default function PartnerApp() {
  return (
    <>
      <SeoManager />
      <Routes>
        <Route path="/legal/:doc" element={<LegalDoc />} />
        <Route
          path="/trader/*"
          element={
            <Suspense fallback={<SplashScreen />}>
              <TraderWeb />
            </Suspense>
          }
        />
        <Route path="/login" element={<Navigate to="/trader" replace />} />
        <Route path="*" element={<Navigate to="/trader" replace />} />
      </Routes>
    </>
  )
}
