create table if not exists devices (
  id text not null primary key,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists metrics (
  id bigserial not null primary key,
  device_id text not null references devices(id),
  power numeric not null,
  temperature numeric not null,
  timestamp timestamptz not null,
  received_at timestamptz not null default now()
);

create table if not exists device_latest (
  device_id text not null primary key references devices(id),
  power numeric not null,
  temperature numeric not null,
  timestamp timestamptz not null,
  received_at timestamptz not null,
  status text not null check (status in ('normal', 'warning', 'critical')),
  updated_at timestamptz not null default now()
);

create index if not exists idx_metrics_device_timestamp_desc on metrics(device_id, timestamp desc);
create index if not exists idx_device_latest_status on device_latest(status);
create index if not exists idx_device_latest_timestamp_desc on device_latest(timestamp desc);
create index if not exists idx_devices_name on devices(name);
