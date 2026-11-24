-- ============================================================
--  بررسی سلامت دیتابیس دیتاتایم (verify.sql)
--  در SQL Editor اجرا کنید و خروجی هر بخش را با «مورد انتظار» مقایسه کنید.
--
--  ⚠ نکته: SQL Editor با نقش postgres اجرا می‌شود و RLS را دور می‌زند؛
--  پس این فایل فقط «ساختار» را چک می‌کند. تست واقعی RLS در بخش
--  «تست‌های رفتاری» (مرورگر) انجام می‌شود.
-- ============================================================

-- ─── ۱) جدول‌های موجود ───
-- مورد انتظار: ۴ ردیف
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- ─── ۲) ستون‌های هر جدول ───
-- مورد انتظار: ستون‌های مطابق README برای هر ۴ جدول
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- ─── ۳) RLS روی همه‌ی جدول‌ها فعال باشد ───
-- مورد انتظار: هر ۴ ردیف rls_enabled = true
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('agents','articles','sales','views')
order by relname;

-- ─── ۴) سیاست‌های RLS ───
-- مورد انتظار: ۹ ردیف دقیقاً به این شکل:
--
-- agents   | agents_delete_auth    | DELETE | {authenticated}
-- agents   | agents_insert_auth    | INSERT | {authenticated}
-- agents   | agents_select_public  | SELECT | {anon,authenticated}
-- agents   | agents_update_auth    | UPDATE | {authenticated}
-- articles | articles_select_public| SELECT | {anon,authenticated}
-- sales    | sales_insert_public   | INSERT | {anon,authenticated}
-- sales    | sales_select_auth     | SELECT | {authenticated}
-- views    | views_insert_public   | INSERT | {anon,authenticated}
-- views    | views_select_auth     | SELECT | {authenticated}
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- ─── ۵) تست درج/حذف (SQL Editor با نقش postgres اجرا می‌شود) ───
insert into sales (id, customer, phone, date, ts, agent_name, valid)
values (
  'sql-self-test',
  'تست داخلی',
  '0000',
  to_char(now(), 'YYYY-MM-DD'),
  extract(epoch from now())::bigint,
  'sql',
  false
);

-- مورد انتظار: after_insert = 1
select count(*) as after_insert from sales where id = 'sql-self-test';

delete from sales where id = 'sql-self-test';

-- مورد انتظار: after_delete = 0
select count(*) as after_delete from sales where id = 'sql-self-test';
