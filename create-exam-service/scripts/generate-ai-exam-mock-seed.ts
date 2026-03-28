/**
 * `drizzle/seed/ai_exam_mock_seed.sql` үүсгэнэ — **зөвхөн Математик**: 5 загвар × 20 асуулт.
 * Ажиллуулах: `bun run scripts/generate-ai-exam-mock-seed.ts`
 * D1 руу оруулах: `npm run db:seed:ai-exam-mock:local` эсвэл `:remote`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../drizzle/seed/ai_exam_mock_seed.sql");

function sqlStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

const TEMPLATE_IDS = [
  "a1000000-0000-4000-8000-000000000001",
  "a1000000-0000-4000-8000-000000000002",
  "a1000000-0000-4000-8000-000000000003",
  "a1000000-0000-4000-8000-000000000004",
  "a1000000-0000-4000-8000-000000000005",
] as const;

/** Бүгд subject = Математик; гарчиг/ангиар л ялгагдана. */
const EXAMS = [
  {
    title: "Seed: Математик 10 — Алгебр (mock A)",
    subject: "Математик",
    grade: 10,
    duration: 90,
    diff: "MEDIUM" as const,
    topic: "Алгебр",
  },
  {
    title: "Seed: Математик 9 — Функц (mock B)",
    subject: "Математик",
    grade: 9,
    duration: 60,
    diff: "HARD" as const,
    topic: "Функц",
  },
  {
    title: "Seed: Математик 8 — Геометр (mock C)",
    subject: "Математик",
    grade: 8,
    duration: 60,
    diff: "MEDIUM" as const,
    topic: "Геометр",
  },
  {
    title: "Seed: Математик 7 — Тоо ба үйлдэл (mock D)",
    subject: "Математик",
    grade: 7,
    duration: 45,
    diff: "EASY" as const,
    topic: "Тоо ба үйлдэл",
  },
  {
    title: "Seed: Математик 11 — Холимог (mock E)",
    subject: "Математик",
    grade: 11,
    duration: 75,
    diff: "MEDIUM" as const,
    topic: "Холимог",
  },
] as const;

const TEACHER_ID = "teacher-seed-mock";
const NOW = "2026-03-29T00:00:00.000Z";

function questionId(templateIndex: number, q: number): string {
  const n = templateIndex * 100 + q;
  return `b1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

/** MCQ: тоон сонголтууд (математик mock). */
function mathMcqOptions(seed: number): { json: string; correct: string } {
  const n = seed * 7 + 3;
  const arr = [`${n}`, `${n + 2}`, `${n + 5}`, `${n + 11}`];
  const correct = arr[seed % 4];
  const json = JSON.stringify(arr);
  return { json, correct };
}

const lines: string[] = [];

lines.push(
  `-- Mock seed: зөвхөн Математик — 5 ai_exam_templates × 20 ai_exam_question_templates.`,
);
lines.push(`PRAGMA foreign_keys = ON;`);
lines.push(``);
lines.push(`DELETE FROM ai_exam_question_templates WHERE template_id IN (`);
lines.push(
  TEMPLATE_IDS.map((id) => sqlStr(id)).join(",\n  "),
);
lines.push(`);`);
lines.push(`DELETE FROM ai_exam_templates WHERE id IN (`);
lines.push(TEMPLATE_IDS.map((id) => sqlStr(id)).join(",\n  "));
lines.push(`);`);
lines.push(``);

const templateValueRows: string[] = [];
for (let i = 0; i < 5; i++) {
  const e = EXAMS[i];
  const id = TEMPLATE_IDS[i];
  const totalPoints = 20 * 2;
  templateValueRows.push(
    `  (${sqlStr(id)}, ${sqlStr(e.title)}, ${sqlStr(e.subject)}, ${e.grade}, ${sqlStr(TEACHER_ID)}, ${e.duration}, ${sqlStr(e.diff)}, ${totalPoints}, ${sqlStr(NOW)}, ${sqlStr(NOW)})`,
  );
}

lines.push(`INSERT INTO ai_exam_templates (`);
lines.push(
  `  id, title, subject, grade, teacher_id, duration_minutes, difficulty, total_points, created_at, updated_at`,
);
lines.push(`) VALUES`);
lines.push(templateValueRows.join(",\n"));
lines.push(`;`);
lines.push(``);

const difficulties = ["EASY", "MEDIUM", "HARD"] as const;
const skills = ["Мэдлэг", "Ойлгомж", "Хэрэглээ", "Шинжилгээ"] as const;

const questionRows: string[] = [];
for (let t = 0; t < 5; t++) {
  const templateId = TEMPLATE_IDS[t];
  const exam = EXAMS[t];
  for (let q = 1; q <= 20; q++) {
    const seed = t * 20 + q;
    const { json: optionsJson, correct } = mathMcqOptions(seed);
    const diff = difficulties[seed % 3];
    const skill = skills[seed % 4];
    const prompt = `Математик (${exam.topic}) — mock №${q}. Доорх тоон сонголтуудаас нэгийг сонго.`;
    const tags = `математик,${exam.topic},seed,mock`;
    const explanation = `Жишээ тайлбар: ${correct} нь зөв. (mock seed)`;
    const source = `https://example.edu/mock/seed/${templateId}/${q}`;
    const qid = questionId(t, q);
    questionRows.push(
      `  (${sqlStr(qid)}, ${sqlStr(templateId)}, ${q}, ${sqlStr("MCQ")}, ${sqlStr("MCQ")}, ${sqlStr(prompt)}, ${sqlStr(optionsJson)}, ${sqlStr(correct)}, 2, ${sqlStr(diff)}, ${sqlStr(tags)}, ${sqlStr(skill)}, ${sqlStr(explanation)}, ${sqlStr(source)}, NULL, ${sqlStr(NOW)}, ${sqlStr(NOW)})`,
    );
  }
}

lines.push(`INSERT INTO ai_exam_question_templates (`);
lines.push(
  `  id, template_id, position, type, ai_suggested_type, prompt, options_json, correct_answer, points, difficulty, tags, skill_level, explanation, source, vector_id, created_at, updated_at`,
);
lines.push(`) VALUES`);
lines.push(questionRows.join(",\n"));
lines.push(`;`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(`Wrote ${OUT} (${5 + 100} мөр INSERT)`);
