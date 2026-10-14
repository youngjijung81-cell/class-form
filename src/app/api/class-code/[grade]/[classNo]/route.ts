import { NextResponse } from 'next/server';
import { parseGradeClass } from '@/lib/questions';
import { getClassCode } from '@/lib/server/classAuth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ grade: string; classNo: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { grade, classNo } = await params;
  const p = parseGradeClass(grade, classNo);
  if (!p) return NextResponse.json({ error: '학년·반이 올바르지 않습니다.' }, { status: 400 });
  const code = await getClassCode(p.grade, p.classNo);
  if (!code) return NextResponse.json({ error: '반 코드를 입력해 주세요.', needCode: true }, { status: 401 });
  return NextResponse.json({ code }, { headers: { 'Cache-Control': 'no-store' } });
}
