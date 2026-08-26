export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Appends -2, -3, ... until the slug doesn't collide with an existing one.
export function uniqueSlug(base: string, existing: string[]): string {
  const root = slugify(base) || 'org';
  if (!existing.includes(root)) return root;
  let n = 2;
  while (existing.includes(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

// Derives a short project key (e.g. "Design System" -> "DS") unique within existingKeys.
export function deriveProjectKey(name: string, existingKeys: string[]): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const base =
    (letters || name.replace(/[^a-zA-Z]/g, '').toUpperCase() || 'PRJ').slice(
      0,
      4,
    ) || 'PRJ';
  if (!existingKeys.includes(base)) return base;
  let n = 2;
  while (existingKeys.includes(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}
