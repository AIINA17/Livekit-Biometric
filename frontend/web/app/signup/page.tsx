"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthCard from "@/components/AuthCard";

export default function SignupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (session) {
                router.replace("/");
            } else {
                setIsLoading(false);
            }
        };

        checkSession();
    }, [router]);

    const handleLogin = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            alert(error.message);
            return;
        }

        if (data.session) {
            router.replace("/");
        }
    };

    const handleSignup = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            alert("Signup gagal: " + error.message);
            return;
        }

        if (!data.session) {
            alert("Cek email kamu untuk verifikasi akun");
            return;
        }

        router.replace("/");
    };

    if (isLoading) {
        return (
            <main className="h-screen bg-(--bg-primary) flex items-center justify-center">
                <div className="text-(--text-secondary)">Loading...</div>
            </main>
        );
    }

    return (
        <main className="h-screen bg-(--bg-primary) flex items-center justify-center p-4">
            <AuthCard
                onLogin={handleLogin}
                onSignup={handleSignup}
                initialMode="signup"
                onSwitchModeRoute={() => router.push("/login")}
            />
        </main>
    );
}
