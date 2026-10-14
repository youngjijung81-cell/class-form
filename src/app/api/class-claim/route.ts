import { NextResponse } from 'next/server';
import { parseGradeClass } from '@/lib/questions';
import { claimClass } from '@/lib/server/classAuth';
import { isClosed } from '@/lib/server/responses';

// 아직 시작 전인 반을 처음 연 학생에게 그 반 코드를 만들어 준다.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const p = parseGradeClass(body?.grade, body?.classNo);
  if (!p) return NextResponse.json({ error: '학년·반이 올바르지 않습니다.' }, { status: 400 });
  try {
    if (await isClosed()) return NextResponse.json({ error: '제출이 마감되었습니다.' }, { status: 403 });
    const code = await claimClass(p.grade, p.classNo);
    if (!code) {
      return NextResponse.json(
        { error: '방금 다른 친구가 이 반을 먼저 시작했어요. 그 친구에게 우리 반 코드를 받아 입력해 주세요.', claimed: true },
        { status: 409 }
      );
    }
    return NextResponse.json({ code });
  } catch (err) {
    console.error('/api/class-claim', err);
    return NextResponse.json({ error: '시작하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
