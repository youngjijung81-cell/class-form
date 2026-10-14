import { getSql } from './db';
import { ANSWER_MAX, NAME_MAX, type PhotoKind } from '@/lib/questions';

export type PhotoInfo = { pathname: string; name: string; size: number; uploadedAt: string };

export type ResponseRow = {
  grade: number;
  class_no: number;
  homeroom: string;
  writer: string;
  answers: string[];
  photo_official: PhotoInfo | null;
  photo_free: PhotoInfo | null;
  updated_at: string | null;
};

export type TextInput = { homeroom: string; writer: string; answers: string[] };

export function emptyRow(grade: number, classNo: number): ResponseRow {
  return {
    grade,
    class_no: classNo,
    homeroom: '',
    writer: '',
    answers: ['', '', '', '', '', ''],
    photo_official: null,
    photo_free: null,
    updated_at: null,
  };
}

export function validateText(body: any): TextInput | string {
  const homeroom = typeof body?.homeroom === 'string' ? body.homeroom.trim() : '';
  const writer = typeof body?.writer === 'string' ? body.writer.trim() : '';
  const answers = Array.isArray(body?.answers) ? body.answers : [];
  if (homeroom.length > NAME_MAX || writer.length > NAME_MAX) return `이름은 ${NAME_MAX}자 이내로 적어 주세요.`;
  if (answers.length !== 6 || answers.some((a: unknown) => typeof a !== 'string')) return '답변 형식이 올바르지 않습니다.';
  if (answers.some((a: string) => a.length > ANSWER_MAX)) return `답변은 문항마다 ${ANSWER_MAX}자 이내로 적어 주세요.`;
  return { homeroom, writer, answers: answers.map((a: string) => a.replace(/\r\n/g, '\n')) };
}

export async function isClosed() {
  const sql = getSql();
  const rows = await sql`select value from settings where key = 'closed'`;
  return rows[0]?.value === 'true';
}

export async function getRow(grade: number, classNo: number): Promise<ResponseRow> {
  const sql = getSql();
  const rows = await sql`
    select grade, class_no, homeroom, writer, answers, photo_official, photo_free, updated_at
    from responses where grade = ${grade} and class_no = ${classNo}`;
  return (rows[0] as ResponseRow) ?? emptyRow(grade, classNo);
}

/** 반 내용과 마감 여부를 DB 한 번 조회로 함께 읽는다. */
export async function getRowWithClosed(grade: number, classNo: number): Promise<{ row: ResponseRow; closed: boolean }> {
  const sql = getSql();
  const rows = await sql`
    select coalesce((select value = 'true' from settings where key = 'closed'), false) as closed,
      (select to_jsonb(r) from (
        select grade, class_no, homeroom, writer, answers, photo_official, photo_free, updated_at
        from responses where grade = ${grade} and class_no = ${classNo}) r) as row`;
  return { closed: rows[0].closed, row: (rows[0].row as ResponseRow) ?? emptyRow(grade, classNo) };
}

const RETURNING = 'grade, class_no, homeroom, writer, answers, photo_official, photo_free, updated_at';

/**
 * 충돌 확인·이전 상태 기록·저장을 한 SQL 문으로 처리해, 여러 명이 동시에 저장해도 끼어들 틈이 없게 한다.
 * expectedUpdatedAt이 현재 값과 다르면(다른 사람이 먼저 저장) null을 돌려준다.
 */
export async function saveText(
  grade: number,
  classNo: number,
  input: TextInput,
  expectedUpdatedAt: string | null,
  force: boolean
): Promise<ResponseRow | null> {
  const sql = getSql();
  const rows = await sql.query(
    `with prev as (
       select * from responses where grade = $1 and class_no = $2
     ),
     up as (
       insert into responses as r (grade, class_no, homeroom, writer, answers, updated_at)
       values ($1, $2, $3, $4, $5::jsonb, clock_timestamp())
       on conflict (grade, class_no) do update
         set homeroom = excluded.homeroom, writer = excluded.writer, answers = excluded.answers, updated_at = clock_timestamp()
         where $6::boolean or date_trunc('milliseconds', r.updated_at) is not distinct from $7::timestamptz
       returning ${RETURNING}
     ),
     hist as (
       insert into response_history (grade, class_no, reason, snapshot)
       select p.grade, p.class_no, 'text', to_jsonb(p) - 'grade' - 'class_no'
       from prev p where exists (select 1 from up)
     )
     select * from up`,
    [grade, classNo, input.homeroom, input.writer, JSON.stringify(input.answers), force, expectedUpdatedAt]
  );
  return (rows[0] as ResponseRow) ?? null;
}

export async function savePhoto(grade: number, classNo: number, kind: PhotoKind, info: PhotoInfo): Promise<ResponseRow> {
  const sql = getSql();
  const col = kind === 'official' ? 'photo_official' : 'photo_free';
  const rows = await sql.query(
    `with prev as (
       select * from responses where grade = $1 and class_no = $2
     ),
     up as (
       insert into responses (grade, class_no, ${col}, updated_at)
       values ($1, $2, $3::jsonb, clock_timestamp())
       on conflict (grade, class_no) do update set ${col} = excluded.${col}, updated_at = clock_timestamp()
       returning ${RETURNING}
     ),
     hist as (
       insert into response_history (grade, class_no, reason, snapshot)
       select p.grade, p.class_no, $4, to_jsonb(p) - 'grade' - 'class_no' from prev p
     )
     select * from up`,
    [grade, classNo, JSON.stringify(info), `photo_${kind}`]
  );
  return rows[0] as ResponseRow;
}

/** 학생 화면에는 사진 저장 위치를 보내지 않고 파일 이름·크기만 보낸다. */
export function toPublic(row: ResponseRow) {
  const strip = (p: PhotoInfo | null) => (p ? { name: p.name, size: p.size, uploadedAt: p.uploadedAt } : null);
  return {
    ...row,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    photo_official: strip(row.photo_official),
    photo_free: strip(row.photo_free),
  };
}

export function photoPrefix(grade: number, classNo: number, kind: PhotoKind) {
  return `photos/${grade}-${classNo}/${kind}/`;
}
