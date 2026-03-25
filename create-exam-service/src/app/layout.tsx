import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Create exam service",
	description: "GraphQL API — шалгалт үүсгэх",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="mn">
			<body className="bg-neutral-50 antialiased text-neutral-900">
				{children}
			</body>
		</html>
	);
}
