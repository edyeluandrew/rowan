import LoadingSpinner from './LoadingSpinner';

const variants = {
  primary: 'bg-rowan-yellow text-rowan-bg font-bold',
  ghost:   'bg-transparent border border-current',
  danger:  'bg-rowan-red text-white font-bold',
};

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-14 px-6 text-lg',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = true,
  onClick,
  children,
  className = '',
  ...rest
}) {
  const base = 'rounded flex items-center justify-center gap-2 transition-opacity select-none';
  const w = fullWidth ? 'w-full' : '';
  const dis = (loading || disabled) ? 'opacity-70 pointer-events-none' : '';

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${w} ${dis} ${className}`}
      {...rest}
    >
      {loading && <LoadingSpinner size={18} />}
      {children}
    </button>
  );
}
