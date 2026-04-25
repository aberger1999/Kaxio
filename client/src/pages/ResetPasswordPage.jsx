import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api/client';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const resetToken = token || searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate() {
    const e = {};
    if (!password) e.password = 'Password is required.';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters.';
    if (!confirm) e.confirm = 'Please confirm your password.';
    else if (password && confirm !== password) e.confirm = 'Passwords do not match.';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    setServerError('');
    if (!resetToken) {
      setServerError('This reset link is invalid or missing a token.');
      return;
    }
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;

    setLoading(true);
    try {
      await authApi.resetPassword(resetToken, password);
      setSuccess(true);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Invalid or expired')) {
        setServerError('Invalid or expired reset link.');
      } else {
        setServerError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass = (field) =>
    `w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors ${
      errors[field]
        ? 'border-red-400 dark:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800'
        : 'border-gray-300 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900'
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-violet-50/30 dark:from-slate-950 dark:to-violet-950/20 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-bold text-2xl mb-4">
            Q
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Kaxio
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Set a new password
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/30 border border-gray-200 dark:border-slate-800 p-8">
          {success ? (
            <>
              <div className="mb-5 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                Password reset successfully!
              </div>
              <Link
                to="/login"
                className="block w-full py-2.5 rounded-lg btn-gradient text-center"
              >
                Sign in
              </Link>
            </>
          ) : serverError && serverError.includes('expired') ? (
            <>
              <div className="mb-5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                {serverError}
              </div>
              <Link
                to="/forgot-password"
                className="block text-center text-sm text-primary dark:text-indigo-400 font-medium hover:underline"
              >
                Request a new reset link
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {!resetToken && (
                <div className="mb-5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                  This reset link is missing a token. Request a new one below.
                </div>
              )}
              {serverError && (
                <div className="mb-5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                  {serverError}
                </div>
              )}

              {/* Password */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  New Password
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
                    placeholder="At least 6 characters"
                    className={inputClass('password')}
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

              {/* Confirm Password */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
                  />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    className={inputClass('confirm')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirm && (
                  <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.confirm}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !resetToken}
                className="w-full py-2.5 rounded-lg btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>

              {/* Back to login */}
              <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-6">
                <Link
                  to="/login"
                  className="text-primary dark:text-indigo-400 font-medium hover:underline"
                >
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
