"use client";

import { toast } from "sonner";

export type ConfirmDestructiveActionOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  description?: string;
  prompt: string;
  successMessage?: string;
};

type ConfirmDestructiveActionHandler = (
  options: ConfirmDestructiveActionOptions,
) => Promise<boolean>;

let confirmDestructiveActionHandler: ConfirmDestructiveActionHandler | null =
  null;

export function setConfirmDestructiveActionHandler(
  handler: ConfirmDestructiveActionHandler | null,
) {
  confirmDestructiveActionHandler = handler;
}

function buildFallbackConfirmMessage(options: ConfirmDestructiveActionOptions) {
  const prompt = options.prompt.trim();
  const description = options.description?.trim();

  return description ? `${prompt}\n\n${description}` : prompt;
}

export async function confirmDestructiveAction(
  options: ConfirmDestructiveActionOptions,
) {
  if (typeof window === "undefined") {
    return true;
  }

  const confirmed = confirmDestructiveActionHandler
    ? await confirmDestructiveActionHandler(options)
    : window.confirm(buildFallbackConfirmMessage(options));

  if (confirmed && options.successMessage?.trim()) {
    toast.success(options.successMessage.trim());
  }

  return confirmed;
}

export function confirmDeleteAction(
  targetLabel = "Энэ мэдээллийг",
  description = "Энэ үйлдлийг буцаах боломжгүй байж магадгүй.",
  successMessage = `${targetLabel} устгалаа.`,
) {
  return confirmDestructiveAction({
    prompt: `${targetLabel} устгах уу?`,
    description,
    confirmLabel: "Устгах",
    cancelLabel: "Буцах",
    successMessage,
  });
}
