// components/AuthModal.tsx
'use client';

import { FormEvent, useState } from 'react';

interface AuthModalProps {
  mode: 'login' | 'signup';
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string) => Promise<void>;
  onSwitchMode: () => void;
}

export default function AuthModal({
  mode,
  onClose,
  onLogin,
  onSignup,
  onSwitchMode,
}: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onSignup(email, password);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
      onClick={onClose}
    >
      {/* Modal Card */}
      <div 
        className="w-full max-w-md mx-4 p-8 rounded-2xl bg-[var(--bg-card)] 
                   shadow-2xl animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div className="space-y-2">
            <label className="block text-sm text-[var(--text-secondary)]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-4 rounded-xl bg-[var(--input-bg)] 
                         text-[var(--text-primary)] text-base
                         placeholder:text-[var(--text-white-50)]
                         border-none outline-none
                         focus:ring-2 focus:ring-[var(--accent-primary)]/50"
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="block text-sm text-[var(--text-secondary)]">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-4 pr-12 rounded-xl bg-[var(--input-bg)] 
                           text-[var(--text-primary)] text-base
                           placeholder:text-[var(--text-white-50)]
                           border-none outline-none
                           focus:ring-2 focus:ring-[var(--accent-primary)]/50"
              />
              {/* Toggle Password Visibility */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 
                           text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Switch Mode Link */}
          <div className="text-center text-sm">
            <span className="text-[var(--text-secondary)]">
              {mode === 'login' ? "Don't have an account yet? " : "Already have an account? "}
            </span>
            <button
              type="button"
              onClick={onSwitchMode}
              className="text-[var(--accent-link)] hover:underline font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-4 rounded-full bg-[var(--accent-primary)] 
                       text-white font-semibold text-base
                       hover:brightness-110 active:scale-[0.98]
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all"
          >
            {isLoading ? 'Loading...' : mode === 'login' ? 'Login' : 'Sign up'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ============================================
   ICONS
   ============================================ */

function EyeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/* ============================================
   CARA GANTI STYLE AUTH MODAL:
   ============================================
   
   1. Modal Background:
      - Sekarang: bg-[var(--bg-card)] (#30302E)
      - Ganti di globals.css: --bg-card: #30302E;
   
   2. Input Background:
      - Sekarang: bg-[var(--input-bg)] (#5C5C5C)
   
   3. Button Color (Orange):
      - Sekarang: bg-[var(--accent-primary)] (#D97757)
   
   4. Link Color (Blue):
      - Sekarang: text-[var(--accent-link)] (#4598C5)
      - Ganti di globals.css: --accent-link: #4598C5;
   
   5. Backdrop Blur:
      - Defined di globals.css: .modal-backdrop
      - Background: rgba(0, 0, 0, 0.7)
      - Blur: backdrop-filter: blur(8px)
   
   6. Rounded Corners:
      - Modal: rounded-2xl
      - Input: rounded-xl
      - Button: rounded-full (pill)
*/