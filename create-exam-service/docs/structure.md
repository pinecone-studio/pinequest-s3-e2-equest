# create-exam-service — бүтэц

## Сервер

Энэ төсөл **Apollo Server биш**, **GraphQL Yoga** (`/api/graphql`) ашиглана. Yoga нь GraphQL HTTP endpoint өгдөг; frontend **Apollo Client**-ээр холбогдоно — нэр төстэй боловч backend дээр Apollo Server суулгах шаардлагагүй.

## Өгөгдлийн урсгал (товч)

```
Frontend (Apollo mutation)
    → POST /api/graphql
        → Mutation.analyzeQuestion → `lib/analyze-question-gemini.ts` (Gemini + Google Search tool; JSON нь текстээс parse — tool + `application/json` MIME API-д хамтдаа дэмжигдэхгүй)
        → Mutation.createAiExamTemplate → D1 `ai_exam_*` (Drizzle)
        → Mutation.generateExamQuestions → lib/ai.ts (Google Gemini API)
        → Mutation.saveExam → D1 `exams` (Drizzle)
        → Query.listNewMathExams / getNewMathExam → D1 `new_exams`
```

## Хавтасууд

| Хавтас / файл | Зориулалт |
|---------------|-----------|
| `src/app/api/graphql/route.ts` | Yoga handler (`GET`/`POST`/`OPTIONS`), CORS (`GRAPHQL_CORS_ORIGINS` + localhost:3000) |
| `src/graphql/schema.graphql` | **Schema-first эх** — frontend codegen эндээс уншина |
| `src/graphql/typeDefs.ts` | Yoga-д өгөх `typeDefs` string (**`schema.graphql`-тай заавал синхрон**) |
| `src/graphql/schema.ts` | `createSchema({ typeDefs, resolvers })` |
| `src/graphql/context.ts` | `GraphQLContext` — D1 (`DB`), Workers AI (`AI`), Gemini түлхүүр (`GOOGLE_AI_API_KEY` / `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_ANALYZE_MODEL`) |
| `src/graphql/types.ts` | Resolver/AI-д ашиглах зарим TS төрөл (`ExamGenerationInput`, …) |
| `src/graphql/resolvers/queries/` | Query resolver-ууд (`newMathExams.ts`) |
| `src/graphql/resolvers/mutations/` | Mutation тус бүр тусдаа файл: `generateExamQuestions.ts`, `saveExam.ts` |
| `src/graphql/resolvers/index.ts` | `Query` + `Mutation` нэгтгэх |
| `src/graphql/generated/resolvers-types.ts` | Backend `bun run codegen` — `Resolvers` type |
| `src/lib/ai.ts` | Google Gemini — `generateExamQuestions` |
| `src/lib/analyze-question-gemini.ts` | `analyzeQuestion` — Gemini + grounding; JSON-ийг системийн заавраар + `extractJsonText`; эхлээд `googleSearch`, дараа нь `googleSearchRetrieval` |
| `src/graphql/resolvers/mutations/analyzeQuestion.ts` | GraphQL `analyzeQuestion` — дээрх lib-ийг дуудаж JSON → `QuestionAnalysisResult` |
| `src/db/schema.ts` | Drizzle: `schema/index` re-export |
| `src/db/schema/tables/` | Хүснэгт бүр тусдаа (`exams.ts`, …) |
| `src/db/index.ts` | D1 → Drizzle instance |
| `drizzle/` | `drizzle-kit generate`-ийн SQL (`wrangler d1 migrations apply …`) |
| `drizzle/seed/ai_exam_mock_seed.sql` | Mock: **зөвхөн Математик** — **5** загвар × **20** асуулт. Үүсгэх: `bun run db:seed:ai-exam-mock:generate`; D1: `db:seed:ai-exam-mock:local` / `:remote` |
| `drizzle/seed/scheduler_digital_twin_seed.sql` | AI Scheduler: `classrooms`, `master_timetable` (10А Даваа), жишээ `exam_schedules` — `ai_exam_mock` seed-ийн `a1000000-…0001` шаардлагатай |
| `drizzle/0006_scheduler_digital_twin.sql` | `classrooms`, `master_timetable`, `exam_schedules` migration |
| `src/db/schema/tables/classrooms.ts` | Танхим (багтаамж, lab) |
| `src/db/schema/tables/masterTimetable.ts` | Үндсэн хуваарь (ангийн цаг) |
| `src/db/schema/tables/examSchedules.ts` | Шалгалтын цагийн мөр (`test_id` → `ai_exam_templates`) |
| `scripts/generate-ai-exam-mock-seed.ts` | Дээрх SQL-ийг дахин үүсгэх (агуулга өөрчлөхөд) |
| `drizzle.config.ts` | `drizzle-kit` (remote D1 холболт `.env`-ээс) |
| `codegen.ts` | Backend codegen (`typescript` + `typescript-resolvers`) |
| `.env.example` | Drizzle remote, `GRAPHQL_CORS_ORIGINS` |
| `.dev.vars.example` | Локал Worker: `GEMINI_API_KEY` (хуулж `.dev.vars`) |

