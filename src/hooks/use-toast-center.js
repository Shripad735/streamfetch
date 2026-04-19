import { useCallback, useEffect, useState } from "react";

export function useToastCenter() {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((item) => item.id !== toastId));
  }, []);

  const pushToast = useCallback((input) => {
    const id = input.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const durationMs = Number(input.durationMs || (input.actionLabel ? 10000 : 5500));
    const toast = {
      id,
      type: input.type || "info",
      title: input.title || "StreamFetch",
      message: input.message || "",
      actionLabel: input.actionLabel || "",
      onAction: typeof input.onAction === "function" ? input.onAction : null,
      expiresAt: Number.isFinite(durationMs) && durationMs > 0 ? Date.now() + durationMs : null
    };

    setToasts((prev) => [toast, ...prev].slice(0, 8));
    return id;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setToasts((prev) => prev.filter((toast) => toast.expiresAt === null || toast.expiresAt > Date.now()));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return {
    toasts,
    pushToast,
    dismissToast
  };
}
