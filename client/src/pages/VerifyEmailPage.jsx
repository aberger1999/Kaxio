import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle2, AlertTriangle } from 'lucide-react';
import { authApi } from '../api/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function VerifyEmailPage() {
  const { token: tokenParam } = useParams();
  const [searchParams] = useSearchParams();
  const token = tokenParam || searchParams.get('token') || '';
  const presetEmail = searchParams.get('email') || '';

  const [verifyState, setVerifyState] = useState(token ? 'verifying' : 'idle');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [email, setEmail] = useState(presetEmail);
  const [resendError, setResendError] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setVerifyState('idle');
      return () => { cancelled = true; };
    }

    setVerifyState('verifying');
    setVerifyMessage('');
    authApi.verifyEmail(token)
      .then((res) => {
        if (cancelled) return;
        setVerifyState('success');
        setVerifyMessage(res?.message || 'Email verified successfully. You can now sign in.');
      })
      .catch((err) => {
        if (cancelled) return;
        setVerifyState('error');
        setVerifyMessage(err?.message || 'Invalid or expired verification link.');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const canResend = useMemo(() => EMAIL_RE.test(email.trim()), [email]);

  async function handleResend(ev) {
    ev.preventDefault();
    setResendError('');
    setResendSuccess('');
    if (!canResend) {
      setResendError('Enter a valid email address.');
      return;
    }

    setResendLoading(true);
    try {
      const res = await authApi.resendVerification(email.trim().toLowerCase());
      setResendSuccess(
        res?.message || 'If your account is pending verification, we sent a new verification email.',
      );
    } catch (err) {
      setResendError(err?.message || 'Unable to send verification email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-violet-50/30 dark:from-slate-950 dark:to-violet-950/20 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-bold text-2xl mb-4">
            Q
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Verify your email
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Complete verification to access your account
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/30 border border-gray-200 dark:border-slate-800 p-8 space-y-5">
          {verifyState === 'verifying' && (
            <div className="text-sm text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-3">
              Verifying your email...
            </div>
          )}

          {verifyState === 'success' && (
            <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <span>{verifyMessage}</span>
              </div>
            </div>
          )}

          {verifyState === 'error' && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{verifyMessage || 'Invalid or expired verification link.'}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleResend} noValidate>
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
                  resendError
                    ? 'border-red-400 dark:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800'
                    : 'border-gray-300 dark:border-slate-700 focus:border-primary focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900'
                }`}
              />
            </div>
            {resendError && (
              <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{resendError}</p>
            )}
            {resendSuccess && (
              <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">{resendSuccess}</p>
            )}

            <button
              type="submit"
              disabled={resendLoading || !canResend}
              className="w-full mt-4 py-2.5 rounded-lg btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendLoading ? 'Sending...' : 'Resend verification email'}
            </button>
          </form>

          <Link
            to="/login"
            className="block text-center text-sm text-primary dark:text-indigo-400 font-medium hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
