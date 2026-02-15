// components/AuthModal.tsx
"use client";

import { FormEvent, useState } from "react";
import { IoEye, IoEyeOff } from "react-icons/io5";

interface AuthModalProps {
    mode: "login" | "signup";
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
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (mode === "login") {
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
            onClick={onClose}>
            {/* Modal Card */}
            <div
                className="w-full max-w-md mx-4 p-8 rounded-2xl bg-(--bg-card) shadow-2xl animate-fadeIn"
                onClick={(e) => e.stopPropagation()}>
                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email Field */}
                    <div className="space-y-2">
                        <label className="block text-sm text-(--text-secondary)">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className="w-full px-4 py-4 rounded-xl bg-(--input-bg) 
                                      text-(--text-primary) text-base
                                      placeholder:text-(--text-white-50)
                                      border-none outline-none
                                      focus:ring-2 focus:ring-(--accent-primary)/50"
                        />
                    </div>

                    {/* Password Field */}
                    <div className="space-y-2">
                        <label className="block text-sm text-(--text-secondary)">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                className="w-full px-4 py-4 pr-12 rounded-xl bg-(--input-bg) 
                                          text-(--text-primary) text-base
                                          placeholder:text-(--text-white-50)
                                          border-none outline-none
                                          focus:ring-2 focus:ring-(--accent-primary)/50"
                            />
                            {/* Toggle Password Visibility */}
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 
                                          text-(--text-secondary) hover:text-(--text-primary)">
                                {showPassword ? <IoEyeOff /> : <IoEye />}
                            </button>
                        </div>
                    </div>

                    {/* Switch Mode Link */}
                    <div className="text-center text-sm">
                        <span className="text-(--text-secondary)">
                            {mode === "login"
                                ? "Don't have an account yet? "
                                : "Already have an account? "}
                        </span>
                        <button
                            type="button"
                            onClick={onSwitchMode}
                            className="text-(--accent-link) hover:underline font-medium">
                            {mode === "login" ? "Sign up" : "Sign in"}
                        </button>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full px-6 py-4 rounded-full bg-(--accent-primary) 
                                text-white font-semibold text-base
                                hover:brightness-110 active:scale-[0.98]
                                disabled:opacity-50 disabled:cursor-not-allowed
                                transition-all">
                        {isLoading
                            ? "Loading..."
                            : mode === "login"
                              ? "Login"
                              : "Sign up"}
                    </button>
                </form>
            </div>
        </div>
    );
}
