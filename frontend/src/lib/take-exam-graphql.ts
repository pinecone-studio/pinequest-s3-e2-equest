export function getTakeExamGraphqlUrl(): string {
  return (
    process.env.TAKE_EXAM_GRAPHQL_URL ??
    process.env.NEXT_PUBLIC_TAKE_EXAM_GRAPHQL_URL ??
    "http://localhost:3002/api/graphql"
  );
}
