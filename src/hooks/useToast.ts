import { useState, useRef, useCallback } from "react";
import type { ToastAction } from "../types";

// Toast notification state. Auto-dismisses after 2.2s (or 6s if it has an action button).
export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const [toastAction, setToastAction] = useState<ToastAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, action?: ToastAction) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(msg);
    setToastAction(action || null);
    timerRef.current = setTimeout(() => {
      setToast(null);
      setToastAction(null);
    }, action ? 6000 : 2200);
  }, []);

  const dismissToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
    setToastAction(null);
  }, []);

  return { toast, toastAction, showToast, dismissToast };
}
