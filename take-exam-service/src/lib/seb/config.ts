import { createCipheriv, createHash, createHmac, pbkdf2Sync, randomBytes } from "crypto";
import { gzipSync } from "zlib";

export const SEB_SUCCESS_PATH = "/seb/success";

export type SebSettingsValue =
	| boolean
	| number
	| string
	| SebSettingsValue[]
	| { [key: string]: SebSettingsValue }
	| null;

export type SebSettings = Record<string, SebSettingsValue>;

type ColumnlessSebRule = {
	action: number;
	active: boolean;
	expression: string;
	regex: boolean;
};

type SebProcessRule = {
	active: boolean;
	currentUser?: boolean;
	description: string;
	executable?: string;
	identifier?: string;
	os: 0 | 1;
};

const PBKDF2_ITERATIONS = 10_000;
const RNCRYPTOR_VERSION = 0x03;
const RNCRYPTOR_OPTIONS_PASSWORD = 0x01;
const BLOCK_SIZE = 16;

function escapeXml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function serializePlistValue(value: SebSettingsValue): string {
	if (typeof value === "string") {
		return `<string>${escapeXml(value)}</string>`;
	}

	if (typeof value === "number") {
		return Number.isInteger(value)
			? `<integer>${value}</integer>`
			: `<real>${value}</real>`;
	}

	if (typeof value === "boolean") {
		return value ? "<true/>" : "<false/>";
	}

	if (value === null) {
		return "<string></string>";
	}

	if (Array.isArray(value)) {
		return `<array>${value.map(serializePlistValue).join("")}</array>`;
	}

	return `<dict>${Object.entries(value)
		.map(
			([key, nested]) =>
				`<key>${escapeXml(key)}</key>${serializePlistValue(nested)}`,
		)
		.join("")}</dict>`;
}

export function serializeSebSettingsPlist(settings: SebSettings) {
	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">${serializePlistValue(settings)}</plist>`;
}

function normalizeForConfigKey(value: SebSettingsValue): SebSettingsValue | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		value === null
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value
			.map((entry) => normalizeForConfigKey(entry))
			.filter((entry) => entry !== undefined) as SebSettingsValue[];
	}

	const normalizedEntries = Object.entries(value)
		.filter(([key]) => key !== "originatorVersion")
		.map(([key, nested]) => [key, normalizeForConfigKey(nested)] as const)
		.filter(([, nested]) => nested !== undefined)
		.sort(([left], [right]) => left.localeCompare(right));

	if (normalizedEntries.length === 0) {
		return undefined;
	}

	return Object.fromEntries(normalizedEntries) as {
		[key: string]: SebSettingsValue;
	};
}

