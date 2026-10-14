'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CLASS_COUNT, FORMS, FORM_INTRO, FORM_TITLE, GRADES } from '@/lib/questions';

type Status = { grade: number; class_no: number; updated_at: string | null; answered: number; photos: number };

export default function Home() {
  const [grade, setGrade] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState<Map<string, Status>>(new Map());
  const [closed, setClosed] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('cf_grade'));
      if (saved === 1 || saved === 2 || saved === 3) setGrade(saved);
    } catch {}
    const load = async (retry: boolean): Promise<any> => {
      try {
        const r = await fetch('/api/status');
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(d.error);
        return d;
      } catch (e) {
        if (!retry) throw e;
        await new Promise((res) => setTimeout(res, 1500));
        return load(false);
      }
    };
    load(true)
      .then((d) => {
        setClosed(!!d.closed);
        setStatus(new Map((d.classes as Status[]).map((s) => [`${s.grade}-${s.class_no}`, s])));
      })
      .catch(() => setLoadError('진행 상황을 불러오지 못했어요. 반을 눌러 작성은 할 수 있어요.'));
  }, []);

  const pick = (g: 1 | 2 | 3) => {
    setGrade(g);
    try {
      localStorage.setItem('cf_grade', String(g));
    } catch {}
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <p className="text-sm font-semibold tracking-wide text-accent">2026학년도 백영고 교지 편집부</p>
      <h1 className="mt-2 text-2xl font-bold leading-snug sm:text-3xl">학년별 학급 프로필 &amp; 단체 인터뷰지</h1>
      <p className="mt-4 leading-relaxed text-muted">{FORM_INTRO}</p>

      {closed && (
        <div className="mt-6 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 font-medium text-accent">
          제출이 마감되었어요. 작성한 내용은 볼 수 있지만 고칠 수는 없어요.
        </div>
      )}

      <section className="mt-6 rounded-2xl border-2 border-accent/40 bg-accent-soft p-5">
        <h2 className="text-lg font-bold text-accent">🔑 작성하려면 &lsquo;우리 반 코드&rsquo;가 필요해요</h2>
        <ol className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink">
          <li>
            <b>1.</b> 교지 편집부 선생님께 받은 <b>6자리 반 코드</b>를 준비해요. (예: <span className="font-mono font-bold">K7M3QX</span>)
          </li>
          <li>
            <b>2.</b> 아래에서 학년을 고르고 <b>우리 반</b>을 눌러요.
          </li>
          <li>
            <b>3.</b> 코드를 입력하면 우리 반 인터뷰지가 열려요. 한 번 입력하면 그 기기에서는 다시 묻지 않아요.
          </li>
        </ol>
        <p className="mt-3 text-xs text-muted">
          코드는 우리 반 내용을 지키는 열쇠예요. 다른 반 친구에게 알려 주지 마세요. 코드를 잃어버렸다면 교지 편집부 선생님께 다시 물어보세요.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold">우리 반 고르기</h2>
        <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="학년">
          {GRADES.map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={grade === g}
              onClick={() => pick(g)}
              className={`rounded-xl px-3 py-3 text-base font-bold transition ${
                grade === g ? 'bg-ink text-white' : 'bg-paper text-ink hover:bg-line'
              }`}
            >
              {g}학년
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">{FORMS[grade].title}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: CLASS_COUNT }, (_, i) => i + 1).map((c) => {
            const s = status.get(`${grade}-${c}`);
            const done = s && s.answered === 6 && s.photos === 2;
            const started = s && (s.answered > 0 || s.photos > 0);
            return (
              <Link
                key={c}
                href={`/form/${grade}/${c}`}
                className={`flex flex-col items-center rounded-xl border px-2 py-3 transition hover:-translate-y-0.5 hover:shadow ${
                  done ? 'border-ok/40 bg-ok-soft' : started ? 'border-accent/30 bg-accent-soft' : 'border-line bg-white'
                }`}
              >
                <span className="text-lg font-bold">{c}반</span>
                <span className={`mt-1 text-xs ${done ? 'text-ok' : started ? 'text-accent' : 'text-muted'}`}>
                  {done ? '작성 완료' : started ? `답변 ${s!.answered}/6 · 사진 ${s!.photos}/2` : '아직 안 씀'}
                </span>
              </Link>
            );
          })}
        </div>
        {loadError && <p className="mt-3 text-sm text-accent">{loadError}</p>}
      </section>

      <p className="mt-6 text-center text-sm text-muted">
        저장한 뒤에도 마감 전까지 언제든 다시 들어와 고칠 수 있어요.
      </p>
      <p className="mt-10 text-center text-xs text-muted">
        <span className="sr-only">{FORM_TITLE}</span>
        <Link href="/admin" className="underline-offset-2 hover:underline">
          교지 편집부 관리
        </Link>
      </p>
    </main>
  );
}
