import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, pages, onPageChange }) {
  if (pages <= 1) return null

  const getPageNumbers = () => {
    const nums = []
    const delta = 2
    const start = Math.max(2, page - delta)
    const end = Math.min(pages - 1, page + delta)

    nums.push(1)
    if (start > 2) nums.push('...')
    for (let i = start; i <= end; i++) nums.push(i)
    if (end < pages - 1) nums.push('...')
    if (pages > 1) nums.push(pages)

    return nums
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-2 text-rowan-muted hover:text-rowan-text disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={16} />
      </button>
      {getPageNumbers().map((num, idx) =>
        num === '...' ? (
          <span key={`dots-${idx}`} className="px-2 text-rowan-muted text-sm">...</span>
        ) : (
          <button
            key={num}
            onClick={() => onPageChange(num)}
            className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
              num === page
                ? 'bg-rowan-yellow text-rowan-bg'
                : 'text-rowan-muted hover:text-rowan-text hover:bg-rowan-border/30'
            }`}
          >
            {num}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        className="p-2 text-rowan-muted hover:text-rowan-text disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
