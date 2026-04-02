import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
	/* config options here */
};

if (process.env.NODE_ENV === "development") {
	// Enable calling `getCloudflareContext()` in `next dev`.
	// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
	initOpenNextCloudflareForDev();
}

export default nextConfig;
