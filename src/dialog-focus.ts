import { useEffect, useRef } from "react";
/** Restore the invoking control after a modal closes, including nested studios. */
export function useDialogReturnFocus() {
  const source = useRef(document.activeElement);
  useEffect(
    () => () => {
      const el = source.current;
      if (el instanceof HTMLElement && el.isConnected) el.focus();
    },
    [],
  );
}
