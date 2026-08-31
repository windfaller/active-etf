export type MemberMaskMode = "after-first" | "alternating" | "human-odd";

/**
 * Keeps anonymous previews deterministic so the same result never appears and
 * disappears between renders. `human-odd` means the 1st, 3rd, 5th… records.
 */
export function shouldMaskMemberResult(
  authenticated: boolean,
  index: number,
  mode: MemberMaskMode = "alternating"
): boolean {
  if (authenticated) return false;
  if (mode === "after-first") return index > 0;
  if (mode === "human-odd") return index % 2 === 0;
  return index % 2 === 1;
}
