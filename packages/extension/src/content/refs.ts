/**
 * Registry ref -> element. Ref ổn định trong vòng đời trang:
 * cùng element -> cùng ref (element xong -> WeakRef thu hồi).
 */
const refToEl = new Map<string, WeakRef<Element>>();
const elToRef = new WeakMap<Element, string>();
let counter = 0;

export function registerRef(el: Element): string {
  const known = elToRef.get(el);
  if (known && refToEl.get(known)?.deref()) return known;
  counter += 1;
  const ref = `e${counter}`;
  elToRef.set(el, ref);
  refToEl.set(ref, new WeakRef(el));
  return ref;
}

export function getRef(id: string): Element | null {
  return refToEl.get(id)?.deref() ?? null;
}
