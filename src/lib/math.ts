import type { DocumentItemInput } from '@/types/domain';

export function calculateTotals(items: DocumentItemInput[], taxPercentage: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = subtotal * (taxPercentage / 100);
  const total = subtotal + taxAmount;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    tax_amount: Number(taxAmount.toFixed(2)),
    total_amount: Number(total.toFixed(2))
  };
}
