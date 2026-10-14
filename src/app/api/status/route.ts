import { NextResponse } from 'next/server';
import { getSql } from '@/lib/server/db';
import { isClosed } from '@/lib/server/responses';

export const dynamic = 'force-dynamic';

// 첫 화면의 반별 진행 상황. 답변 내용은 보내지 않는다.
export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      select grade, class_no, updated_at,
        (select count(*) from jsonb_array_elements_text(answers) a where length(trim(a)) > 0)::int as answered,
        (photo_official is not null)::int + (photo_free is not null)::int as photos
      from responses`;
    return NextResponse.json({ closed: await isClosed(), classes: rows });
  } catch {
    return NextResponse.json({ error: '진행 상황을 불러오지 못했습니다.' }, { status: 500 });
  }
}
