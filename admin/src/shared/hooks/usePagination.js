/**
 * Standardized pagination helper functions
 * Provides consistent pagination logic across all list views
 */

export const PAGINATION_DEFAULTS = {
  perPage: 20,
  maxPages: 100,
}

/**
 * Calculate max pages that can be shown in pagination UI
 */
export const getMaxDisplayPages = (totalPages, maxDisplay = 7) => {
  return Math.min(totalPages, maxDisplay)
}

/**
 * Generate array of page numbers for pagination display
 * Shows pages around current page
 */
export const getPaginationRange = (currentPage, totalPages, windowSize = 5) => {
  const startPage = Math.max(1, currentPage - Math.floor(windowSize / 2))
  const endPage = Math.min(totalPages, startPage + windowSize - 1)
  const adjustedStart = Math.max(1, endPage - windowSize + 1)

  return Array.from(
    { length: Math.min(endPage - adjustedStart + 1, windowSize) },
    (_, i) => adjustedStart + i
  )
}

/**
 * Check if pagination should be shown
 */
export const shouldShowPagination = (total, perPage) => {
  return total > perPage
}

/**
 * Get human-readable page info: "Showing 1-20 of 100"
 */
export const getPageInfo = (page, perPage, total) => {
  const start = (page - 1) * perPage + 1
  const end = Math.min(page * perPage, total)
  return `Showing ${start}-${end} of ${total}`
}
