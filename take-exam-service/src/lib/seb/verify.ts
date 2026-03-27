import { createHash } from "crypto";
import { buildSebSettings, deriveSebConfigKey } from "./config";

const CONFIG_KEY_HEADER = "x-safeexambrowser-configkeyhash";

export const MINIMUM_SEB_VERSIONS = {
	Windows: "3.0.0",
	macOS: "2.1.4",
	iOS: "2.1.14",
} as const;

export type SebPlatform = keyof typeof MINIMUM_SEB_VERSIONS;

export type SebClientDetails = {
	isDetected: boolean;
	minimumVersion: string | null;
	platform: SebPlatform | null;
	userAgent: string | null;
	version: string | null;
};

export function isSebEnforcementEnabled() {
	return process.env.SEB_ENFORCE_CONFIG_KEY === "true";
}

export function getSebSettingsPassword() {
	const password = process.env.SEB_SETTINGS_PASSWORD;
	if (!password) {
		throw new Error("SEB_SETTINGS_PASSWORD is not configured.");
	}
	return password;
}

export function deriveSebRequestConfigKeyHash(url: string, configKey: string) {
	return createHash("sha256")
		.update(`${url}${configKey}`, "utf8")
		.digest("hex");
}

function detectSebPlatform(userAgent: string): SebPlatform | null {
	if (/iphone|ipad|ipod|ios/i.test(userAgent)) {
		return "iOS";
	}

	if (/macintosh|mac os x|macos/i.test(userAgent)) {
		return "macOS";
	}

	if (/windows|win32|win64/i.test(userAgent)) {
		return "Windows";
	}

	return null;
}

function normalizeVersion(version: string) {
	return version
		.split(".")
		.map((part) => Number.parseInt(part, 10))
		.map((part) => (Number.isFinite(part) ? part : 0));
}

function compareVersions(left: string, right: string) {
	const leftParts = normalizeVersion(left);
	const rightParts = normalizeVersion(right);
	const maxLength = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < maxLength; index += 1) {
		const leftValue = leftParts[index] ?? 0;
		const rightValue = rightParts[index] ?? 0;

		if (leftValue > rightValue) {
			return 1;
		}

		if (leftValue < rightValue) {
			return -1;
		}
	}

	return 0;
}

export function getSebClientDetails(request: Request): SebClientDetails {
	const userAgent = request.headers.get("user-agent")?.trim() ?? null;
	const versionMatch = userAgent?.match(/SEB\/([0-9]+(?:\.[0-9]+){0,3})/i) ?? null;
	const platform = userAgent ? detectSebPlatform(userAgent) : null;
	const version = versionMatch?.[1] ?? null;

	return {
		isDetected: Boolean(versionMatch),
		minimumVersion: platform ? MINIMUM_SEB_VERSIONS[platform] : null,
		platform,
		userAgent,
		version,
	};
}

export function validateSebVersion(request: Request) {
	const client = getSebClientDetails(request);

	if (!client.isDetected) {
		return {
			ok: false as const,
			client,
			message: "Safe Exam Browser илрээгүй байна. Шалгалтыг SEB-ээр нээнэ үү.",
		};
	}

	if (!client.platform || !client.version || !client.minimumVersion) {
		return {
			ok: false as const,
			client,
			message:
				"Safe Exam Browser version шалгаж чадсангүй. Албан ёсны SEB client-ээр дахин нээнэ үү.",
		};
	}

	if (compareVersions(client.version, client.minimumVersion) < 0) {
		return {
			ok: false as const,
			client,
			message: `Safe Exam Browser ${client.minimumVersion}+ (${client.platform}) шаардлагатай байна.`,
		};
	}

	return {
		client,
		ok: true as const,
	};
}

export function validateSebRequest(
	request: Request,
	options?: { requireSeb?: boolean },
) {
	if (!(options?.requireSeb ?? isSebEnforcementEnabled())) {
		return { ok: true as const };
	}

	const receivedHash = request.headers.get(CONFIG_KEY_HEADER)?.trim().toLowerCase();
	if (!receivedHash) {
		return {
			ok: false as const,
			message: "Safe Exam Browser шаардлагатай байна. Шалгалтыг зөв SEB session-ээр нээнэ үү.",
		};
	}

	const requestUrl = new URL(request.url);
	requestUrl.hash = "";

	getSebSettingsPassword();
	const configKey = deriveSebConfigKey(buildSebSettings(requestUrl.origin));
	const expectedHash = deriveSebRequestConfigKeyHash(
		requestUrl.toString(),
		configKey,
	).toLowerCase();

	if (receivedHash !== expectedHash) {
		return {
			ok: false as const,
			message:
				"Safe Exam Browser session шалгалт тохирохгүй байна. Зөв SEB session-ээр дахин орно уу.",
		};
	}

	return {
		ok: true as const,
		configKey,
	};
}
