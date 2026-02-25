// Root layout for the Next.js app, configuring fonts and global styles.

import type { Metadata } from "next";
import { Outfit, Space_Grotesk } from "next/font/google";

import "./globals.css";

const outfit = Outfit({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"],
    variable: "--font-outfit",
});

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-space",
});

export const metadata: Metadata = {
    title: "Happy - Voice Shopping Assistant",
    description: "Your personal voice-powered shopping assistant",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html
            lang="id"
            className={`${outfit.variable} ${spaceGrotesk.variable}`}>
            <body className="font-outfit">{children}</body>
        </html>
    );
}
