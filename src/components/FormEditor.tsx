'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { ANSWER_MAX, FORMS, NAME_MAX, PHOTO_GUIDE, PHOTO_KINDS, type PhotoKind } from '@/lib/questions';

type PhotoMeta = { name: string; size: number; uploadedAt: string } | null;
type Resp = {
  homeroom: string;
  writer: string;
  answers: string[];
  photo_official: PhotoMeta;
  photo_free: PhotoMeta;
  updated_at: string | null;
};
type Text = { homeroom: string; writer: string; answers: string[] };

const EMPTY: Text = { homeroom: '', writer: '', answers: ['', '', '', '', '', ''] };

function sameText(a: Text, b: Text) {
  return a.homeroom === b.homeroom && a.writer === b.writer && a.answers.every((v, i) => v === b.answers[i]);
}

function fmtTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtSize(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;
}

export default function FormEditor({ grade, classNo }: { grade: 1 | 2 | 3; classNo: number }) {
  const form = FORMS[grade];
  const draftKey = `cf_draft_${grade}_${classNo}`;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [closed, setClosed] = useState(false);
  const [text, setText] = useState<Text>(EMPTY);
  const [saved, setSaved] = useState<Text>(EMPTY);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<PhotoKind, PhotoMeta>>({ official: null, free: null });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [conflict, setConflict] = useState<Resp | null>(null);
  const [draft, setDraft] = useState<Text | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [claimed, setClaimed] = useState(true);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [shownCode, setShownCode] = useState<string | null>(null);

  const dirty = !sameText(text, saved);

  const applyServer = useCallback((r: Resp) => {
    const t = { homeroom: r.homeroom, writer: r.writer, answers: r.answers };
    setText(t);
    setSaved(t);
    setUpdatedAt(r.updated_at);
    setPhotos({ official: r.photo_official, free: r.photo_free });
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    setLoadError('');
    fetch(`/api/responses/${grade}/${classNo}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json();
        if (r.status === 401 && d.needCode) {
          setClaimed(d.claimed !== false);
          setNeedCode(true);
          return;
        }
        if (!r.ok || d.error) throw new Error(d.error);
        setNeedCode(false);
        setClosed(!!d.closed);
        applyServer(d.response);
        try {
          const raw = localStorage.getItem(draftKey);
          if (raw) {
            const local = JSON.parse(raw) as Text;
            const server = { homeroom: d.response.homeroom, writer: d.response.writer, answers: d.response.answers };
            if (!sameText(local, server)) setDraft(local);
            else localStorage.removeItem(draftKey);
          }
        } catch {}
      })
      .catch(() => setLoadError('내용을 불러오지 못했어요. 새로고침해 주세요.'))
      .finally(() => setLoading(false));
  }, [grade, classNo, draftKey, applyServer]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 저장 전 내용은 이 기기에 임시로 보관해, 창이 닫혀도 잃지 않게 한다.
  useEffect(() => {
    if (loading || needCode) return;
    try {
      if (dirty) localStorage.setItem(draftKey, JSON.stringify(text));
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [text, dirty, loading, needCode, draftKey]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async (force = false) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/responses/${grade}/${classNo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...text, updatedAt, force }),
      });
      const d = await res.json();
      if (res.status === 409) {
        setConflict(d.latest);
        return;
      }
      if (res.status === 401 && d.needCode) {
        // 쓰던 내용은 이 기기 임시 저장에 남아 있으므로, 코드를 다시 넣으면 불러올 수 있다.
        setNeedCode(true);
        return;
      }
      if (!res.ok) throw new Error(d.error || '저장하지 못했어요.');
      const t = { homeroom: d.response.homeroom, writer: d.response.writer, answers: d.response.answers };
      setSaved(t);
      setText(t);
      setUpdatedAt(d.response.updated_at);
      setConflict(null);
      setMessage({ kind: 'ok', text: '저장했어요! 언제든 다시 들어와 고칠 수 있어요.' });
    } catch (e: any) {
      setMessage({ kind: 'error', text: e.message || '저장하지 못했어요.' });
    } finally {
      setSaving(false);
    }
  };

  const setAnswer = (i: number, v: string) =>
    setText((t) => ({ ...t, answers: t.answers.map((a, j) => (j === i ? v : a)) }));

  if (newCode) {
    return (
      <CodeReveal
        grade={grade}
        classNo={classNo}
        code={newCode}
        onDone={() => {
          setNewCode(null);
          loadData();
        }}
      />
    );
  }

  if (needCode) {
    return claimed ? (
      <CodeGate grade={grade} classNo={classNo} onPass={loadData} />
    ) : (
      <StartGate grade={grade} classNo={classNo} onClaimed={setNewCode} onAlreadyClaimed={() => setClaimed(true)} />
    );
  }

  if (loading) {
    return <main className="mx-auto w-full max-w-3xl px-4 py-16 text-center text-muted">불러오는 중…</main>;
  }

  const answeredCount = text.answers.filter((a) => a.trim()).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 sm:pt-10">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← 반 고르기로 돌아가기
      </Link>
      <p className="mt-4 text-sm font-semibold text-accent">[{grade}학년] 2026학년도 백영고 교지</p>
      <h1 className="mt-1 text-2xl font-bold leading-snug sm:text-3xl">
        {grade}학년 {classNo}반 · {form.title.replace('학급 비밀 보고서: ', '')}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>{updatedAt ? `마지막 저장: ${fmtTime(updatedAt)}` : '아직 저장된 내용이 없어요.'}</span>
        <button
          className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink"
          onClick={async () => {
            if (shownCode) return setShownCode(null);
            const r = await fetch(`/api/class-code/${grade}/${classNo}`, { cache: 'no-store' });
            const d = await r.json().catch(() => ({}));
            if (r.ok) setShownCode(d.code);
            else setMessage({ kind: 'error', text: '코드를 불러오지 못했어요.' });
          }}
        >
          🔑 {shownCode ? '코드 숨기기' : '우리 반 코드 보기'}
        </button>
      </div>
      {shownCode && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
          <p className="text-xs text-muted">우리 반 코드 · 다른 기기에서 들어오거나 같은 반 친구와 함께 쓸 때 입력해요</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-accent">{shownCode}</p>
        </div>
      )}

      {loadError && <Banner tone="error">{loadError}</Banner>}
      {closed && <Banner tone="error">제출이 마감되었어요. 내용을 볼 수만 있어요.</Banner>}

      {draft && !closed && (
        <Banner tone="info">
          이 기기에 저장하지 않은 내용이 남아 있어요.
          <span className="mt-2 flex gap-2">
            <button className="rounded-lg bg-ink px-3 py-1.5 text-sm text-white" onClick={() => { setText(draft); setDraft(null); }}>
              그 내용 불러오기
            </button>
            <button className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm" onClick={() => { setDraft(null); try { localStorage.removeItem(draftKey); } catch {} }}>
              버리기
            </button>
          </span>
        </Banner>
      )}

      <section className="mt-6 rounded-2xl border border-line bg-card p-5 shadow-sm">
        <h2 className="font-bold">기본 정보</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="소속 학급">
            <div className="rounded-lg border border-line bg-paper px-3 py-2.5 text-muted">{grade}학년 {classNo}반</div>
          </Field>
          <Field label="담임선생님">
            <input
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-ink disabled:bg-paper"
              placeholder="성함"
              maxLength={NAME_MAX}
              value={text.homeroom}
              disabled={closed}
              onChange={(e) => setText({ ...text, homeroom: e.target.value })}
            />
          </Field>
          <Field label="작성자(반장)">
            <input
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-ink disabled:bg-paper"
              placeholder="이름"
              maxLength={NAME_MAX}
              value={text.writer}
              disabled={closed}
              onChange={(e) => setText({ ...text, writer: e.target.value })}
            />
          </Field>
        </div>
      </section>

      {form.questions.map((q, i) => (
        <section key={i} className="mt-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-sm font-bold text-accent">
            Q{i + 1}. [{q.tag}]
          </p>
          <h3 className="mt-1 text-lg font-bold leading-snug">{q.prompt}</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {q.examples.map((ex, k) => (
              <li key={k}>예시: {ex}</li>
            ))}
          </ul>
          <textarea
            className="mt-3 min-h-28 w-full resize-y rounded-lg border border-line bg-white px-3 py-2.5 leading-relaxed outline-none focus:border-ink disabled:bg-paper"
            placeholder="우리 반 이야기를 적어 주세요"
            maxLength={ANSWER_MAX}
            value={text.answers[i]}
            disabled={closed}
            onChange={(e) => setAnswer(i, e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-muted">
            {text.answers[i].length}/{ANSWER_MAX}
          </p>
        </section>
      ))}

      <section className="mt-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
        <h2 className="font-bold">📷 {grade}학년 단체사진 제출</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{PHOTO_GUIDE}</p>
        <p className="mt-1 text-xs text-muted">사진은 교지 편집부 선생님만 볼 수 있어요. 사진 한 장은 30MB까지 올릴 수 있어요.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(PHOTO_KINDS) as PhotoKind[]).map((kind) => (
            <PhotoSlot
              key={kind}
              grade={grade}
              classNo={classNo}
              kind={kind}
              meta={photos[kind]}
              disabled={closed}
              onDone={(r) => {
                setPhotos({ official: r.photo_official, free: r.photo_free });
                setUpdatedAt(r.updated_at);
              }}
            />
          ))}
        </div>
      </section>

      {!closed && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 text-sm">
              {conflict ? (
                <span className="text-accent">다른 사람이 먼저 저장했어요. 아래에서 골라 주세요.</span>
              ) : message ? (
                <span className={message.kind === 'ok' ? 'text-ok' : 'text-accent'}>{message.text}</span>
              ) : dirty ? (
                <span className="text-accent">저장하지 않은 내용이 있어요.</span>
              ) : (
                <span className="text-muted">답변 {answeredCount}/6 · 사진 {(photos.official ? 1 : 0) + (photos.free ? 1 : 0)}/2</span>
              )}
            </div>
            <button
              onClick={() => save(false)}
              disabled={saving || !dirty}
              className="shrink-0 rounded-xl bg-accent px-5 py-3 font-bold text-white shadow transition disabled:opacity-40"
            >
              {saving ? '저장 중…' : '저장하기'}
            </button>
          </div>
          {conflict && (
            <div className="mx-auto flex max-w-3xl flex-wrap gap-2 px-4 pb-3">
              <button className="rounded-lg bg-ink px-3 py-2 text-sm text-white" onClick={() => save(true)}>
                내가 쓴 내용으로 덮어쓰기
              </button>
              <button
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm"
                onClick={() => {
                  applyServer(conflict);
                  setConflict(null);
                  setMessage({ kind: 'ok', text: '최신 내용을 불러왔어요.' });
                }}
              >
                최신 내용 불러오기 (내 수정은 버림)
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function StartGate({
  grade,
  classNo,
  onClaimed,
  onAlreadyClaimed,
}: {
  grade: number;
  classNo: number;
  onClaimed: (code: string) => void;
  onAlreadyClaimed: () => void;
}) {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/class-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, classNo }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409) {
        alert(d.error);
        return onAlreadyClaimed();
      }
      if (!res.ok) throw new Error(d.error || '시작하지 못했어요.');
      onClaimed(d.code);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← 반 고르기로 돌아가기
      </Link>
      <div className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-accent">2026학년도 백영고 교지</p>
        <h1 className="mt-1 text-2xl font-bold">
          {grade}학년 {classNo}반
        </h1>
        <p className="mt-3 leading-relaxed">아직 아무도 시작하지 않은 반이에요.</p>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
          <li>• 시작하면 <b className="text-ink">우리 반 코드</b>가 만들어져요.</li>
          <li>• 그 코드가 있어야 다음에 다시 들어오거나 다른 기기에서 이어 쓸 수 있어요.</li>
          <li>• 우리 반 회장(또는 대표 친구)이 시작해 주세요.</li>
        </ul>
        <label className="mt-5 flex items-start gap-2 rounded-xl bg-paper px-4 py-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            저는 <b>{grade}학년 {classNo}반</b> 학생이 맞아요.
          </span>
        </label>
        <button disabled={!agree || busy} onClick={start} className="mt-4 w-full rounded-xl bg-accent py-3 font-bold text-white disabled:opacity-40">
          {busy ? '만드는 중…' : '우리 반 시작하고 코드 받기'}
        </button>
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
        <p className="mt-4 text-xs leading-relaxed text-muted">다른 반을 장난으로 시작하면 선생님이 확인해 되돌릴 수 있어요.</p>
      </div>
    </main>
  );
}

function CodeReveal({ grade, classNo, code, onDone }: { grade: number; classNo: number; code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <div className="rounded-2xl border-2 border-accent bg-card p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-accent">📸 지금 이 화면을 캡처해 두세요!</p>
        <h1 className="mt-2 text-xl font-bold">
          {grade}학년 {classNo}반 우리 반 코드
        </h1>
        <p className="mt-4 rounded-xl bg-accent-soft py-5 font-mono text-4xl font-bold tracking-[0.3em] text-accent">{code}</p>
        <p className="mt-2 text-xs text-muted">2026학년도 백영고 교지 학급 프로필</p>
        <ul className="mt-5 space-y-1.5 text-left text-sm leading-relaxed text-muted">
          <li>• 다음에 다시 들어오거나 <b className="text-ink">다른 기기</b>에서 쓸 때 이 코드를 입력해요.</li>
          <li>• 같은 반 친구와 함께 쓰려면 이 코드를 알려 주세요.</li>
          <li>• <b className="text-ink">다른 반에는 알려 주지 마세요.</b> 작성 화면의 &quot;🔑 우리 반 코드 보기&quot;로 언제든 다시 볼 수 있어요.</li>
        </ul>
        <label className="mt-5 flex items-start gap-2 rounded-xl bg-paper px-4 py-3 text-left text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>코드를 캡처했어요 (또는 적어 두었어요)</span>
        </label>
        <button disabled={!saved} onClick={onDone} className="mt-4 w-full rounded-xl bg-accent py-3 font-bold text-white disabled:opacity-40">
          작성 시작하기
        </button>
      </div>
    </main>
  );
}

function CodeGate({ grade, classNo, onPass }: { grade: number; classNo: number; onPass: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return setError('반 코드를 입력해 주세요.');
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/class-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, classNo, code }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || '확인하지 못했어요.');
      onPass();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← 반 고르기로 돌아가기
      </Link>
      <div className="mt-6 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-accent">2026학년도 백영고 교지</p>
        <h1 className="mt-1 text-2xl font-bold">
          {grade}학년 {classNo}반
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          이 반은 이미 시작됐어요. 처음 시작할 때 받은 <b className="text-ink">우리 반 코드</b>를 입력해 주세요. 한 번 입력하면 이 기기에서는 다시 묻지 않아요.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] uppercase outline-none focus:border-ink"
            placeholder="ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button disabled={busy} className="w-full rounded-xl bg-accent py-3 font-bold text-white disabled:opacity-50">
            {busy ? '확인 중…' : '들어가기'}
          </button>
          {error && <p className="text-sm text-accent">{error}</p>}
        </form>
        <div className="mt-5 rounded-xl bg-paper px-4 py-3 text-xs leading-relaxed text-muted">
          <p className="font-bold text-ink">코드를 모르면?</p>
          <p className="mt-1">처음 시작한 친구(회장)의 휴대폰 캡처 사진이나, 그 친구 화면의 &quot;🔑 우리 반 코드 보기&quot;에서 확인할 수 있어요.</p>
          <p className="mt-1">코드를 잃어버렸거나, 우리 반이 아닌 사람이 먼저 시작한 것 같다면 교지 편집부 선생님께 말씀드리세요. 선생님이 다시 시작할 수 있게 해 주세요.</p>
          <p className="mt-1">코드가 맞는데도 안 되면, 학년·반을 잘못 고르지 않았는지 확인해 주세요.</p>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Banner({ tone, children }: { tone: 'info' | 'error'; children: React.ReactNode }) {
  return (
    <div
      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
        tone === 'error' ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line bg-white text-ink'
      }`}
    >
      {children}
    </div>
  );
}

function PhotoSlot({
  grade,
  classNo,
  kind,
  meta,
  disabled,
  onDone,
}: {
  grade: number;
  classNo: number;
  kind: PhotoKind;
  meta: PhotoMeta;
  disabled: boolean;
  onDone: (r: Resp) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    // 일부 안드로이드 폰은 파일 종류를 비워서 보내므로 확장자로도 판단한다.
    const extType: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };
    const type = file.type || extType[file.name.split('.').pop()?.toLowerCase() ?? ''] || '';
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(type)) {
      setError('JPG, PNG, WEBP, HEIC 사진만 올릴 수 있어요.');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError('사진이 30MB보다 커요.');
      return;
    }
    const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
    setProgress(0);
    try {
      const blob = await upload(`photos/${grade}-${classNo}/${kind}/photo.${ext}`, file, {
        access: 'private',
        handleUploadUrl: '/api/upload',
        clientPayload: JSON.stringify({ grade, classNo, kind }),
        contentType: type,
        multipart: file.size > 8 * 1024 * 1024,
        onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
      });
      const res = await fetch(`/api/responses/${grade}/${classNo}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, pathname: blob.pathname, name: file.name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onDone(d.response);
    } catch (e: any) {
      setError(e?.message?.includes('마감') ? e.message : '사진을 올리지 못했어요. 다시 시도해 주세요.');
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${meta ? 'border-ok/40 bg-ok-soft' : 'border-dashed border-line bg-white'}`}>
      <p className="font-bold">{PHOTO_KINDS[kind]}</p>
      {meta ? (
        <p className="mt-1 break-all text-sm text-ok">
          ✓ 올림: {meta.name} ({fmtSize(meta.size)})
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">아직 올리지 않았어요.</p>
      )}
      {progress !== null ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">올리는 중… {progress}%</p>
        </div>
      ) : (
        !disabled && (
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:border-ink"
          >
            {meta ? '다른 사진으로 바꾸기' : '사진 올리기'}
          </button>
        )
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
    </div>
  );
}
