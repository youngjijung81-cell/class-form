import { randomInt } from 'node:crypto';
import { cookies } from 'next/headers';
import { getSql } from './db';
import { isAdmin, safeEqual, sign } from './admin';

const DAYS = 60;
const cookieName = (grade: number, classNo: number) => `cf_class_${grade}_${classNo}`;

export function normalizeCode(input: unknown) {
  return typeof input === 'string' ? input.replace(/[\s-]/g, '').toUpperCase().slice(0, 12) : '';
}

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeCode() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

async function setClassCookie(grade: number, classNo: number, code: string) {
  const exp = Date.now() + DAYS * 86400_000;
  // 코드가 바뀌면(재발급·초기화) 예전 쿠키가 무효가 되도록 코드도 서명에 넣는다.
  const token = `${exp}.${sign(`class.${grade}.${classNo}.${exp}.${code}`)}`;
  (await cookies()).set(cookieName(grade, classNo), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: DAYS * 86400,
  });
}

/** 입력한 코드가 그 반 코드와 맞으면 그 반 전용 쿠키를 준다. 아직 시작 전인 반은 코드로 들어갈 수 없다. */
export async function loginClass(grade: number, classNo: number, code: string) {
  const sql = getSql();
  const rows = await sql`select code from class_codes where grade = ${grade} and class_no = ${classNo} and claimed_at is not null`;
  const expected = rows[0]?.code as string | undefined;
  if (!expected || !code || !safeEqual(sign(code), sign(expected))) return false;
  await setClassCookie(grade, classNo, expected);
  return true;
}

export async function isClaimed(grade: number, classNo: number) {
  const sql = getSql();
  const rows = await sql`select claimed_at is not null as claimed from class_codes where grade = ${grade} and class_no = ${classNo}`;
  return !!rows[0]?.claimed;
}

/**
 * 아직 아무도 시작하지 않은 반이면, 새 코드를 만들어 이 기기를 그 반 회장으로 등록하고 코드를 돌려준다.
 * 동시에 두 명이 눌러도 한 명만 성공한다. 이미 시작된 반이면 null.
 */
export async function claimClass(grade: number, classNo: number): Promise<string | null> {
  const sql = getSql();
  for (let i = 0; i < 5; i++) {
    try {
      const rows = await sql`
        update class_codes set code = ${makeCode()}, claimed_at = now()
        where grade = ${grade} and class_no = ${classNo} and claimed_at is null
        returning code`;
      const code = rows[0]?.code as string | undefined;
      if (!code) return null;
      await setClassCookie(grade, classNo, code);
      return code;
    } catch (e: any) {
      if (!String(e?.message).includes('unique')) throw e;
    }
  }
  throw new Error('코드를 만들지 못했습니다.');
}

/** 이미 들어와 있는 사람에게 우리 반 코드를 다시 보여 준다(친구와 함께 쓰거나 다른 기기용). */
export async function getClassCode(grade: number, classNo: number) {
  if (!(await canAccessClass(grade, classNo))) return null;
  const sql = getSql();
  const rows = await sql`select code from class_codes where grade = ${grade} and class_no = ${classNo} and claimed_at is not null`;
  return (rows[0]?.code as string | undefined) ?? null;
}

/** 이 반의 회장(코드 입력함)이거나 관리자면 true. */
export async function canAccessClass(grade: number, classNo: number) {
  if (await isAdmin()) return true;
  const token = (await cookies()).get(cookieName(grade, classNo))?.value;
  if (!token) return false;
  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!exp || exp < Date.now() || !sig) return false;
  const sql = getSql();
  const rows = await sql`select code from class_codes where grade = ${grade} and class_no = ${classNo} and claimed_at is not null`;
  const code = rows[0]?.code;
  return !!code && safeEqual(sig, sign(`class.${grade}.${classNo}.${exp}.${code}`));
}
