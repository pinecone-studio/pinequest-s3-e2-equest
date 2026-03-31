/**
 * `drizzle/seed/students_seed.sql` үүсгэнэ.
 * Урьдчилсан нөхцөл: `groups` seed (`9A`, `9B`, `10A`, `11A` гэх мэт) ажилласан байх.
 * Ажиллуулах: `bun run scripts/generate-students-seed.ts`
 * D1: `bun run db:seed:students:local` | `:remote`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../drizzle/seed/students_seed.sql");

/** `groups.id` — `groups_seed.sql`-тай тааруулсан */
const GROUP_MAP: Record<string, string> = {
	"9A": "9A",
	"9B": "9B",
	"10A": "10A",
	"11A": "11A",
};

const boysNames = [
	"Бат",
	"Ганболд",
	"Тэмүүлэн",
	"Тулга",
	"Билгүүн",
	"Төгөлдөр",
	"Алтангэрэл",
	"Жавхлан",
	"Ариунболд",
	"Баясгалан",
	"Чингүүн",
	"Дөлгөөн",
	"Бадрал",
	"Хатанбаатар",
	"Тэнгэр",
	"Өсөхбаяр",
	"Мөнх-Эрдэнэ",
	"Эрдэнэбаяр",
	"Анхбаяр",
	"Тэмүүжин",
];
const girlsNames = [
	"Ану",
	"Болд",
	"Мишээл",
	"Номин",
	"Сарнай",
	"Энхрий",
	"Намуун",
	"Сондор",
	"Янжин",
	"Уянга",
	"Цолмон",
	"Гэрэл",
	"Цацрал",
	"Энхжин",
	"Мөнхзул",
	"Солонго",
	"Хулан",
	"Наран",
	"Ариунзаяа",
	"Ундрал",
];
const lastNames = [
	"Ган",
	"Болд",
	"Эрдэнэ",
	"Зоригт",
	"Мөнх",
	"Даваа",
	"Баяр",
	"Цогт",
	"Од",
	"Бат",
	"Энх",
	"Пүрэв",
	"Дулмаа",
	"Эрхэм",
	"Мөрөн",
	"Шүүдэр",
	"Төгс",
	"Амар",
	"Хүрэл",
	"Хөх",
	"Жавхлан",
	"Тэмүүжин",
	"Баатар",
];

function sqlStr(s: string): string {
	return `'${s.replace(/'/g, "''")}'`;
}

/** Тогтмол давталттай "случай" — SQL файл бүр ижил үлдэнэ */
function mulberry32(seed: number) {
	return function () {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const rand = mulberry32(20260331);

type Row = {
	id: string;
	firstName: string;
	lastName: string;
	studentCode: string;
	email: string | null;
	groupId: string;
	gender: "male" | "female";
	status: "active";
};

let idSeq = 1;

function generateBatch(count: number, groupKey: keyof typeof GROUP_MAP): Row[] {
	const groupId = GROUP_MAP[groupKey];
	const list: Row[] = [];
	for (let i = 1; i <= count; i++) {
		const isBoy = rand() > 0.5;
		const firstName = isBoy
			? boysNames[Math.floor(rand() * boysNames.length)]!
			: girlsNames[Math.floor(rand() * girlsNames.length)]!;
		const lastName = lastNames[Math.floor(rand() * lastNames.length)]!;
		const studentCode = `S26-${groupKey}-${String(i).padStart(3, "0")}`;
		const id = `00000000-0000-4000-8000-${String(idSeq).padStart(12, "0")}`;
		idSeq += 1;

		list.push({
			id,
			firstName,
			lastName,
			studentCode,
			email: `${studentCode.toLowerCase().replace(/[^a-z0-9]+/g, "")}@school.edu.mn`,
			groupId,
			gender: isBoy ? "male" : "female",
			status: "active",
		});
	}
	return list;
}

const NOW_MS = 1735689600000; // 2025-01-01 UTC (тогтмол)

function main() {
	idSeq = 1;
	const all: Row[] = [
		...generateBatch(27, "9A"),
		...generateBatch(25, "9B"),
		...generateBatch(26, "10A"),
		...generateBatch(28, "11A"),
	];

	const lines: string[] = [
		"-- Students seed — generate-students-seed.ts",
		"-- Урьдчилсан нөхцөл: groups, 0028_students migration",
		"PRAGMA foreign_keys = OFF;",
		"",
		"DELETE FROM students;",
		"",
	];

	for (const r of all) {
		lines.push(
			`INSERT INTO students (id, first_name, last_name, student_code, email, group_id, gender, status, created_at, updated_at) VALUES (${sqlStr(r.id)}, ${sqlStr(r.firstName)}, ${sqlStr(r.lastName)}, ${sqlStr(r.studentCode)}, ${r.email ? sqlStr(r.email) : "NULL"}, ${sqlStr(r.groupId)}, ${sqlStr(r.gender)}, ${sqlStr(r.status)}, ${NOW_MS}, ${NOW_MS});`,
		);
	}

	lines.push("", "PRAGMA foreign_keys = ON;", "");

	mkdirSync(dirname(OUT), { recursive: true });
	writeFileSync(OUT, lines.join("\n"), "utf8");
	console.log(`Wrote ${OUT} (${all.length} rows)`);
}

main();
