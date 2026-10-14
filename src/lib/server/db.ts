import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

// 빌드 중에는 DATABASE_URL이 없을 수 있으므로 처음 쓸 때 연결한다.
export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다.');
    _sql = neon(url);
  }
  return _sql;
}

/** 읽기 전용 조회가 순간적인 연결 실패로 끝나지 않도록 잠깐 쉬었다가 한 번 더 시도한다. */
export async function withReadRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
    return fn();
  }
}
