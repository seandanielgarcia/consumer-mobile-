export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}
