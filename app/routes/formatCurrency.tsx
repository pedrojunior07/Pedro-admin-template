export function formatCurrency(value: number, currency: string = 'MZN'): string {
  return new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(value);
}