import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ApolloAppProvider } from "@/lib/apollo/provider";
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Take Exam Service",
	description: "Student exam portal",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body className={`${inter.variable} antialiased`}>
				<ApolloAppProvider>{children}</ApolloAppProvider>
			</body>
		</html>
	);
}
