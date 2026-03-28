# frontend — бүтэц (team-1)

## Үүрэг

**Шалгалт үүсгэх UI** (`/generate`) → **Apollo Client**-ээр `create-exam-service`-ийн GraphQL (`/api/graphql`) руу **mutation/query** дууддаг. Шууд `fetch`-ээр GraphQL дуудахгүй.

## Хавтасууд

| Файл / хавтас | Зориулалт |
|---------------|-----------|
| `src/app/layout.tsx` | `ApolloProviderWrapper` — бүх хуудас Apollo client ашиглана |
| `src/app/generate/page.tsx` | `useMutation(GenerateExamQuestionsDocument)`, `useMutation(SaveExamDocument)` |
| `src/components/providers/apollo-provider.tsx` | `ApolloProvider` + `createApolloClient()` |
| `src/lib/apollo-client.ts` | `HttpLink` → `getCreateExamGraphqlUrl()` |
| `src/lib/create-exam-graphql.ts` | Зөвхөн **`NEXT_PUBLIC_CREATE_EXAM_GRAPHQL_URL`** (fallback: `http://localhost:3001/api/graphql`) |
| `src/lib/utils.ts` | shadcn / ерөнхий utility |
| `src/gql/graphql.ts` | **Codegen**-оор: schema-тай тааруулсан TS төрлүүд (`ExamType`, `SaveExamInput`, …) |
| `src/gql/create-exam-documents.ts` | **Apollo `gql`** — `GenerateExamQuestionsDocument`, `SaveExamDocument` (баримтын эх үүсвэр) |
| `src/gql/gql.ts`, `fragment-masking.ts`, `index.ts` | Codegen client preset-ийн үлдэгдэл (`gql` map ихэвчлэн хоосон — баримт `create-exam-documents.ts`-д) |
| `codegen.ts` | Schema: `../create-exam-service/src/graphql/schema.graphql`; documents: `src/gql/create-exam-documents.ts` |

## Орчин

| Хувьсагч | Зориулалт |
|----------|-----------|
| `NEXT_PUBLIC_CREATE_EXAM_GRAPHQL_URL` | Deploy-д бэкендийн бүрэн GraphQL URL (жишээ: `frontend/.env.example`) |

Локал: фронт `3000`, create-exam-service `3001` — URL тохируулалт таарсан байх.

## Script-ууд

| Script | Тайлбар |
|--------|---------|
| `bun run dev` | Next dev |
| `bun run codegen` | `graphql.ts` төрлүүдийг backend `schema.graphql`-аас шинэчилнэ |

**Схем өөрчлөгдсөний дараа:** эхлээд `create-exam-service` дээр `schema.graphql` + `typeDefs.ts` синк, дараа нь энд `bun run codegen`.

## Шинэ GraphQL operation нэмэх

1. `create-exam-service/src/graphql/schema.graphql` (болон `typeDefs.ts`) дээр тодорхойлолт нэмнэ.
2. `src/gql/create-exam-documents.ts` дотор `gql(\`...\`)` mutation/query нэмнэ (Apollo-оос `gql` импорт).
3. `bun run codegen`.
4. Хуудас дээр `useMutation` / `useQuery` + шаардлагатай бол `graphql.ts`-ийн төрлөөр `data`-г тодорхойлно (эсвэл ирээдүйд `typescript-operations` нэмж бүрэн TypedDocumentNode ашиглана).
