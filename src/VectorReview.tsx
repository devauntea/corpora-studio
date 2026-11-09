import { useEffect, useRef, type ReactNode } from "react";
export function VectorReview({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      role="dialog"
      tabIndex={-1}
      className="vector-review"
      ref={ref}
      aria-labelledby="vector-review-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <h2 id="vector-review-title">{title}</h2>
        <button aria-label="Close review" onClick={close}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
