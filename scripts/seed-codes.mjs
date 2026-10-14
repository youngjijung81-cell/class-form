// 사용법: node --env-file=.env.local scripts/seed-codes.mjs
// 아직 코드가 없는 반에만 코드를 만든다. 코드는 화면에 출력하지 않는다(관리자 화면에서 확인).
import { randomInt } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
let created = 0;
for (let g = 1; g <= 3; g++) {
  for (let c = 1; c <= 12; c++) {
    for (let tries = 0; tries < 5; tries++) {
      try {
        const r = await sql`insert into class_codes (grade, class_no, code) values (${g}, ${c}, ${makeCode()})
                            on conflict (grade, class_no) do nothing returning grade`;
        created += r.length;
        break;
      } catch (e) {
        if (!String(e.message).includes('unique')) throw e;
      }
    }
  }
}
const total = await sql`select count(*)::int as n from class_codes`;
console.log(`새로 만든 코드 ${created}개, 전체 ${total[0].n}개`);
