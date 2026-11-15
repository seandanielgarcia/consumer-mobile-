export function itemLabel(item: { title: string; size?: string | null }) {
  return item.size ? `${item.title}, ${item.size}` : item.title;
}

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}
