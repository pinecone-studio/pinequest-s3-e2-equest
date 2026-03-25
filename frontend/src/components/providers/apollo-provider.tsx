"use client";

import { ApolloProvider } from "@apollo/client/react";
import * as React from "react";
import { createApolloClient } from "@/lib/apollo-client";

export function ApolloProviderWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	const client = React.useMemo(() => createApolloClient(), []);

	return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
