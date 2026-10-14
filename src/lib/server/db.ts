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
