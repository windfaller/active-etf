export type MemberMaskMode = "after-first" | "alternating" | "human-odd";

export interface MemberLockedResult {
  memberLocked: true;
}

export type MemberResult<T> = T | MemberLockedResult;

export const MEMBER_LOCKED_RESULT: MemberLockedResult = Object.freeze({ memberLocked: true });

/**
 * Keeps member previews deterministic. `human-odd` means the 1st, 3rd,
 * 5th... records as people normally count them.
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

export function maskMemberResults<T>(
  rows: readonly T[],
  authenticated: boolean,
  mode: MemberMaskMode = "alternating"
): Array<MemberResult<T>> {
  return rows.map((row, index) => shouldMaskMemberResult(authenticated, index, mode) ? MEMBER_LOCKED_RESULT : row);
}

export function maskAllMemberResults<T>(rows: readonly T[], authenticated: boolean): Array<MemberResult<T>> {
  return authenticated ? [...rows] : rows.map(() => MEMBER_LOCKED_RESULT);
}

function stableMemberBucket(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Keeps a record's preview entitlement stable when callers reorder query parameters or UI sorting. */
export function maskMemberResultsByStableKey<T>(
  rows: readonly T[],
  authenticated: boolean,
  keyOf: (row: T) => string
): Array<MemberResult<T>> {
  if (authenticated) return [...rows];
  return rows.map((row) => stableMemberBucket(keyOf(row)) % 2 === 1 ? MEMBER_LOCKED_RESULT : row);
}

export function isMemberLockedResult(value: unknown): value is MemberLockedResult {
  return Boolean(value && typeof value === "object" && (value as { memberLocked?: unknown }).memberLocked === true);
}

export function shouldRenderMemberLock<T>(
  rows: readonly MemberResult<T>[],
  row: MemberResult<T>,
  authenticated: boolean,
  index: number,
  mode: MemberMaskMode = "alternating"
): boolean {
  if (isMemberLockedResult(row)) return true;
  if (rows.some(isMemberLockedResult)) return false;
  return shouldMaskMemberResult(authenticated, index, mode);
}

export function visibleMemberResults<T>(rows: readonly MemberResult<T>[]): T[] {
  return rows.filter((row): row is T => !isMemberLockedResult(row));
}
