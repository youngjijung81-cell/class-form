import { NextResponse } from 'next/server';
import { parseGradeClass } from '@/lib/questions';
import { loginClass, normalizeCode } from '@/lib/server/classAuth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const p = parseGradeClass(body?.grade, body?.classNo);
  if (!p) return NextResponse.json({ error: '학년·반이 올바르지 않습니다.' }, { status: 400 });
  try {
    if (!(await loginClass(p.grade, p.classNo, normalizeCode(body?.code)))) {
      // 코드 대입을 느리게 만든다.
      await new Promise((r) => setTimeout(r, 800));
      return NextResponse.json({ error: '반 코드가 맞지 않아요. 선생님께 받은 코드를 확인해 주세요.' }, { status: 401 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('/api/class-login', err);
    return NextResponse.json({ error: '확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