function canonicalizeConfigValue(value: SebSettingsValue): string {
	if (typeof value === "string") {
		return JSON.stringify(value);
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return JSON.stringify(value);
	}

	if (value === null) {
		return "null";
	}

	if (Array.isArray(value)) {
		return `[${value.map(canonicalizeConfigValue).join(",")}]`;
	}

	return `{${Object.entries(value)
		.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalizeConfigValue(nested)}`)
		.join(",")}}`;
}

export function deriveSebConfigKey(settings: SebSettings) {
	const normalized = normalizeForConfigKey(settings) ?? {};
	return createHash("sha256")
		.update(canonicalizeConfigValue(normalized), "utf8")
		.digest("hex");
}

function pkcs7Pad(data: Buffer) {
	const remainder = data.length % BLOCK_SIZE;
	const padLength = remainder === 0 ? BLOCK_SIZE : BLOCK_SIZE - remainder;
	return Buffer.concat([data, Buffer.alloc(padLength, padLength)]);
}

export function encryptSebSettingsWithPassword(
	settings: SebSettings,
	password: string,
) {
	const plaintext = gzipSync(Buffer.from(serializeSebSettingsPlist(settings), "utf8"));
	const encryptionSalt = randomBytes(8);
	const hmacSalt = randomBytes(8);
	const iv = randomBytes(16);

	const encryptionKey = pbkdf2Sync(
		password,
		encryptionSalt,
		PBKDF2_ITERATIONS,
		32,
		"sha1",
	);
	const hmacKey = pbkdf2Sync(
		password,
		hmacSalt,
		PBKDF2_ITERATIONS,
		32,
		"sha1",
	);

	const cipher = createCipheriv("aes-256-cbc", encryptionKey, iv);
	cipher.setAutoPadding(false);
	const ciphertext = Buffer.concat([
		cipher.update(pkcs7Pad(plaintext)),
		cipher.final(),
	]);

	const payload = Buffer.concat([
		Buffer.from([RNCRYPTOR_VERSION, RNCRYPTOR_OPTIONS_PASSWORD]),
		encryptionSalt,
		hmacSalt,
		iv,
		ciphertext,
	]);
	const hmac = createHmac("sha256", hmacKey).update(payload).digest();

	return Buffer.concat([payload, hmac]);
}

function buildAllowedUrlRules(baseUrl: URL): ColumnlessSebRule[] {
	return [
		{
			action: 1,
			active: true,
			expression: "about:blank",
			regex: false,
		},
		{
			action: 1,
			active: true,
			expression: `${baseUrl.host}/*`,
			regex: false,
		},
	];
}

function buildProhibitedProcesses(): SebProcessRule[] {
	return [
		{
			active: true,
			currentUser: true,
			description: "Windows Snipping Tool",
			executable: "SnippingTool.exe",
			os: 1,
		},
		{
			active: true,
			currentUser: true,
			description: "Windows Screen Clipping overlay",
			executable: "ScreenClippingHost.exe",
			os: 1,
		},
		{
			active: true,
			currentUser: true,
			description: "Windows Problem Steps Recorder",
			executable: "psr.exe",
			os: 1,
		},
		{
			active: true,
			currentUser: true,
			description: "OBS Studio 64-bit",
			executable: "obs64.exe",
			os: 1,
		},
		{
			active: true,
			currentUser: true,
			description: "OBS Studio 32-bit",
			executable: "obs32.exe",
			os: 1,
		},
		{
			active: true,
			currentUser: true,
			description: "TeamViewer remote desktop",
			executable: "TeamViewer.exe",
			os: 1,
		},
		{
			active: true,
			currentUser: true,
			description: "AnyDesk remote desktop",
			executable: "AnyDesk.exe",
			os: 1,
		},
		{
			active: true,
			currentUser: true,
			description: "Windows Remote Desktop client",
			executable: "mstsc.exe",
			os: 1,
		},
		{
			active: true,
			currentUser: true,
			description: "Microsoft Remote Desktop client",
			executable: "msrdc.exe",
			os: 1,
		},
		{
			active: true,
			description: "macOS Screenshot utility",
			executable: "Screenshot",
			identifier: "com.apple.screenshot",
			os: 0,
		},
		{
			active: true,
			description: "macOS QuickTime Player screen recording",
			executable: "QuickTime Player",
			identifier: "com.apple.QuickTimePlayerX",
			os: 0,
		},
		{
			active: true,
			description: "OBS Studio",
			executable: "OBS",
			identifier: "com.obsproject.obs-studio",
			os: 0,
		},
		{
			active: true,
			description: "TeamViewer remote desktop",
			executable: "TeamViewer",
			identifier: "com.teamviewer.TeamViewer",
			os: 0,
		},
		{
			active: true,
			description: "AnyDesk remote desktop",
			executable: "AnyDesk",
			identifier: "com.philandro.anydesk",
			os: 0,
		},
		{
			active: true,
			description: "Microsoft Remote Desktop",
			executable: "Microsoft Remote Desktop",
			identifier: "com.microsoft.rdc.macos",
			os: 0,
		},
	];
}

export function buildSebSettings(baseUrl: string): SebSettings {
	const origin = new URL(baseUrl);
	const startURL = new URL("/", origin).toString();
	const quitURL = new URL(SEB_SUCCESS_PATH, origin).toString();

	return {
		additionalResources: [],
		additionalResourcesIdentifierCounter: 0,
		allowSwitchToApplications: false,
		sebConfigPurpose: 0,
		sebMode: 0,
		startURL,
		quitURL,
		quitURLConfirm: false,
		quitURLRestart: false,
		sendBrowserExamKey: true,
		downloadAndOpenSebConfig: false,
		allowQuit: false,
		showQuitButton: false,
		allowDeveloperConsole: false,
		blockPopUpWindows: true,
		browserViewMode: 1,
		browserWindowAllowAddressBar: false,
		browserWindowAllowReload: false,
		browserWindowShowURL: 0,
		newBrowserWindowAllowReload: false,
		newBrowserWindowNavigation: false,
		newBrowserWindowShowURL: 0,
		showReloadButton: false,
		showBackToStartButton: false,
		allowBrowsingBackForward: false,
		showTaskBar: false,
		showMenuBar: false,
		allowSpellCheck: false,
		enableAppSwitcherCheck: true,
		enableMacOSAAC: true,
		enablePrivateClipboard: true,
		enablePrivateClipboardMacEnforce: true,
		// macOS / newer SEB: block screen capture / recording
		allowScreenCapture: false,
		// macOS: block window capture / screenshots
		allowWindowCapture: false,
		// Legacy SEB key name kept for compatibility with older clients
		blockScreenShotsLegacy: true,
		// Screen sharing / recording related restrictions
		allowScreenSharing: false,
		screenSharingMacEnforceBlocked: true,
		removeBrowserProfile: true,
		// Kiosk-style isolation relevant to app/task switching
		createNewDesktop: true,
		// Windows task / app switching restrictions
		enableAltTab: false,
		enableAltF4: false,
		enablePrintScreen: false,
		enableRightMouse: false,
		enableStartMenu: false,
		ignoreExitKeys: true,
		ignoreQuitPassword: true,
		monitorProcesses: true,
		permittedProcesses: [],
		prohibitedProcesses: buildProhibitedProcesses(),
		URLFilterEnable: true,
		URLFilterEnableContentFilter: true,
		URLFilterRules: buildAllowedUrlRules(origin),
	};
}

export function buildSebConfigBundle(baseUrl: string, password: string) {
	const settings = buildSebSettings(baseUrl);
	const configKey = deriveSebConfigKey(settings);

	return {
		settings,
		configKey,
		encryptedConfig: encryptSebSettingsWithPassword(settings, password),
		startURL: settings.startURL as string,
		quitURL: settings.quitURL as string,
	};
}
