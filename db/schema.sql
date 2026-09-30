-- TuXianDB schema. Every fact carries a chapter interval [from_ch, to_ch): spoiler-gating is a WHERE clause.
-- Idempotent: safe to run on every deploy (`npm run db:migrate`).

create table if not exists novel (
  id            serial primary key,
  slug          text unique not null,
  title_zh      text not null,
  title_vi      text not null,
  author_vi     text not null default '',
  chapter_count int  not null check (chapter_count > 0),
  realms        jsonb not null default '[]',        -- [{zh, vi}] from low to high
  cover         text not null default '#1A2847',
  is_sample     boolean not null default false,     -- seeded demo data, shown with a banner
  is_live       boolean not null default false      -- listed on the site
);

create table if not exists entity (
  id            serial primary key,
  novel_id      int  not null references novel on delete cascade,
  type          text not null check (type in ('character', 'faction', 'location')),
  name_zh       text not null,
  name_vi       text not null,
  pinyin        text not null default '',
  slug          text not null,
  first_ch      int  not null,
  intro_safe    text not null default '',           -- written only from the first appearance
  role          text not null default 'phu' check (role in ('chinh', 'phu')),
  mention_total int  not null default 0,
  unique (novel_id, type, name_zh),
  unique (novel_id, type, slug)
);

create table if not exists alias (
  id         serial primary key,
  entity_id  int  not null references entity on delete cascade,
  name       text not null,                         -- as written in the novel: 韩师弟
  name_vi    text not null default '',              -- Hán Việt: Hàn sư đệ
  pinyin     text not null default '',
  search     text not null,                         -- normalize(name_vi + ' ' + pinyin): "han su de han shi di"
  note       text not null default '',
  first_ch   int  not null,
  unique (entity_id, name)
);
create index if not exists alias_search_idx on alias (search text_pattern_ops);

create table if not exists fact (
  id          serial primary key,
  entity_id   int  not null references entity on delete cascade,
  attr        text not null check (attr in ('realm', 'faction', 'location', 'status')),
  value       text not null,                        -- Vietnamese display value
  value_zh    text not null default '',
  from_ch     int  not null,
  to_ch       int,                                  -- exclusive; null = still true at the latest chapter
  evidence_ch int[] not null default '{}',
  confidence  real not null default 0.5,
  review      text not null default 'auto' check (review in ('auto', 'verified', 'disputed', 'rejected')),
  flag        text not null default '',             -- why the pipeline wants a human: realm_regression, after_death…
  check (to_ch is null or to_ch > from_ch)
);
create index if not exists fact_entity_idx on fact (entity_id);

-- (a, b, 'master') means b is a's master. Symmetric types are stored once with a_id < b_id.
create table if not exists relation (
  id          serial primary key,
  a_id        int  not null references entity on delete cascade,
  b_id        int  not null references entity on delete cascade,
  type        text not null check (type in ('master', 'friend', 'enemy', 'kin', 'dao_companion', 'colleague', 'acquaintance')),
  from_ch     int  not null,
  to_ch       int,
  evidence_ch int[] not null default '{}',
  confidence  real not null default 0.5,
  review      text not null default 'auto' check (review in ('auto', 'verified', 'disputed', 'rejected')),
  flag        text not null default '',
  unique (a_id, b_id, type),
  check (a_id <> b_id),
  check (to_ch is null or to_ch > from_ch)
);
create index if not exists relation_b_idx on relation (b_id);

create table if not exists mention (
  entity_id int not null references entity on delete cascade,
  chapter   int not null,
  count     int not null,
  primary key (entity_id, chapter)
);

-- Short source quotes for reviewers only. Never rendered on public pages.
create table if not exists evidence (
  target_type text not null check (target_type in ('fact', 'relation')),
  target_id   int  not null,
  chapter     int  not null,
  quote       text not null
);
create index if not exists evidence_target_idx on evidence (target_type, target_id);

create table if not exists alias_conflict (
  id         serial primary key,
  novel_id   int  not null references novel on delete cascade,
  surface    text not null,
  candidates jsonb not null,                        -- [{name_zh, chapters}]
  chapters   int[] not null default '{}',
  status     text not null default 'open' check (status in ('open', 'resolved')),
  unique (novel_id, surface)
);

create table if not exists report (
  id          serial primary key,
  novel_id    int  not null references novel on delete cascade,
  target_type text not null check (target_type in ('fact', 'relation', 'alias', 'entity')),
  target_id   int  not null,
  message     text not null check (length(message) between 3 and 1000),
  ip_hash     text not null,
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now()
);
create index if not exists report_open_idx on report (status, created_at);
create index if not exists report_ip_idx on report (ip_hash, created_at);
