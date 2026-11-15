export function itemLabel(item: { title: string; size?: string | null }) {
  return item.size ? `${item.title}, ${item.size}` : item.title;
}

export function detailLine(parts: (string | null | undefined | false)[]) {
  return parts.filter((p): p is string => !!p && !!p.trim()).join(" · ");
}

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

export function aboutMiles(miles: number) {
  return `about ${Math.max(1, Math.round(miles))} mi`;
}
