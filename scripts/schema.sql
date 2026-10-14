create table if not exists responses (
  grade smallint not null check (grade between 1 and 3),
  class_no smallint not null check (class_no between 1 and 12),
  homeroom text not null default '' check (char_length(homeroom) <= 30),
  writer text not null default '' check (char_length(writer) <= 30),
  answers jsonb not null default '["","","","","",""]'::jsonb check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) = 6),
  photo_official jsonb,
  photo_free jsonb,
  updated_at timestamptz,
  primary key (grade, class_no)
);

create table if not exists response_history (
  id bigserial primary key,
  grade smallint not null,
  class_no smallint not null,
  reason text not null,
  snapshot jsonb not null,
  saved_at timestamptz not null default now()
);
create index if not exists response_history_class_idx on response_history (grade, class_no, saved_at desc);

create table if not exists settings (
  key text primary key,
  value text not null
);
insert into settings (key, value) values ('closed', 'false') on conflict do nothing;

-- 반별 입장 코드. 회장은 자기 반 코드로만 그 반을 보고 고칠 수 있다.
create table if not exists class_codes (
  grade smallint not null check (grade between 1 and 3),
  class_no smallint not null check (class_no between 1 and 12),
  code text not null unique,
  created_at timestamptz not null default now(),
  primary key (grade, class_no)
);

-- 처음 들어온 학생이 그 반을 시작(코드 발급)한 시각. null이면 아직 아무도 시작하지 않은 반.
alter table class_codes add column if not exists claimed_at timestamptz;
