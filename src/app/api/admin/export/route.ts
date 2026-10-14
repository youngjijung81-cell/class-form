import { isAdmin } from '@/lib/server/admin';
import { getSql } from '@/lib/server/db';
import { FORMS } from '@/lib/questions';

export const dynamic = 'force-dynamic';

function cell(v: unknown) {
  let s = String(v ?? '');
  // 엑셀에서 수식으로 실행되지 않도록 막는다.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await isAdmin())) return new Response('관리자 로그인이 필요합니다.', { status: 401 });
  const sql = getSql();
  const rows = await sql`select * from responses order by grade, class_no`;
  const byKey = new Map(rows.map((r: any) => [`${r.grade}-${r.class_no}`, r]));

  const header = ['학년', '반', '담임선생님', '작성자(반장)', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', '공식사진', '자유사진', '최종 저장'];
  const lines = [header.map(cell).join(',')];
  for (const g of [1, 2, 3] as const) {
    lines.push(cell(`[${g}학년] ${FORMS[g].title}`));
    for (let c = 1; c <= 12; c++) {
      const r: any = byKey.get(`${g}-${c}`);
      const answers: string[] = r?.answers ?? ['', '', '', '', '', ''];
      lines.push(
        [
          g,
          c,
          r?.homeroom ?? '',
          r?.writer ?? '',
          ...answers,
          r?.photo_official ? 'O' : '',
          r?.photo_free ? 'O' : '',
          r?.updated_at ? new Date(r.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '',
        ]
          .map(cell)
          .join(',')
      );
    }
  }
  const csv = '﻿' + lines.join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('교지_학급프로필_응답.csv')}`,
      'Cache-Control': 'no-store',
    },
  });
}
