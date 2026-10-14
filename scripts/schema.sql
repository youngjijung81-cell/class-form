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
