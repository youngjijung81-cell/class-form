import { NextResponse } from 'next/server';
import { head } from '@vercel/blob';
import { PHOTO_KINDS, parseGradeClass, type PhotoKind } from '@/lib/questions';
import { isClosed, photoPrefix, savePhoto, toPublic } from '@/lib/server/responses';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ grade: string; classNo: string }> };

// 사진 업로드가 끝난 뒤 그 사진을 이 반의 공식/자유 사진으로 등록한다.
export async function POST(req: Request, { params }: Ctx) {
  const { grade, classNo } = await params;
  const p = parseGradeClass(grade, classNo);
  if (!p) return NextResponse.json({ error: '학년·반이 올바르지 않습니다.' }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  const kind = body?.kind as PhotoKind;
  const pathname = body?.pathname;
  const name = typeof body?.name === 'string' ? body.name.slice(0, 120) : '사진';
  if (!(kind in PHOTO_KINDS) || typeof pathname !== 'string' || !pathname.startsWith(photoPrefix(p.grade, p.classNo, kind)) || pathname.includes('..')) {
    return NextResponse.json({ error: '사진 정보가 올바르지 않습니다.' }, { status: 400 });
  }

  try {
    if (await isClosed()) return NextResponse.json({ error: '제출이 마감되었습니다.' }, { status: 403 });
    // 실제로 저장소에 올라간 파일인지 확인한다.
    const meta = await head(pathname).catch(() => null);
    if (!meta) return NextResponse.json({ error: '업로드된 사진을 찾을 수 없습니다.' }, { status: 400 });
    const row = await savePhoto(p.grade, p.classNo, kind, {
      pathname,
      name,
      size: meta.size,
      uploadedAt: new Date().toISOString(),
    });
    return NextResponse.json({ response: toPublic(row) });
  } catch {
    return NextResponse.json({ error: '사진을 등록하지 못했습니다.' }, { status: 500 });
  }
}
