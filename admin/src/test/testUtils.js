/**
 * Test utilities and helpers
 */

import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

export const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

export const mockApiResponse = (data, delay = 0) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay)
  })
}

export const mockApiError = (message = 'API Error', delay = 0) => {
  return new Promise((_, reject) => {
    setTimeout(
      () =>
        reject(new Error(message)),
      delay
    )
  })
}
