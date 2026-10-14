import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { PHOTO_KINDS, parseGradeClass, type PhotoKind } from '@/lib/questions';
import { isClosed, photoPrefix } from '@/lib/server/responses';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 30 * 1024 * 1024;

// 브라우저가 사진을 저장소로 바로 올릴 수 있도록, 정해진 반·종류 경로에만 쓰는 임시 허가를 내준다.
export async function POST(req: Request) {
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: any = null;
        try {
          payload = JSON.parse(clientPayload || 'null');
        } catch {}
        const p = parseGradeClass(payload?.grade, payload?.classNo);
        const kind = payload?.kind as PhotoKind;
        if (!p || !(kind in PHOTO_KINDS)) throw new Error('bad target');
        if (!pathname.startsWith(photoPrefix(p.grade, p.classNo, kind)) || pathname.includes('..')) throw new Error('bad path');
        if (await isClosed()) throw new Error('closed');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: '사진을 올릴 수 없습니다. (마감되었거나 형식이 맞지 않음)' }, { status: 400 });
  }
}
