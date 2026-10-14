import { NextResponse } from 'next/server';
import { parseGradeClass } from '@/lib/questions';
import { withReadRetry } from '@/lib/server/db';
import { canAccessClass } from '@/lib/server/classAuth';
import { getRow, getRowWithClosed, isClosed, saveText, toPublic, validateText } from '@/lib/server/responses';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ grade: string; classNo: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const p = parseGradeClass((await params).grade, (await params).classNo);
  if (!p) return NextResponse.json({ error: '학년·반이 올바르지 않습니다.' }, { status: 400 });
  try {
    if (!(await withReadRetry(() => canAccessClass(p.grade, p.classNo)))) return NextResponse.json({ error: '반 코드를 입력해 주세요.', needCode: true }, { status: 401 });
    const { row, closed } = await withReadRetry(() => getRowWithClosed(p.grade, p.classNo));
    return NextResponse.json({ closed, response: toPublic(row) });
  } catch (err) {
    console.error('/api/responses/[grade]/[classNo]', err);
    return NextResponse.json({ error: '불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const { grade, classNo } = await params;
  const p = parseGradeClass(grade, classNo);
  if (!p) return NextResponse.json({ error: '학년·반이 올바르지 않습니다.' }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  const input = validateText(body);
  if (typeof input === 'string') return NextResponse.json({ error: input }, { status: 400 });

  try {
    if (!(await canAccessClass(p.grade, p.classNo))) return NextResponse.json({ error: '반 코드를 입력해 주세요.', needCode: true }, { status: 401 });
    if (await isClosed()) return NextResponse.json({ error: '제출이 마감되었습니다.' }, { status: 403 });
    const expected = typeof body.updatedAt === 'string' ? body.updatedAt : null;
    const saved = await saveText(p.grade, p.classNo, input, expected, body.force === true);
    if (!saved) {
      const latest = await getRow(p.grade, p.classNo);
      return NextResponse.json(
        { error: '그사이 다른 사람이 이 반 내용을 먼저 저장했습니다.', latest: toPublic(latest) },
        { status: 409 }
      );
    }
    return NextResponse.json({ response: toPublic(saved) });
  } catch (err) {
    console.error('/api/responses/[grade]/[classNo]', err);
    return NextResponse.json({ error: '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
