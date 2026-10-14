import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin';
import { getSql } from '@/lib/server/db';
import { parseGradeClass } from '@/lib/questions';
import { makeCode } from '@/lib/server/classAuth';

export const dynamic = 'force-dynamic';


export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
  const sql = getSql();
  const rows = await sql`select grade, class_no, code, claimed_at from class_codes order by grade, class_no`;
  return NextResponse.json({ codes: rows }, { headers: { 'Cache-Control': 'no-store' } });
}

// reissue: 코드가 다른 반에 알려졌을 때 그 반 코드만 새로 바꾼다(시작 상태 유지).
// reset: 다른 학생이 장난으로 먼저 시작했을 때 그 반을 "아직 시작 전"으로 되돌린다.
// 두 경우 모두 예전 코드와 예전 기기의 접속은 무효가 된다. 작성된 내용은 그대로 둔다.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const p = parseGradeClass(body?.grade, body?.classNo);
  const action = body?.action === 'reset' ? 'reset' : 'reissue';
  if (!p) return NextResponse.json({ error: '학년·반이 올바르지 않습니다.' }, { status: 400 });
  const sql = getSql();
  for (let i = 0; i < 5; i++) {
    try {
      const rows =
        action === 'reset'
          ? await sql`update class_codes set code = ${makeCode()}, claimed_at = null, created_at = now()
                      where grade = ${p.grade} and class_no = ${p.classNo} returning code, claimed_at`
          : await sql`update class_codes set code = ${makeCode()}, created_at = now()
                      where grade = ${p.grade} and class_no = ${p.classNo} returning code, claimed_at`;
      return NextResponse.json({ code: rows[0]?.code, claimed_at: rows[0]?.claimed_at ?? null });
    } catch (e: any) {
      if (!String(e?.message).includes('unique')) throw e;
    }
  }
  return NextResponse.json({ error: '코드를 만들지 못했어요.' }, { status: 500 });
}
