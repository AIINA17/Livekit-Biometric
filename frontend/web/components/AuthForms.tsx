// ========== components/AuthForms.tsx ==========
"use client";

import { FormEvent, useState } from "react";

interface AuthFormsProps {
    isLoggedIn: boolean;
    onLogin: (email: string, password: string) => Promise<void>;
    onLogout: () => Promise<void>;
    onSignup: (email: string, password: string) => Promise<void>;
}

export default function AuthForms({
    isLoggedIn,
    onLogin,
    onLogout,
    onSignup,
}: AuthFormsProps) {
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPassword, setSignupPassword] = useState("");

    const handleLoginSubmit = async (e: FormEvent) => {
        e.preventDefault();
        await onLogin(loginEmail, loginPassword);
    };

    const handleSignupSubmit = async (e: FormEvent) => {
        e.preventDefault();
        await onSignup(signupEmail, signupPassword);
    };

    return (
        <>
            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
                <input
                    type="email"
                    placeholder="Email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-black"
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-black"
                    required
                />
                <div className="flex gap-2.5">
                    <button
                        type="submit"
                        disabled={isLoggedIn}
                        className="flex-1 px-3 py-3 rounded-lg bg-black text-white font-semibold text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all">
                        Login
                    </button>
                    <button
                        type="button"
                        onClick={onLogout}
                        disabled={!isLoggedIn}
                        className="flex-1 px-3 py-3 rounded-lg border border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all">
                        Logout
                    </button>
                </div>
            </form>

            {/* Signup Form */}
            <form onSubmit={handleSignupSubmit} className="flex flex-col gap-3">
                <input
                    type="email"
                    placeholder="Email baru"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full px-3 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-black"
                    required
                />
                <input
                    type="password"
                    placeholder="Password (min 6 karakter)"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full px-3 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-black"
                    minLength={6}
                    required
                />
                <button
                    type="submit"
                    className="w-full px-3 py-3 rounded-lg bg-black text-white font-semibold text-sm hover:bg-gray-800 active:scale-[0.98] transition-all">
                    📝 Daftar / Signup
                </button>
            </form>
        </>
    );
}