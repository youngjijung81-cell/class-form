# dorms-check 점검 리포트

- 앱: 교지 학급 프로필
- 주소: https://class-form.vercel.app 
- 스택: Next.js
- 점검 트랙: security

> 이 리포트는 dorms-check(코치)의 자체 점검 결과입니다. 마크는 도름스가 공개 주소를 다시 확인해 발급합니다. 이 결과는 내부 기능까지 모두 안전하다는 뜻은 아닙니다.

## 보안 최소 점검

- 결과: 공개 화면 최소 점검 완료
- 확인 28건 · 미확인 7건 · 해당 없음 1건
- 점검 범위 밖의 내부 기능과 자료까지 안전하다는 뜻은 아닙니다.

### 보완하면 좋은 항목

- Content-Security-Policy: content-security-policy 보완 권장: 누락
- CORS 설정: 와일드카드(*) 허용 — 공개 API면 무방, 인증 API면 위험
- 이용약관: 이용약관 페이지/링크 없음
- Open Graph: Open Graph 태그
- canonical: canonical 링크
- 헤더 설정 위치: 헤더 설정 발견: x-frame-options, x-content-type-options, referrer-policy, permissions-policy

### 확인하지 못한 항목

- 구버전 TLS 미사용: TLS 세부 버전은 별도로 측정하지 않았습니다.
- 비공개 인증정보·민감 자료 노출: 받은 본문에서 민감정보가 확인되지 않았습니다. 일부 추가 경로는 확인하지 못했습니다.
- 설정 파일 노출: 추가로 확인된 설정 자료가 없습니다.
- 개인정보처리방침: 받은 HTML과 확인한 주소에서 방침을 찾지 못했습니다. 앱 안 팝업이나 로그인 뒤 화면은 확인하지 않았습니다.
- 익명 접근 차단(Supabase RLS): 공개 응답에서 점검에 필요한 DB 주소와 공개 키를 찾지 못했습니다. 내부 데이터 접근 권한은 확인하지 않았습니다.
- 익명 접근 차단(Firebase 규칙): 공개 응답에서 Firebase 실시간 DB 주소를 찾지 못했습니다. 내부 접근 권한은 확인하지 않았습니다.
- 미인증 API 접근: 공개 응답에서 점검할 내부 API 경로를 찾지 못했습니다.

### 확인한 항목

- 공개 화면: 공개 HTTPS 응답과 받은 본문을 확인했습니다.
- Strict-Transport-Security: strict-transport-security 설정 확인
- 클릭재킹 방어(X-Frame-Options / frame-ancestors): x-frame-options 설정 확인
- X-Content-Type-Options: nosniff: x-content-type-options 설정 확인
- Referrer-Policy: referrer-policy 설정 확인
- Permissions-Policy: permissions-policy 설정 확인
- 서버/프레임워크 버전 노출: x-powered-by 미노출(양호)
- HTTPS 강제(HTTP→HTTPS 리다이렉트): HTTP 308 -> https://class-form.vercel.app/
- SSL 인증서 유효: HTTPS 연결을 확인했습니다.
- 소스맵 노출: 소스맵 참조 없음
- 에러 스택트레이스 노출: 스택트레이스 노출 없음
- Mixed Content: mixed content 없음
- 연락처: 연락처/문의 정보 있음
- 페이지 제목: <title> 있음
- 설명 메타: 설명 메타
- 모바일 viewport: viewport 메타
- 응답 속도: 응답 시간 168ms
- 문서 크기: 문서 크기 12KB
- 압축: 압축: br
- 하드코딩 시크릿: 하드코딩 시크릿 미검출
- 클라이언트 시크릿 노출: 클라 시크릿 노출 미검출
- 위험 코드 패턴(검토 후보): 위험 코드 패턴 미검출

### 해당 없는 항목

- 쿠키 보안 플래그(HttpOnly/Secure): 응답에 쿠키 없음

