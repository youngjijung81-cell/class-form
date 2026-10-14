import { cookies } from 'next/headers';
import { getSql } from './db';
import { isAdmin, safeEqual, sign } from './admin';

const DAYS = 60;
const cookieName = (grade: number, classNo: number) => `cf_class_${grade}_${classNo}`;

export function normalizeCode(input: unknown) {
  return typeof input === 'string' ? input.replace(/[\s-]/g, '').toUpperCase().slice(0, 12) : '';
}

/** 입력한 코드가 그 반 코드와 맞으면 그 반 전용 쿠키를 준다. */
export async function loginClass(grade: number, classNo: number, code: string) {
  const sql = getSql();
  const rows = await sql`select code from class_codes where grade = ${grade} and class_no = ${classNo}`;
  const expected = rows[0]?.code as string | undefined;
  if (!expected || !code || !safeEqual(sign(code), sign(expected))) return false;

  const exp = Date.now() + DAYS * 86400_000;
  // 코드가 바뀌면(재발급) 예전 쿠키가 무효가 되도록 코드도 서명에 넣는다.
  const token = `${exp}.${sign(`class.${grade}.${classNo}.${exp}.${expected}`)}`;
  (await cookies()).set(cookieName(grade, classNo), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: DAYS * 86400,
  });
  return true;
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
  const rows = await sql`select code from class_codes where grade = ${grade} and class_no = ${classNo}`;
  const code = rows[0]?.code;
  return !!code && safeEqual(sig, sign(`class.${grade}.${classNo}.${exp}.${code}`));
}