**Mutations (бизнес логик):**

| Mutation | Resolver файл | Товч утга |
|----------|----------------|-----------|
| `analyzeQuestion` | `mutations/analyzeQuestion.ts` | **Gemini API** + grounding; secret: `GOOGLE_AI_API_KEY` эсвэл `GEMINI_API_KEY`; model: `GEMINI_ANALYZE_MODEL` эсвэл `GEMINI_MODEL` |
| `createAiExamTemplate` | `mutations/createAiExamTemplate.ts` | AI шинжилгээний үр дүнг D1 `ai_exam_templates` / `ai_exam_question_templates` руу |
| `generateExamQuestions` | `mutations/generateExamQuestions.ts` | Gemini-ээр асуулт үүсгэх; **AI-аас өмнө** фронтын `input`-ийг логлох: `wrangler.jsonc` → `vars.LOG_GRAPHQL_GENERATION` (`1` идэвхтэй, `0` унтраа), эсвэл локалд `NODE_ENV=development`. Deploy дээр харах: **Workers Logs** эсвэл `npx wrangler tail <worker-нэр>` |
| `saveExam` | `mutations/saveExam.ts` | `ExamGenerationInput` + асуултууд → `exams` хүснэгт (`DRAFT` / `PUBLISHED`) |

## Deploy дээр лог харах (`generateExamQuestions` input)

Урьдчилсан нөхцөл: `wrangler.jsonc` дотор `vars.LOG_GRAPHQL_GENERATION` нь `"1"` байх (эсвэл Dashboard-аас ижил variable тохируулсан). Дараа нь фронтоос «асуулт үүсгэх» дарахад `[generateExamQuestions] GraphQL input` мөр гарна.

### A) Терминалаас (`wrangler tail`)

1. Нэг удаа Cloudflare-д холбогдсон эсэхээ шалгана: `npx wrangler login` (шаардлагатай бол).
2. Төслийн хавтаснаас: `cd create-exam-service`
3. Worker нэрийг `wrangler.jsonc` дахь `"name"`-аас авна (одоогоор `create-exam-service`).
4. Ажиллуулна:

```bash
npx wrangler tail create-exam-service
```

5. Энэ цонх нээлттэй байх хооронд хөтөчөөс шалгалт үүсгэх хүсэлт илгээнэ — терминалд `console.info` логууд урсна.

### B) Cloudflare Dashboard (хөтөч)

