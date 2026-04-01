/**
 * Pagination component
 */
export const Pagination = ({ current, total, onPageChange }) => {
  if (total <= 1) return null

  return (
    <div className="flex justify-center gap-2 p-4">
      {Array.from({length: total}, (_, i) => i + 1).map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`px-3 py-1 rounded ${
            p === current
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

export default Pagination
