/**
 * Loading Spinner component
 */
export const LoadingSpinner = ({ size = 'md', message = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center p-8">
    <div className={`rounded-full border-4 border-rowan-border border-t-rowan-yellow animate-spin ${
      size === 'sm' ? 'w-6 h-6' :
      size === 'lg' ? 'w-12 h-12' :
      'w-8 h-8'
    }`} />
    {message && <p className="mt-3 text-gray-600">{message}</p>}
  </div>
)

export default LoadingSpinner
