"use client";

import { useCallback, useState } from "react";
import {
  checkSebAccessRequest,
  type SebCheckResponse,
} from "./student-page-api";

type SebAccessState = {
  sebMessage: string | null;
  sebResponse: SebCheckResponse | null;
  sebStatus: "blocked" | "checking" | "idle" | "verified";
};

export function useSebAccess() {
  const [state, setState] = useState<SebAccessState>({
    sebMessage: null,
    sebResponse: null,
    sebStatus: "idle",
  });

  const verifySebAccess = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      sebMessage: null,
      sebStatus: "checking",
    }));

    try {
      const response = await checkSebAccessRequest();

      setState({
        sebMessage: response.message,
        sebResponse: response,
        sebStatus: response.ok ? "verified" : "blocked",
      });

      return response;
    } catch (error) {
      const fallbackMessage =
        error instanceof Error ? error.message : "SEB шалгах үед алдаа гарлаа.";

      setState({
        sebMessage: fallbackMessage,
        sebResponse: null,
        sebStatus: "blocked",
      });

      return {
        message: fallbackMessage,
        ok: false,
      } satisfies SebCheckResponse;
    }
  }, []);

  return {
    isSebChecking: state.sebStatus === "checking",
    isSebVerified: state.sebStatus === "verified",
    sebMessage: state.sebMessage,
    sebResponse: state.sebResponse,
    sebStatus: state.sebStatus,
    verifySebAccess,
  };
}
