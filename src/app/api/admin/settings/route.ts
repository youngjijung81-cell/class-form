import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/server/admin';
import { getSql } from '@/lib/server/db';

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (typeof body?.closed !== 'boolean') return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 });
  const sql = getSql();
  await sql`insert into settings (key, value) values ('closed', ${String(body.closed)})
            on conflict (key) do update set value = excluded.value`;
  return NextResponse.json({ closed: body.closed });
}
