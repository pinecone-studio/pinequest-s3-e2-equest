import type { BackendHealthResponse } from "@shared/contracts/backend";

export type BackendConnectionState =
	| {
			ok: true;
			baseUrl: string;
			data: BackendHealthResponse;
	  }
	| {
			ok: false;
			baseUrl: string | null;
			reason: string;
	  };

const normalizeUrl = (value: string) => value.replace(/\/+$/, "");

export async function getBackendHealth(): Promise<BackendConnectionState> {
	const baseUrl = process.env.BACKEND_BASE_URL?.trim();

	if (!baseUrl) {
		return {
			ok: false,
			baseUrl: null,
			reason: "BACKEND_BASE_URL is missing.",
		};
	}

	try {
		const response = await fetch(`${normalizeUrl(baseUrl)}/api/health`, {
			cache: "no-store",
		});

		if (!response.ok) {
			return {
				ok: false,
				baseUrl,
				reason: `Backend returned ${response.status} ${response.statusText}.`,
			};
		}

		const data = (await response.json()) as BackendHealthResponse;

		return {
			ok: true,
			baseUrl,
			data,
		};
	} catch (error) {
		return {
			ok: false,
			baseUrl,
			reason: error instanceof Error ? error.message : "Unknown network error.",
		};
	}
}
