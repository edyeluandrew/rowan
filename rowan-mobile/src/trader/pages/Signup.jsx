import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signupTrader } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const data = await signupTrader(name, email, password);
      await login(data.token, data.trader);
      navigate('/trader/home', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-rowan-bg min-h-screen flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-rowan-yellow text-3xl font-bold tracking-widest">ROWAN</h1>
        <p className="text-rowan-muted text-xs mt-1">OTC Trader Dashboard</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Name */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name"
          autoComplete="name"
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded px-4 py-3.5 w-full text-base focus:outline-none focus:border-rowan-yellow transition-colors mb-3 placeholder-rowan-muted"
        />

        {/* Email */}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded px-4 py-3.5 w-full text-base focus:outline-none focus:border-rowan-yellow transition-colors mb-3 placeholder-rowan-muted"
        />

        {/* Password */}
        <div className="relative mb-5">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)"
            autoComplete="new-password"
            className="bg-rowan-surface border border-rowan-border text-rowan-text rounded px-4 py-3.5 w-full text-base focus:outline-none focus:border-rowan-yellow transition-colors pr-14 placeholder-rowan-muted"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-rowan-muted text-xs"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded bg-rowan-yellow text-rowan-bg font-bold text-base transition-opacity disabled:opacity-50"
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <p className="text-rowan-muted text-sm mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-rowan-yellow font-medium">
          Sign In
        </Link>
      </p>

      <p className="text-rowan-muted/40 text-[10px] mt-8">
        v{import.meta.env.VITE_APP_VERSION || '1.0.0'} MVP
      </p>
    </div>
  );
}
