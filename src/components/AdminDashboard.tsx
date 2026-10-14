'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CLASS_COUNT, FORMS, GRADES, PHOTO_KINDS, type PhotoKind } from '@/lib/questions';

type Photo = { name: string; size: number; uploadedAt: string } | null;
type Row = {
  grade: number;
  class_no: number;
  homeroom: string;
  writer: string;
  answers: string[];
  photo_official: Photo;
  photo_free: Photo;
  updated_at: string | null;
};
type History = { id: number; reason: string; snapshot: Omit<Row, 'grade' | 'class_no'>; saved_at: string };

const REASON: Record<string, string> = {
  text: '글 저장 전',
  photo_official: '공식 사진 교체 전',
  photo_free: '자유 사진 교체 전',
  before_restore: '되돌리기 전',
};

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [rows, setRows] = useState<Map<string, Row>>(new Map());
  const [closed, setClosed] = useState(false);
  const [grade, setGrade] = useState<1 | 2 | 3>(1);
  const [open, setOpen] = useState<{ grade: 1 | 2 | 3; classNo: number } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/responses', { cache: 'no-store' });
    if (res.status === 401) return setAuthed(false);
    const d = await res.json();
    setAuthed(true);
    setClosed(!!d.closed);
    setRows(new Map((d.responses as Row[]).map((r) => [`${r.grade}-${r.class_no}`, r])));
  }, []);

  useEffect(() => {
    load().catch(() => setAuthed(false));
  }, [load]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return setLoginError((await res.json()).error || '로그인하지 못했어요.');
    setPassword('');
    load();
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
    setRows(new Map());
  };

  const toggleClosed = async () => {
    const next = !closed;
    if (!confirm(next ? '제출을 마감할까요? 학생들이 더 이상 고칠 수 없게 돼요.' : '마감을 풀까요? 다시 작성·수정할 수 있게 돼요.')) return;
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: next }),
    });
    if (res.ok) setClosed(next);
  };

  if (authed === null) return <main className="p-16 text-center text-muted">불러오는 중…</main>;

  if (!authed) {
    return (
      <main className="mx-auto w-full max-w-sm px-4 py-16">
        <h1 className="text-xl font-bold">교지 편집부 관리</h1>
        <form onSubmit={login} className="mt-6 space-y-3">
          <input
            type="password"
            autoComplete="current-password"
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-ink"
            placeholder="관리자 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="w-full rounded-lg bg-ink py-2.5 font-bold text-white">들어가기</button>
          {loginError && <p className="text-sm text-accent">{loginError}</p>}
        </form>
        <Link href="/" className="mt-8 block text-center text-sm text-muted">
          ← 처음 화면
        </Link>
      </main>
    );
  }

  const all = [...rows.values()];
  const total = GRADES.length * CLASS_COUNT;
  const doneCount = all.filter((r) => r.answers.every((a) => a.trim()) && r.photo_official && r.photo_free).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold">교지 편집부 관리</h1>
        <a href="/api/admin/export" className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">
          전체 답변 엑셀(CSV) 받기
        </a>
        <button onClick={toggleClosed} className={`rounded-lg px-4 py-2 text-sm font-bold ${closed ? 'bg-ok text-white' : 'border border-accent text-accent'}`}>
          {closed ? '마감 풀기' : '제출 마감하기'}
        </button>
        <button onClick={logout} className="text-sm text-muted underline-offset-2 hover:underline">
          로그아웃
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        전체 {total}개 반 중 작성 완료 {doneCount}개 · 작성 시작 {all.length}개 · 현재 {closed ? '마감됨' : '제출 받는 중'}
      </p>

      <div className="mt-6 flex gap-2">
        {GRADES.map((g) => (
          <button key={g} onClick={() => setGrade(g)} className={`rounded-lg px-4 py-2 font-bold ${grade === g ? 'bg-ink text-white' : 'bg-card border border-line'}`}>
            {g}학년
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-paper text-left text-muted">
            <tr>
              <th className="px-3 py-2">반</th>
              <th className="px-3 py-2">담임</th>
              <th className="px-3 py-2">작성자</th>
              <th className="px-3 py-2">답변</th>
              <th className="px-3 py-2">사진</th>
              <th className="px-3 py-2">최종 저장</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: CLASS_COUNT }, (_, i) => i + 1).map((c) => {
              const r = rows.get(`${grade}-${c}`);
              const answered = r ? r.answers.filter((a) => a.trim()).length : 0;
              const photos = r ? (r.photo_official ? 1 : 0) + (r.photo_free ? 1 : 0) : 0;
              return (
                <tr key={c} className="border-t border-line">
                  <td className="px-3 py-2 font-bold">{c}반</td>
                  <td className="px-3 py-2">{r?.homeroom || '-'}</td>
                  <td className="px-3 py-2">{r?.writer || '-'}</td>
                  <td className={`px-3 py-2 ${answered === 6 ? 'text-ok font-bold' : ''}`}>{answered}/6</td>
                  <td className={`px-3 py-2 ${photos === 2 ? 'text-ok font-bold' : ''}`}>{photos}/2</td>
                  <td className="px-3 py-2 text-muted">{fmt(r?.updated_at ?? null)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setOpen({ grade, classNo: c })} className="rounded-lg border border-line px-3 py-1 hover:border-ink">
                      자세히
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <Detail
          grade={open.grade}
          classNo={open.classNo}
          row={rows.get(`${open.grade}-${open.classNo}`)}
          onClose={() => setOpen(null)}
          onRestored={load}
        />
      )}
    </main>
  );
}