1. [dash.cloudflare.com](https://dash.cloudflare.com) руу нэвтэрнэ.
2. Зүүн цэс эсвэл **Workers & Pages** (эсвэл **Compute (Workers)**) руу орно.
3. Жагсаалтаас **таны deploy хийсэн Worker**-ийг сонгоно (нэр нь ихэвчлэн `create-exam-service` эсвэл таны өөрчлөсөн нэр).
4. Дотор нь **Logs**, **Real-time Logs**, эсвэл **Observability** гэсэн хэсгийг нээнэ (Cloudflare-ийн UI өөрчлөгдөж болно; гол нь тухайн Worker-ийн **илүү цаг үеийн / real-time log** харагдах хуудас).
5. Лог цонхыг нээлттэй үлдээж, фронтоос generate дуудлага илгээнэ — `[generateExamQuestions]` мөрүүд харагдана.

**Анхаар:** Dashboard-д зарим төлөвлөгөөнд лог хадгалалт/хугацаа хязгаартай байж болно; шууд ажиглахад `wrangler tail` илүү найдвартай.

## Script-ууд (`package.json`)

| Script | Тайлбар |
|--------|---------|
| `bun run dev` | Next dev, порт **3001** |
| `bun run codegen` | `src/graphql/generated/resolvers-types.ts` шинэчлэх |
| `bun run db:generate` | Шинэ migration SQL үүсгэх |
| `bun run db:migrate:local` | D1 локал: `wrangler d1 migrations apply create-exams --local` |
| `bun run db:migrate:remote` | D1 production: ижил нэртэй DB-д `--remote` |
| `bun run db:seed:scheduler-twin:local` / `:remote` | `scheduler_digital_twin_seed.sql` — танхим + 10А хуваарь + жишээ `exam_schedules` |

## AI Scheduler (Digital Twin + Queue)

- **D1:** `classrooms`, `master_timetable`, `exam_schedules` ([`0006_scheduler_digital_twin.sql`](drizzle/0006_scheduler_digital_twin.sql)).
- **Seed:** [`drizzle/seed/scheduler_digital_twin_seed.sql`](drizzle/seed/scheduler_digital_twin_seed.sql) — `ai_exam_templates.id = a1000000-0000-4000-8000-000000000001` байх ёстой (mock math seed).
- **Queue:** [`wrangler.jsonc`](wrangler.jsonc) дээр `SCHEDULER_QUEUE` **producer** л. `queues.consumers` нэмэхдээ Worker дээр `queue()` handler (эсвэл тусдаа consumer Worker) заавал; OpenNext үндсэн bundle-д handler байхгүй бол consumer тохируулахгүй.

## Drizzle: хаана бичих вэ

1. Шинэ хүснэгт: `src/db/schema/tables/<нэр>.ts` дотор `sqliteTable(...)` тодорхойлно.
2. `src/db/schema/index.ts` дотор `export * from "./tables/<нэр>"` нэмнэ.
3. `src/db/schema.ts` ихэвчлэн өөрчлөх шаардлагагүй (`export * from "./schema/index"`).

**Migration ажиллуулах:**

```bash
cd create-exam-service
# Шаардлагатай: .env (Drizzle remote), эсвэл зөвхөн локал бол wrangler local
bun run db:generate
bun run db:migrate:local   # эсвэл db:migrate:remote
```

## GraphQL codegen (хоёр тал)

| Тал | Конфиг | Үр дүн |
|-----|--------|--------|
| **Backend** | `create-exam-service/codegen.ts` | `generated/resolvers-types.ts` |
| **Frontend** | `frontend/codegen.ts` (schema → энэхүү `schema.graphql`) | `frontend/src/gql/graphql.ts` (төрлүүд); баримт нь `create-exam-documents.ts` (Apollo `gql`) |

Схем өөрчлөгдсөн бол: **эхлээд** энд `schema.graphql` + `typeDefs.ts`, **`bun run codegen`**, дараа нь `frontend`-д `bun run codegen`.

## Шинэ mutation/query нэмэх

1. `schema.graphql` + `typeDefs.ts` дээр ижил өөрчлөлт хийнэ.
2. `resolvers/mutations/<нэр>.ts` эсвэл `resolvers/queries/<нэр>.ts` үүсгэж, тухайн `index.ts`-д нэгтгэнэ.
3. `bun run codegen` (backend).
4. Frontend: `frontend/src/gql/create-exam-documents.ts` дотор `gql` operation нэмж, `frontend`-д `bun run codegen`.

## Нэмэлт баримт

- Frontend бүтэц: [`frontend/docs/structure.md`](../../frontend/docs/structure.md)
