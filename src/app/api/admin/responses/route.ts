import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin';
import { getSql } from '@/lib/server/db';
import { isClosed } from '@/lib/server/responses';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
  const sql = getSql();
  const rows = await sql`
    select grade, class_no, homeroom, writer, answers, photo_official, photo_free, updated_at
    from responses order by grade, class_no`;
  return NextResponse.json({ closed: await isClosed(), responses: rows });
}
