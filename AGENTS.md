<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 교지 학급 프로필 (class-form)

2026학년도 백영고 교지 편집부 학년별 학급 프로필 & 단체 인터뷰지 수집 앱. 1~3학년 × 12반, 반을 처음 연 학생이 "시작"하면 그 반 코드가 만들어져 화면에 표시된다(캡처 안내). 이후에는 그 코드를 입력해야 그 반만 보고 작성·수정한다. 단체사진 2장(공식/자유)을 비공개 저장소에 올린다. 관리자(교지 편집부)는 비밀번호로 들어가 답변·사진 확인, CSV 내려받기, 저장 기록 되돌리기, 마감을 한다.

## 플랫폼 식별자 (다른 프로젝트와 섞지 말 것)
- GitHub: `youngjijung81-cell/class-form` (public, https://github.com/youngjijung81-cell/class-form), 브랜치 `main`
- Vercel: 프로젝트 `class-form`, projectId `prj_X4MHvRoVQ1m53Dd1ALIF5Ng8ZuDc`, orgId `team_iogzRgUzWCusnCB7XCvZNx9O` (youngjijung81-9685)
- Production URL: https://class-form.vercel.app
- DB: Vercel Marketplace Neon (`class-form-db`, 무료), 환경변수 `DATABASE_URL`. 스키마는 `scripts/schema.sql`
- 사진: Vercel Blob 비공개 스토어 `class-form-photos`, 환경변수 `BLOB_READ_WRITE_TOKEN`
- 서버 비밀값: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (Vercel 환경변수). 관리자 비밀번호 원문은 로컬 `~/.config/class-form/admin-password.txt`(Git 밖)
- Supabase는 쓰지 않는다.

## 접근 통제
- 반 코드: `class_codes` 테이블(반마다 6자리, `claimed_at`이 null이면 시작 전). `/api/class-claim`이 시작 전인 반을 원자적으로 차지하고 새 코드를 발급한다. 관리자는 '새 코드'(재발급)·'초기화'(시작 전으로)를 할 수 있다. 코드가 맞으면 그 반 전용 서명 쿠키(`cf_class_{학년}_{반}`, 60일)를 준다. 코드를 재발급하면 예전 쿠키는 무효. 반 내용 읽기·저장·사진 업로드는 그 반 쿠키 또는 관리자 쿠키가 있어야 한다. 코드 생성은 `scripts/seed-codes.mjs`.
- `/api/status`는 반별 개수(답변 수·사진 수)만 공개한다.
- DB 연결 문자열은 서버에서만 쓴다. 학생 화면 API는 답변 읽기·쓰기만 하고 사진 저장 경로는 내보내지 않는다.
- 사진은 비공개 Blob. `/api/admin/photo`가 관리자 쿠키를 확인한 뒤 DB에 등록된 경로만 전달한다.
- 저장할 때마다 이전 상태를 `response_history`에 남긴다.
