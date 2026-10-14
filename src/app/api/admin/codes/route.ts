import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin';
import { getSql } from '@/lib/server/db';
import { parseGradeClass } from '@/lib/questions';

export const dynamic = 'force-dynamic';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
  const sql = getSql();
  const rows = await sql`select grade, class_no, code from class_codes order by grade, class_no`;
  return NextResponse.json({ codes: rows }, { headers: { 'Cache-Control': 'no-store' } });
}

// 코드가 다른 반에 알려졌을 때 그 반 코드를 새로 바꾼다. 예전 코드로 들어와 있던 기기도 다시 입력해야 한다.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const p = parseGradeClass(body?.grade, body?.classNo);
  if (!p) return NextResponse.json({ error: '학년·반이 올바르지 않습니다.' }, { status: 400 });
  const sql = getSql();
  for (let i = 0; i < 5; i++) {
    try {
      const rows = await sql`update class_codes set code = ${makeCode()}, created_at = now()
                             where grade = ${p.grade} and class_no = ${p.classNo} returning code`;
      return NextResponse.json({ code: rows[0]?.code });
    } catch (e: any) {
      if (!String(e?.message).includes('unique')) throw e;
    }
  }
  return NextResponse.json({ error: '코드를 만들지 못했어요.' }, { status: 500 });
}
