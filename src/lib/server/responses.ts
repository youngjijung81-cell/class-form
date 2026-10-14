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

// 저장 직전 상태를 기록해 두어 덮어쓰기·장난을 관리자가 되돌릴 수 있게 한다.
async function snapshot(grade: number, classNo: number, reason: string) {
  const sql = getSql();
  await sql`
    insert into response_history (grade, class_no, reason, snapshot)
    select grade, class_no, ${reason}, to_jsonb(r) - 'grade' - 'class_no'
    from responses r where grade = ${grade} and class_no = ${classNo}`;
}

/** expectedUpdatedAt이 현재 값과 다르면(다른 사람이 먼저 저장) null을 돌려준다. */
export async function saveText(
  grade: number,
  classNo: number,
  input: TextInput,
  expectedUpdatedAt: string | null,
  force: boolean
): Promise<ResponseRow | null> {
  const sql = getSql();
  const current = await getRow(grade, classNo);
  if (!force && (current.updated_at ? new Date(current.updated_at).toISOString() : null) !== expectedUpdatedAt) {
    return null;
  }
  await snapshot(grade, classNo, 'text');
  const rows = await sql`
    insert into responses (grade, class_no, homeroom, writer, answers, updated_at)
    values (${grade}, ${classNo}, ${input.homeroom}, ${input.writer}, ${JSON.stringify(input.answers)}::jsonb, now())
    on conflict (grade, class_no) do update
      set homeroom = excluded.homeroom, writer = excluded.writer, answers = excluded.answers, updated_at = now()
    returning grade, class_no, homeroom, writer, answers, photo_official, photo_free, updated_at`;
  return rows[0] as ResponseRow;
}

export async function savePhoto(grade: number, classNo: number, kind: PhotoKind, info: PhotoInfo): Promise<ResponseRow> {
  const sql = getSql();
  await snapshot(grade, classNo, `photo_${kind}`);
  const json = JSON.stringify(info);
  const rows =
    kind === 'official'
      ? await sql`
          insert into responses (grade, class_no, photo_official, updated_at)
          values (${grade}, ${classNo}, ${json}::jsonb, now())
          on conflict (grade, class_no) do update set photo_official = excluded.photo_official, updated_at = now()
          returning grade, class_no, homeroom, writer, answers, photo_official, photo_free, updated_at`
      : await sql`
          insert into responses (grade, class_no, photo_free, updated_at)
          values (${grade}, ${classNo}, ${json}::jsonb, now())
          on conflict (grade, class_no) do update set photo_free = excluded.photo_free, updated_at = now()
          returning grade, class_no, homeroom, writer, answers, photo_official, photo_free, updated_at`;
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
