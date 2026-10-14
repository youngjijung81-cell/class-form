import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin';
import { getSql } from '@/lib/server/db';
import { PHOTO_KINDS, parseGradeClass, type PhotoKind } from '@/lib/questions';

export const dynamic = 'force-dynamic';

// 비공개 저장소의 사진을 관리자에게만 전달한다. 경로는 DB에 등록된 것만 허용한다.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
  const url = new URL(req.url);
  const p = parseGradeClass(url.searchParams.get('grade') ?? '', url.searchParams.get('classNo') ?? '');
  const kind = url.searchParams.get('kind') as PhotoKind;
  if (!p || !(kind in PHOTO_KINDS)) return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 });

  const sql = getSql();
  const rows = await sql`select photo_official, photo_free from responses where grade = ${p.grade} and class_no = ${p.classNo}`;
  const info = rows[0]?.[kind === 'official' ? 'photo_official' : 'photo_free'];
  if (!info?.pathname) return NextResponse.json({ error: '사진이 없습니다.' }, { status: 404 });

  const file = await get(info.pathname, { access: 'private' });
  if (!file || file.statusCode !== 200) return NextResponse.json({ error: '사진을 찾을 수 없습니다.' }, { status: 404 });

  const ext = (info.pathname.match(/\.[a-z0-9]+$/i)?.[0] ?? '.jpg').toLowerCase();
  const filename = `${p.grade}학년${p.classNo}반_${PHOTO_KINDS[kind]}${ext}`.replace(/\//g, '-');
  const headers: Record<string, string> = {
    'Content-Type': file.blob.contentType ?? 'application/octet-stream',
    'Cache-Control': 'private, no-store',
  };
  if (url.searchParams.get('download') === '1') {
    headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
  }
  return new Response(file.stream, { headers });
}
