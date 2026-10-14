import { NextResponse } from 'next/server';
import { checkPassword, startSession } from '@/lib/server/admin';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  if (!checkPassword(body?.password)) {
    // 비밀번호 대입을 느리게 만든다.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: '관리자 비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }
  await startSession();
  return NextResponse.json({ success: true });
}
