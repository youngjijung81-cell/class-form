import { NextResponse } from 'next/server';
import { getSql, withReadRetry } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

// 첫 화면의 반별 진행 상황. 답변 내용은 보내지 않는다.
// 많은 학생이 동시에 열어도 DB를 한 번만 조회하도록 한 문장으로 묻고, CDN에 몇 초간 공유 캐시한다.
export async function GET() {
  try {
    const sql = getSql();
    const rows = await withReadRetry(() => sql`
      select
        coalesce((select value = 'true' from settings where key = 'closed'), false) as closed,
        coalesce(json_agg(json_build_object(
          'grade', grade,
          'class_no', class_no,
          'updated_at', updated_at,
          'answered', (select count(*) from jsonb_array_elements_text(answers) a where length(trim(a)) > 0),
          'photos', (photo_official is not null)::int + (photo_free is not null)::int
        )) filter (where grade is not null), '[]'::json) as classes
      from responses`);
    return NextResponse.json(
      { closed: rows[0].closed, classes: rows[0].classes },
      { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30' } }
    );
  } catch (err) {
    console.error('/api/status', err);
    return NextResponse.json({ error: '진행 상황을 불러오지 못했습니다.' }, { status: 500 });
  }
}
