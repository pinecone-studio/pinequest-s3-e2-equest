"use client";

import {
	ApolloClient,
	ApolloLink,
	HttpLink,
	InMemoryCache,
} from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { useState } from "react";

type ApolloAppProviderProps = {
	children: React.ReactNode;
};

export function ApolloAppProvider({ children }: ApolloAppProviderProps) {
	const [client] = useState(() => {
		const httpLink = new HttpLink({
			uri: "/api/graphql",
		});

		return new ApolloClient({
			cache: new InMemoryCache(),
			link: ApolloLink.from([httpLink]),
		});
	});

	return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
