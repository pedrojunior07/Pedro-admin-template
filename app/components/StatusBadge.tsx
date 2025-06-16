import type { ReactNode } from "react";

interface StatusBadgeProps {
  status: boolean;
  children?: ReactNode;
}

export default function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        status
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
      }`}
    >
      {children || (status ? "Ativo" : "Inativo")}
    </span>
  );
}