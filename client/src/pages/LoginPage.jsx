import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');

  function validate() {
    const e = {};
    if (!email.trim()) e.email = 'Email is required.';
    else if (!EMAIL_RE.test(email)) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Password is required.';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setServerError('');
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;

    const result = await login(email, password);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-violet-50/30 dark:from-slate-950 dark:to-violet-950/20 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="mb-5 flex justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-indigo-400 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to home
            </Link>
          </div>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-bold text-2xl mb-4">
            Q
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Kaxio
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/30 border border-gray-200 dark:border-slate-800 p-8"
        >
          {serverError && (
            <div className="mb-5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              <p>{serverError}</p>
              {serverError.toLowerCase().includes('verify your email') && (
                <Link
                  to={`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                  className="inline-block mt-2 text-primary dark:text-indigo-400 font-medium hover:underline"
                >
                  Resend verification email
                </Link>
              )}
            </div>
          )}

          {/* Email */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors ${
                  errors.email
                    ? 'border-red-400 dark:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800'
                    : 'border-gray-300 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900'
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={`w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors ${
                  errors.password
                    ? 'border-red-400 dark:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800'
                    : 'border-gray-300 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Forgot password */}
          <div className="flex justify-end mb-4">
            <Link
              to="/forgot-password"
              className="text-sm text-primary dark:text-indigo-400 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg btn-gradient"
          >
            Sign In
          </button>

          {/* Register link */}
          <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="text-primary dark:text-indigo-400 font-medium hover:underline"
            >
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
