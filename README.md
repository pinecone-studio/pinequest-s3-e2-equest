# pinequest-s3-e2-team-1

Exam module: **frontend** (Next + Apollo Client) болон **create-exam-service** (Next + GraphQL Yoga + D1 + Gemini).

## Хавтасууд

| Хавтас | Агуулга |
|--------|---------|
| [`create-exam-service/`](create-exam-service/) | GraphQL API (`/api/graphql`), Drizzle + D1, асуулт үүсгэх (Gemini) |
| [`frontend/`](frontend/) | `/generate` UI, бүх GraphQL дуудлага Apollo-оор |

## Баримт (бүтэц)

- [create-exam-service — бүтэц](create-exam-service/docs/structure.md)
- [frontend — бүтэц](frontend/docs/structure.md)

## Локал ажиллуулах (товч)

1. `create-exam-service`: `.dev.vars` эсвэл `.env` — `GEMINI_API_KEY`; `bun run dev` (**3001**).
2. `frontend`: `NEXT_PUBLIC_CREATE_EXAM_GRAPHQL_URL=http://localhost:3001/api/graphql` (эсвэл `.env.example` үзэх); `bun run dev` (**3000**).
3. D1 локал: `create-exam-service` дотор `bun run db:migrate:local`.
