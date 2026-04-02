"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  setConfirmDestructiveActionHandler,
  type ConfirmDestructiveActionOptions,
} from "@/lib/confirm-destructive-action";

type PendingConfirmRequest = ConfirmDestructiveActionOptions & {
  resolve: (confirmed: boolean) => void;
};

export function DestructiveConfirmDialogProvider() {
  const isSettlingRef = useRef(false);
  const [queue, setQueue] = useState<PendingConfirmRequest[]>([]);
  const currentRequest = queue[0] ?? null;

  const settleCurrentRequest = useCallback((confirmed: boolean) => {
    if (isSettlingRef.current) {
      return;
    }

    isSettlingRef.current = true;

    setQueue((prev) => {
      if (!prev.length) {
        isSettlingRef.current = false;
        return prev;
      }

      const [current, ...rest] = prev;
      queueMicrotask(() => {
        current.resolve(confirmed);
        isSettlingRef.current = false;
      });
      return rest;
    });
  }, []);

  const enqueueConfirmRequest = useCallback(
    (options: ConfirmDestructiveActionOptions) =>
      new Promise<boolean>((resolve) => {
        setQueue((prev) => [...prev, { ...options, resolve }]);
      }),
    [],
  );

  useEffect(() => {
    setConfirmDestructiveActionHandler(enqueueConfirmRequest);

    return () => {
      setConfirmDestructiveActionHandler(null);
    };
  }, [enqueueConfirmRequest]);

  return (
    <AlertDialog
      open={Boolean(currentRequest)}
      onOpenChange={(open) => {
        if (!open) {
          settleCurrentRequest(false);
        }
      }}
    >
      <AlertDialogContent className="w-[min(92vw,28rem)] max-w-[28rem] rounded-[24px] border border-[#e2e8f0] bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        <AlertDialogHeader className="items-start gap-2 px-6 pb-0 pt-6 text-left">
          <AlertDialogTitle className="w-full text-left text-[20px] font-semibold text-slate-900">
            {currentRequest?.prompt ?? ""}
          </AlertDialogTitle>
          {currentRequest?.description ? (
            <AlertDialogDescription className="w-full text-left text-[14px] leading-6 text-slate-500">
              {currentRequest.description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        <AlertDialogFooter className="!mx-0 !mb-0 grid !grid-cols-2 gap-3 border-t border-[#eef2f7] bg-white px-6 pb-6 pt-5 sm:!grid sm:!grid-cols-2 sm:justify-stretch">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-[14px] border-[#dbe4f3] bg-white text-slate-700 hover:bg-slate-50"
            onClick={() => settleCurrentRequest(false)}
          >
            {currentRequest?.cancelLabel ?? "Буцах"}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-[14px] bg-[#dc2626] text-white hover:bg-[#b91c1c]"
            onClick={() => settleCurrentRequest(true)}
          >
            {currentRequest?.confirmLabel ?? "Устгах"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
