import type { ReactNode } from "react";

interface MobileTableProps<T> {
  data: T[];
  renderItem: (item: T) => ReactNode;
  emptyMessage?: string;
}

export default function MobileTable<T>({
  data,
  renderItem,
  emptyMessage = "Nenhum dado disponível",
}: MobileTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {data.map((item, index) => (
        <div key={index}>
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}