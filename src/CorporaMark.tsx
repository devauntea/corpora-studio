import type { SVGProps } from "react";

/** Two original lamellar forms: an open C and a smaller body, drawn as one family. */
export function CorporaMark({
  size = 32,
  className,
  title,
  ...props
}: Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title && <title>{title}</title>}
      <path d="M42 14C35 6 24 5 15 12C4 20 5 36 13 45C19 52 25 55 31 53" />
      <path d="M37 19C31 13 24 13 19 18C11 25 12 35 19 42C23 46 28 49 32 47" />
      <path d="M32 24C29 20 25 20 22 24C18 29 20 35 24 38C27 41 30 42 32 40" />
      <path d="M47 31C54 30 61 37 59 45C57 55 49 61 42 57C36 54 36 44 39 38C41 34 44 32 47 31Z" />
      <path d="M47 37C52 35 56 40 54 46C52 52 48 56 44 52C41 49 42 43 44 40C45 38 46 37 47 37Z" />
    </svg>
  );
}
