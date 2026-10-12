import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { isPartnerHost } from './trader/host'
import SplashScreen from './SplashScreen'
import './index.css'

const CustomerRoot = lazy(() => import('./CustomerRoot'))
const PartnerApp = lazy(() => import('./trader/PartnerApp'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<SplashScreen />}>
        {isPartnerHost() ? <PartnerApp /> : <CustomerRoot />}
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
