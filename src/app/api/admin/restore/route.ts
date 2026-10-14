import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin';
import { getSql } from '@/lib/server/db';

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: '기록 번호가 올바르지 않습니다.' }, { status: 400 });

  const sql = getSql();
  const found = await sql`select grade, class_no, snapshot from response_history where id = ${id}`;
  if (!found[0]) return NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 });
  const { grade, class_no, snapshot: s } = found[0] as any;

  // 되돌리기 전 현재 상태도 기록으로 남긴다.
  await sql`
    insert into response_history (grade, class_no, reason, snapshot)
    select grade, class_no, 'before_restore', to_jsonb(r) - 'grade' - 'class_no'
    from responses r where grade = ${grade} and class_no = ${class_no}`;
  await sql`
    update responses set
      homeroom = ${s.homeroom ?? ''},
      writer = ${s.writer ?? ''},
      answers = ${JSON.stringify(s.answers ?? ['', '', '', '', '', ''])}::jsonb,
      photo_official = ${s.photo_official ? JSON.stringify(s.photo_official) : null}::jsonb,
      photo_free = ${s.photo_free ? JSON.stringify(s.photo_free) : null}::jsonb,
      updated_at = now()
    where grade = ${grade} and class_no = ${class_no}`;
  return NextResponse.json({ success: true });
}
