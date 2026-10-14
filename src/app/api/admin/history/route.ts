import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin';
import { getSql } from '@/lib/server/db';
import { parseGradeClass } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
  const url = new URL(req.url);
  const p = parseGradeClass(url.searchParams.get('grade') ?? '', url.searchParams.get('classNo') ?? '');
  if (!p) return NextResponse.json({ error: '학년·반이 올바르지 않습니다.' }, { status: 400 });
  const sql = getSql();
  const rows = await sql`
    select id, reason, snapshot, saved_at from response_history
    where grade = ${p.grade} and class_no = ${p.classNo}
    order by saved_at desc limit 50`;
  return NextResponse.json({ history: rows });
}
