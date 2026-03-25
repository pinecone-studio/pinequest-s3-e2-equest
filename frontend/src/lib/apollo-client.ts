import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { getCreateExamGraphqlUrl } from "@/lib/create-exam-graphql";

export function createApolloClient() {
	return new ApolloClient({
		link: new HttpLink({
			uri: getCreateExamGraphqlUrl(),
			credentials: "include",
		}),
		cache: new InMemoryCache(),
		defaultOptions: {
			watchQuery: {
				fetchPolicy: "network-only",
			},
			query: {
				fetchPolicy: "network-only",
			},
			mutate: {
				fetchPolicy: "network-only",
			},
		},
	});
}
