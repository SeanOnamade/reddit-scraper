import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Readit - Reddit Research Tool",
    description: "AI-powered Reddit research and analysis",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}
