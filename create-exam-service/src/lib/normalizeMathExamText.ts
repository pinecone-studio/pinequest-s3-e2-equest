/**
 * DB-д: `$...$`, `$$...$$`, `\(...\)`, `\[...\]` тэмдэгтүүг хасаж зөвхөн LaTeX эх үлдэнэ.
 */
export function stripMathDelimitersForDb(raw: string): string {
	if (raw == null || raw === "") {
		return "";
	}
	let s = raw;
	for (let i = 0; i < 32; i++) {
		const next = s.replace(/\$\$([\s\S]*?)\$\$/g, "$1");
		if (next === s) break;
		s = next;
	}
	for (let i = 0; i < 32; i++) {
		const next = s.replace(/\$([^$]+)\$/g, "$1");
		if (next === s) break;
		s = next;
	}
	s = s.replace(/\\\(([\s\S]*?)\\\)/g, "$1");
	s = s.replace(/\\\[([\s\S]*?)\\\]/g, "$1");
	return s.trim();
}
