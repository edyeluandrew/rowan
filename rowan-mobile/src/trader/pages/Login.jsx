import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/trader/home', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 bg-rowan-bg">
      {/* Logo */}
      <h1 className="text-rowan-yellow text-4xl font-bold tracking-widest">ROWAN</h1>
      <p className="text-rowan-muted text-sm mt-2">OTC Trader Portal</p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-12 w-full max-w-sm">
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-rowan-surface border border-rowan-border text-rowan-text rounded px-4 py-3.5 w-full text-base focus:outline-none focus:border-rowan-yellow transition-colors mb-3 placeholder-rowan-muted"
        />

        <div className="relative mb-4">
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-rowan-surface border border-rowan-border text-rowan-text rounded px-4 py-3.5 w-full text-base focus:outline-none focus:border-rowan-yellow transition-colors pr-14 placeholder-rowan-muted"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-rowan-muted text-xs select-none"
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>

        <Button type="submit" variant="primary" size="lg" loading={loading}>
          Sign In
        </Button>

        {error && <p className="text-rowan-red text-sm mt-3 text-center">{error}</p>}

        <Link to="/forgot-password" className="block text-center text-rowan-muted text-xs mt-3 hover:text-rowan-yellow transition-colors">
          Forgot Password?
        </Link>
      </form>

      <p className="text-rowan-muted text-sm mt-6">
        Don't have an account?{' '}
        <Link to="/signup" className="text-rowan-yellow font-medium">Sign Up</Link>
      </p>

      <p className="text-rowan-muted text-xs absolute bottom-6">v1.0.0 MVP</p>
    </div>
  );
}
