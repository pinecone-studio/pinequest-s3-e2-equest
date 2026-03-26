import { createHash } from "crypto";
import { buildSebSettings, deriveSebConfigKey } from "./config";

const CONFIG_KEY_HEADER = "x-safeexambrowser-configkeyhash";

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

export function validateSebRequest(request: Request) {
	if (!isSebEnforcementEnabled()) {
		return { ok: true as const };
	}

	const receivedHash = request.headers.get(CONFIG_KEY_HEADER)?.trim().toLowerCase();
	if (!receivedHash) {
		return {
			ok: false as const,
			message:
				"Safe Exam Browser шаардлагатай байна. /api/seb/config файлыг ашиглан шалгалтыг нээнэ үү.",
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
				"Safe Exam Browser Config Key тохирохгүй байна. Шинэ .seb config татаж аваад дахин орно уу.",
		};
	}

	return {
		ok: true as const,
		configKey,
	};
}