function Detail({
  grade,
  classNo,
  row,
  onClose,
  onRestored,
}: {
  grade: 1 | 2 | 3;
  classNo: number;
  row?: Row;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [history, setHistory] = useState<History[] | null>(null);
  const form = FORMS[grade];

  const loadHistory = async () => {
    const res = await fetch(`/api/admin/history?grade=${grade}&classNo=${classNo}`, { cache: 'no-store' });
    const d = await res.json();
    setHistory(d.history ?? []);
  };

  const restore = async (h: History) => {
    if (!confirm(`${fmt(h.saved_at)} 기록으로 되돌릴까요? 지금 내용도 기록으로 남아요.`)) return;
    const res = await fetch('/api/admin/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: h.id }),
    });
    if (res.ok) {
      onRestored();
      onClose();
    } else alert('되돌리지 못했어요.');
  };

  const photoUrl = (kind: PhotoKind, download = false) =>
    `/api/admin/photo?grade=${grade}&classNo=${classNo}&kind=${kind}${download ? '&download=1' : ''}`;

  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-3xl rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-xl font-bold">
              {grade}학년 {classNo}반
            </h2>
            <p className="text-sm text-muted">
              담임 {row?.homeroom || '-'} · 작성자 {row?.writer || '-'} · 최종 저장 {fmt(row?.updated_at ?? null)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1 text-sm">
            닫기
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {form.questions.map((q, i) => (
            <div key={i}>
              <p className="text-sm font-bold text-accent">
                Q{i + 1}. [{q.tag}] <span className="font-normal text-muted">{q.prompt}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-paper px-3 py-2">{row?.answers[i]?.trim() || <span className="text-muted">(비어 있음)</span>}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(Object.keys(PHOTO_KINDS) as PhotoKind[]).map((kind) => {
            const p = kind === 'official' ? row?.photo_official : row?.photo_free;
            return (
              <div key={kind} className="rounded-xl border border-line p-3">
                <p className="font-bold">{PHOTO_KINDS[kind]}</p>
                {p ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl(kind)} alt={`${grade}학년 ${classNo}반 ${PHOTO_KINDS[kind]}`} className="mt-2 max-h-64 w-full rounded-lg bg-paper object-contain" />
                    <p className="mt-1 break-all text-xs text-muted">{p.name}</p>
                    <a href={photoUrl(kind, true)} className="mt-2 inline-block rounded-lg bg-ink px-3 py-1.5 text-sm text-white">
                      원본 받기
                    </a>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">아직 없음</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 border-t border-line pt-4">
          {history === null ? (
            <button onClick={loadHistory} className="text-sm text-muted underline underline-offset-2">
              이전 저장 기록 보기 (실수·장난으로 바뀐 내용 되돌리기)
            </button>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted">이전 기록이 없어요.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-paper px-3 py-2">
                  <span className="font-medium">{fmt(h.saved_at)}</span>
                  <span className="text-muted">{REASON[h.reason] ?? h.reason}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {h.snapshot.writer || '-'} · 답변 {(h.snapshot.answers ?? []).filter((a) => a?.trim()).length}/6 · Q1: {(h.snapshot.answers?.[0] ?? '').slice(0, 30)}
                  </span>
                  <button onClick={() => restore(h)} className="rounded-lg border border-line bg-white px-2 py-1">
                    이 상태로 되돌리기
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
