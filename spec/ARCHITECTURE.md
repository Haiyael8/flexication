# Flexication - Architecture

מסמך ארכיטקטורה: תכנון טכני על ה-Technology Stack שאושר.
תאריך: 13.10.2026. עודכן: 17.10.2026. סטטוס: טיוטה לאישור.

מקורות: PRD.md, tech-stack.md, course-stack.md ו-product-10-definitions.md.
המסמך נכתב כך ש-AI יוכל לבנות לפיו. כל החלטה שלא כתובה במקורות מסומנת **החלטה**, ולצידה משפט נימוק.
אין במסמך Milestones, משימות או לוחות זמנים.

## 0. תקציר והחלטות לאישור

### בדיקת סתירות
לא נמצאה סתירה בין ה-PRD, עשרת ההיבטים וה-Technology Stack.
נמצאו שני מקומות שבהם התכנון פוגש כלל של course-stack.md. לפי הכלל "אל תחרוג בלי לשאול", אני מציג אותם לאישור:

1. **שתי פונקציות SQL בתוך Supabase** (`my_role` ו-`has_counted_request`).
   - הצורך: התפקיד נקבע בעמודה בטבלה (PRD, FR-20), ו-Postgres נכשל ב-"infinite recursion" כשכלל הרשאה בטבלה קורא לאותה טבלה. פונקציה מסוג security definer פותרת זאת. בדקתי את זה בהרצה (סעיף 11).
   - הכלל בסטאק: "פונקציות בתוך Supabase" מופיע ברשימת מה שלא בסטאק. **פרשנות שלי:** הכוונה ל-Edge Functions, שמחליפות את הפונקציה ב-Vercel. פונקציות SQL הן חלק מהסכמה ואינן מחליפות אותה.
   - חלופה אם לא תאשרי: לשמור את התפקיד ב-`app_metadata` של משתמש ה-Auth במקום בעמודה. זה משנה את FR-20.
2. **סוד משותף ב-Database Webhook.** Supabase קורא ל-n8n אחרי Submit ואחרי החלטת מנהל, והקריאה חייבת להיות מאומתת כדי שלא כל אחד יוכל להפעיל מיילים. הסוד נשמר בהגדרות ה-webhook בדשבורד של Supabase וב-Credentials של n8n.
   - הכלל בסטאק: מפתח סודי חי בשני מקומות בלבד (משתני הסביבה של הפונקציות, ו-n8n). זה מקום שלישי, אבל הוא לא בריפו ולא בדפדפן.
   - חלופה: n8n שואל את Supabase כל כמה דקות. זה מונע את הסוד, אבל צורך הרבה Executions ב-n8n Cloud (ראו tech-stack.md) ומאחר את המיילים.

### החלטות נוספות
| # | החלטה | נימוק |
|---|---|---|
| 1 | טעינת קובץ העובדים היא Upsert לפי אימייל, ולא מחיקה והחלפה | HR והמנהל הם שורות באותה טבלה. מחיקה תנעל אותם מחוץ למערכת אם יחסרו בקובץ |
| 2 | הסטטוס "ללא החלטה" לא נשמר. הוא נגזר: בקשה ממתינה בחלון שהסתיים | אין צורך באוטומציה (Should) כדי שכלל "פעם בשנה" יעבוד |
| 3 | טווח הימים (1 עד המקסימום) נאכף בקוד ולא במסד | החישוב נעשה בקוד בלבד, לפי course-stack.md. הסיכון: עקיפה דרך ה-API (סעיף 4.4) |
| 4 | אם שירות ה-AI נכשל, העובד יכול להמשיך | הזכאות מחושבת בקוד, ולכן הראיון אינו תנאי להגשה. ה-PRD השאיר זאת פתוח |
| 5 | n8n Cloud כברירת מחדל | כך המלצנו ב-tech-stack.md. Webhook דורש כתובת ציבורית |
| 6 | "מזהה עובד" בדו"ח ה-Payroll הוא האימייל | אין שדה מזהה אחר בקובץ העובדים |
| 7 | מספר הבקשה מוצג כ-`FLX-` ואחריו ה-`id` בשישה ספרות | ה-PRD השאיר את הפורמט פתוח |
| 8 | `days` נשמר כמספר חיובי, והסימן (`days_signed`) נקבע רק בדו"ח לפי סוג החלון | אין שינוי בסכמה, ואין סיכון לסתירה בין סוג הבקשה לסימן |

## 1. מבנה המערכת: שלוש שכבות

| שכבה | מה יש בה | טכנולוגיה | מה אסור בה |
|---|---|---|---|
| צד לקוח | ארבעה עמודים: כניסה, עובד, מנהל, HR. חישוב זכאות, סימולטור, קריאת קובץ העובדים, יצירת דו"ח | HTML, CSS ו-JavaScript ב-GitHub Pages. ספריות: `supabase-js`, `PapaParse` | מפתח סודי, קריאה ישירה למודל AI |
| לוגיקה | פונקציה אחת `api/ask.js` (ראיון AI). אוטומציות n8n (מיילים, תזכורת, דוח) | Vercel Function, n8n, Gmail | חישוב בתוך המודל |
| נתונים | שלוש טבלאות, התחברות והרשאות | Supabase (Postgres, Auth, RLS) | אחסון קבצים (לא נדרש) |

### נתיבי התקשורת
| מ | אל | איך | אימות |
|---|---|---|---|
| דפדפן | Supabase | `supabase-js`, קריאות Data API | משתמש מחובר (JWT) + מפתח Publishable |
| דפדפן | `/api/ask` ב-Vercel | `fetch`, JSON | כותרת Authorization עם ה-JWT של המשתמש |
| `/api/ask` | Supabase Auth | בדיקת ה-JWT | מפתח Publishable (ציבורי) |
| `/api/ask` | Gemini | HTTPS | מפתח Gemini ממשתנה סביבה |
| Supabase | n8n | Database Webhook | כותרת סוד משותף |
| n8n | Supabase | Node של Supabase | מפתח Secret ב-Credentials של n8n |
| n8n | Gmail | OAuth | Credentials של n8n |

הדפדפן לא פונה ל-Gemini, ל-n8n או ל-Gmail לעולם.

## 2. צד לקוח

### 2.1 עמודים ומסכים
ארבעה קבצי HTML, בלי כלי בנייה ובלי Router. בתוך כל עמוד, מצבים מוחלפים ב-JavaScript.

| עמוד | למי | מסכים מה-PRD | מה בו |
|---|---|---|---|
| `index.html` | כולם | כניסה | טופס אימייל וסיסמה. אחרי כניסה, הפניה לפי תפקיד: עובד ל-`employee.html`, מנהל ל-`manager.html`, HR ל-`hr.html` |
| `employee.html` | עובד | 1, 2, 3, 4 | מצבים: (א) Onboarding, (ב) בקשה, (ג) אישור וביצוע, (ד) מסכם. בכניסה חוזרת עם בקשה קיימת, נפתח מצב (ד) |
| `manager.html` | מנהל | 5 | Dashboard בקשות ממתינות, אישור ודחייה |
| `hr.html` | HR | (לא הוגדר) | אזור ניהול אחד: חלונות, טעינת עובדים, סטטוס בקשות, דו"ח |

**החלטה:** `index.html` הוא דף הכניסה ולא דף הנחיתה. דף נחיתה שיווקי הוא Could ואינו בהיקף.

### 2.2 מודולים (JavaScript, ES modules)
| קובץ | תפקיד |
|---|---|
| `js/config.js` | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `API_BASE_URL`. כולם ציבוריים ומותר להעלות לריפו |
| `js/supabase-client.js` | יצירת הלקוח (`createClient`) |
| `js/auth.js` | כניסה, יציאה, שליפת התפקיד, והפניה אם העמוד לא מתאים לתפקיד (הגנה לחוויה בלבד, ההגנה האמיתית ב-RLS) |
| `js/pages/*.js` | לוגיקת העמוד: `login.js`, `employee.js`, `manager.js`, `hr.js` |
| `js/ai-client.js` | קריאה ל-`/api/ask` |
| `js/csv.js` | קריאת קובץ העובדים (PapaParse) ויצירת דו"ח CSV |
| `js/ui.js` | הודעות, מצבי טעינה ושגיאה, פורמט תאריכים וסכומים |
| `lib/eligibility.js` | **משותף** לדפדפן ולפונקציה. חישוב ימי זכאות (סעיף 2.3) |
| `lib/pricing.js` | חישוב הסימולטור (סעיף 2.3) |

### 2.3 חישובים (בקוד בלבד)
הקבצים ב-`lib/` הם פונקציות טהורות בלי תלות בדפדפן, כדי שגם `api/ask.js` ייבא אותן.

**זכאות (FR-01).** כל החישובים במספרים שלמים, בלי כפל בעשרוני:
- `remaining = annual_days - used_days`
- `maxBuy = Math.floor(annual_days * 2 / 5)` (40%)
- `maxSell = used_days >= 7 ? Math.max(0, Math.min(Math.floor(annual_days / 5), remaining)) : 0` (20% מהזכאות השנתית ולא מהיתרה, ולא יותר מהיתרה, ורק למי שניצל לפחות 7 ימים)
- בחירה אפשרית רק מ-1 עד המקסימום. מקסימום 0 אומר שאין זכאות לפעולה, והכפתור חסום.

| annual_days | used_days | maxBuy | maxSell |
|---|---|---|---|
| 23 | 5 | 9 | 0 |
| 23 | 7 | 9 | 4 |
| 23 | 10 | 9 | 4 |
| 23 | 14 | 9 | 4 |
| 23 | 18 | 9 | 4 |
| 23 | 21 | 9 | 2 |
| 23 | 23 | 9 | 0 |

**סימולטור (FR-07).** קלט: שכר חודשי, אחוז משרה (1 עד 100), אחוז מס (0 עד 100). עיגול לשתי ספרות אחרי הנקודה מתבצע במספרים שלמים של אגורות, עיגול רגיל (חצי כלפי מעלה).
- `dayValueGross = round2(salary / (workPercent / 100 * 21.6))`
- `dayValueNet = round2(dayValueGross * (1 - taxPercent / 100))`
- `amountGrossSigned = ±(days * dayValueGross)`. קנייה שלילית, מכירה חיובית.
- `daysSigned = ±days`, בסימן הפוך, ורק בדו"ח: קנייה חיובית (נוספים ליתרה), מכירה שלילית (נגרעים ממנה).
- קנייה: מוצגת עלות חודשית `round2(total / 5)` על פני 5 תלושים. מכירה: זיכוי אחד בתלוש דצמבר.
- דוגמאות: שכר 15,000 ב-100% משרה נותן 694.44. ב-80% משרה נותן 868.06.
- הכפלה בימים נעשית באגורות שלמות, כדי להימנע משגיאות עשרוניות (למשל 5 כפול 694.44 צריך לתת בדיוק 3,472.20).
- הבקשה אינה שומרת שווי יום וסכום (עודכן ב-2.11.2026): הסימולטור אופציונלי והשכר נמצא במערכות ה-HR. `days` נשמר כמספר חיובי. אחוז המס והשכר אינם נשמרים.

### 2.4 תאריכים וחלונות
- "היום" נקבע לפי אזור הזמן `Asia/Jerusalem`. הקוד משתמש ב-`Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' })` לקבלת התאריך כמחרוזת `YYYY-MM-DD`.
- חלון פתוח: `start_date <= today <= end_date`.
- מסך Onboarding מציג את החלונות מטבלת `windows`, ואת תאריכי המדיניות כטקסט קבוע.

### 2.5 מצב ואחסון מקומי
- מצב הטופס (ימים, בחירה, תוצאות סימולטור, שיחת ה-AI) נשמר בזיכרון העמוד בלבד, ונעלם ברענון. זה מתיישב עם "תוצאות הסימולטור נשמרות זמנית עד Submit".
- אישור קריאת המדיניות הוא משתנה בזיכרון. ברענון, העובד מאשר שוב. (**הנחה:** זה מקובל, והאישור אינו נשמר ב-DB.)
- `localStorage` לא בשימוש באפליקציה. ספריית `supabase-js` שומרת בו את סשן ההתחברות, וזה בסדר.

### 2.6 שפה ונגישות
- `<html lang="en" dir="ltr">`, והגופן Heebo (שודרג ב-17.10.2026: המוצר באנגלית ומשמאל לימין, כחריגה מ-course-stack.md).
- Desktop בלבד: רוחב מינימלי 1024 פיקסלים (**הנחה**).
- לכל שדה `<label>`. הודעות שגיאה ב-`aria-live`. ניווט מלא במקלדת, עם סדר Tab הגיוני ו-focus נראה.
- מצב לא מועבר בצבע בלבד: ליד כל צבע יש מילה או אייקון (למשל "ממתינה לאישור", "אושרה", "נדחתה").
- ניגודיות לפי התקן, ובדיקה לפני הצגה.

## 3. נתונים

### 3.1 מודל
שלוש טבלאות. שמות באנגלית באותיות קטנות עם קו תחתון, והתוכן באנגלית.

| קשר | הסבר |
|---|---|
| `requests.window_id` מפנה ל-`windows.id` | כל בקשה שייכת לחלון אחד, וממנו נגזרים סוג הפעולה (קנייה או מכירה) ותאריך הסיום |
| `requests.employee_email` מפנה ל-`employees.email` | המבקש |
| `requests.manager_email` | טקסט חופשי שהעובד הזין. **אין מפתח זר** (אין עמודת מנהל במאגר, כנקבע ב-PRD) |
| `auth.users.email` שווה ל-`employees.email` | הקשר בין משתמש ההתחברות לשורת העובד. נוצר ידנית |

### 3.2 שדות

**`employees`** (נטען על ידי HR, ובקורס 5 שורות לפחות)
| שדה | סוג | הערות |
|---|---|---|
| `email` | text, מפתח ראשי | באותיות קטנות |
| `full_name` | text | |
| `role` | text | `employee`, `manager` או `hr` |
| `annual_days` | integer | זכאות שנתית. **הנחה:** מספר שלם |
| `updated_at` | timestamptz | |

**`windows`** (נפתחים על ידי HR)
| שדה | סוג | הערות |
|---|---|---|
| `id` | bigint, זהות אוטומטית | |
| `type` | text | `buy` או `sell` |
| `start_date`, `end_date` | date | תאריך הסיום כלול. תאריך היעד לאישור שווה לו |
| `window_year` | integer, מחושב | שנה קלנדרית של `start_date` |
| `created_at` | timestamptz | |

**`requests`**
| שדה | סוג | הערות |
|---|---|---|
| `id` | bigint, זהות אוטומטית | מספר הבקשה |
| `window_id`, `request_year` | bigint, integer | `request_year` שווה ל-`window_year` של החלון |
| `employee_email`, `employee_name` | text | עותק של שם העובד, כדי שהמנהל יראה שם בלי גישה לטבלת העובדים |
| `annual_days`, `used_days` | integer | עותק של הזכאות ושל מה שהעובד הזין, לתיעוד |
| `days` | integer | מספר הימים המבוקשים |
| `manager_email`, `senior_manager_email` | text | המנהל הבכיר הוא גיבוי בלבד |
| `declaration_accepted` | boolean | חייב להיות true |
| `status` | text | `pending`, `approved`, `rejected` |
| `decided_at`, `created_at` | timestamptz | |

### 3.3 סטטוסים
| ערך במסד | תצוגה | הערה |
|---|---|---|
| `pending` | ממתינה לאישור | |
| `approved` | אושרה | נספרת במגבלת פעם בשנה |
| `rejected` | נדחתה | לא נספרת |
| (נגזר) `pending` בחלון שהסתיים | ללא החלטה | לא נספרת. מחושב בקוד התצוגה ובפונקציית ה-SQL |

### 3.4 סכמה והרשאות (SQL)
קובץ `sql/01_schema.sql`, להרצה ב-SQL Editor של Supabase (טבלאות, פונקציות עזר, הרשאות וכללי RLS).
הקוד להלן הורץ על PostgreSQL 16 עם הדמיה מקומית של `auth.jwt()` (סעיף 11).

```sql
-- ===== טבלאות =====
create table public.employees (
  email        text primary key check (email = lower(email)),
  full_name    text not null,
  role         text not null default 'employee' check (role in ('employee', 'manager', 'hr')),
  annual_days  integer not null check (annual_days >= 0),
  updated_at   timestamptz not null default now()
);

create table public.windows (
  id           bigint generated always as identity primary key,
  type         text not null check (type in ('buy', 'sell')),
  start_date   date not null,
  end_date     date not null,
  window_year  integer generated always as (extract(year from start_date)::integer) stored,
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.requests (
  id                   bigint generated always as identity primary key,
  window_id            bigint not null references public.windows (id),
  request_year         integer not null,
  employee_email       text not null references public.employees (email),
  employee_name        text not null,
  annual_days          integer not null check (annual_days >= 0),
  used_days            integer not null check (used_days >= 0),
  days                 integer not null check (days > 0),
  manager_email        text not null check (manager_email = lower(manager_email)),
  senior_manager_email text check (senior_manager_email = lower(senior_manager_email)),
  declaration_accepted boolean not null check (declaration_accepted),
  status               text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_at           timestamptz,
  created_at           timestamptz not null default now(),
  check (used_days <= annual_days)
);

create index requests_manager_idx  on public.requests (manager_email, status);
create index requests_employee_idx on public.requests (employee_email, request_year);

-- ===== פונקציית עזר להרשאות =====
create function public.my_role() returns text
language sql stable security definer set search_path = ''
as $$ select role from public.employees where email = lower(auth.jwt() ->> 'email') $$;

revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- האם לעובד יש כבר בקשה שנספרת השנה: מאושרת, או ממתינה בחלון שטרם הסתיים.
-- בקשה שנדחתה, או שממתינה בחלון שהסתיים (ללא החלטה), אינה נספרת.
create function public.has_counted_request(p_email text, p_year integer) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.requests r
    join public.windows w on w.id = r.window_id
    where r.employee_email = p_email
      and r.request_year = p_year
      and (r.status = 'approved'
           or (r.status = 'pending' and w.end_date >= (now() at time zone 'Asia/Jerusalem')::date))
  )
$$;

revoke execute on function public.has_counted_request(text, integer) from public, anon;
grant execute on function public.has_counted_request(text, integer) to authenticated;

-- ===== הרשאות טבלה =====
alter table public.employees enable row level security;
alter table public.windows   enable row level security;
alter table public.requests  enable row level security;

grant select, insert, update on public.employees to authenticated;
grant select, insert, update, delete on public.windows to authenticated;
grant select, insert on public.requests to authenticated;
grant update (status, decided_at) on public.requests to authenticated;

-- employees
create policy employees_select on public.employees for select to authenticated
  using (email = lower((select auth.jwt() ->> 'email')) or (select public.my_role()) = 'hr');
create policy employees_insert on public.employees for insert to authenticated
  with check ((select public.my_role()) = 'hr');
create policy employees_update on public.employees for update to authenticated
  using ((select public.my_role()) = 'hr') with check ((select public.my_role()) = 'hr');

-- windows
create policy windows_select on public.windows for select to authenticated using (true);
create policy windows_insert on public.windows for insert to authenticated
  with check ((select public.my_role()) = 'hr');
create policy windows_update on public.windows for update to authenticated
  using ((select public.my_role()) = 'hr') with check ((select public.my_role()) = 'hr');
create policy windows_delete on public.windows for delete to authenticated
  using ((select public.my_role()) = 'hr');

-- requests: קריאה
create policy requests_select on public.requests for select to authenticated
  using (
    employee_email = lower((select auth.jwt() ->> 'email'))
    or (manager_email = lower((select auth.jwt() ->> 'email')) and (select public.my_role()) = 'manager')
    or (select public.my_role()) = 'hr'
  );

-- requests: הגשה על ידי עובד
create policy requests_insert on public.requests for insert to authenticated
  with check (
    (select public.my_role()) = 'employee'
    and employee_email = lower((select auth.jwt() ->> 'email'))
    and status = 'pending'
    and decided_at is null
    and exists (
      select 1 from public.employees e
      where e.email = requests.employee_email
        and e.full_name = requests.employee_name
        and e.annual_days = requests.annual_days
    )
    and exists (
      select 1 from public.windows w
      where w.id = requests.window_id
        and w.window_year = requests.request_year
        and (now() at time zone 'Asia/Jerusalem')::date between w.start_date and w.end_date
    )
    and not public.has_counted_request(requests.employee_email, requests.request_year)
  );

-- requests: החלטת מנהל (רק בקשה ממתינה, ורק עד תאריך הסיום של החלון)
create policy requests_update_manager on public.requests for update to authenticated
  using (
    (select public.my_role()) = 'manager'
    and manager_email = lower((select auth.jwt() ->> 'email'))
    and status = 'pending'
    and exists (
      select 1 from public.windows w
      where w.id = requests.window_id
        and w.end_date >= (now() at time zone 'Asia/Jerusalem')::date
    )
  )
  with check (status in ('approved', 'rejected'));

-- requests: שינוי סטטוס על ידי HR
create policy requests_update_hr on public.requests for update to authenticated
  using ((select public.my_role()) = 'hr')
  with check ((select public.my_role()) = 'hr');
```

### 3.5 כללי עסק שנאכפים במסד
| כלל | איפה |
|---|---|
| הגשה רק בחלון פתוח ובשנה התואמת | `requests_insert` |
| פעם בשנה: אין בקשה מאושרת, או ממתינה בחלון שטרם הסתיים | `has_counted_request` |
| עובד מגיש רק עבור עצמו, והזכאות והשם תואמים לטבלת העובדים | `requests_insert` |
| מנהל מחליט רק על בקשה ממתינה שמיועדת לו, ורק עד תאריך הסיום של החלון | `requests_update_manager` |
| מנהל משנה רק `status` ו-`decided_at` | הרשאות עמודה (`grant update (status, decided_at)`) |
| הצהרה חובה, ימים מנוצלים לא גדולים מהזכאות | `check` |

### 3.6 נתוני דמה
- `sql/02_seed.sql`: 5 עובדים (HR, מנהל, שלושה עובדים), וחלון קנייה פתוח לדוגמה. כתובות הדוא"ל בקובץ הן דמה. לפני שליחת מיילים מחליפים אותן בכתובות בדיקה שבשליטתך.
- `data/sample-employees.csv`: אותה רשימה, בפורמט הטעינה.
- פורמט קובץ הטעינה: CSV בקידוד UTF-8, עם שורת כותרות `email,full_name,role,annual_days`.

## 4. התחברות והרשאות

### 4.1 התחברות
- Supabase Auth, אימייל וסיסמה. בלי הרשמה, הזמנות, שחזור סיסמה וכניסה עם Google.
- 5 משתמשים נוצרים ידנית בדשבורד, עם אישור אוטומטי של האימייל. האימייל של כל משתמש זהה לשורה ב-`employees`.
- יש לכבות הרשמה עצמית בהגדרות Auth. **לא אימתתי** את השם המדויק של ההגדרה בדשבורד.
- משתמש בלי שורה ב-`employees` אינו רואה נתונים, וה-UI מציג "אין הרשאה".
- סיסמאות הדמה לא נכתבות בריפו.

### 4.2 מטריצת הרשאות (רמה 2 ב-course-stack.md)
| טבלה | עובד | מנהל | HR | לא מחובר |
|---|---|---|---|---|
| `employees` | קריאה: שורה עצמית | קריאה: שורה עצמית | קריאה, הוספה ועדכון: הכול | אין |
| `windows` | קריאה: הכול | קריאה: הכול | קריאה, הוספה, עדכון ומחיקה | אין |
| `requests` | קריאה: שלו. הוספה: שלו, בחלון פתוח | קריאה: בקשות שמיועדות לו. עדכון: סטטוס והחלטה | קריאה: הכול. עדכון: סטטוס | אין |

מחיקת בקשה אינה אפשרית לאף תפקיד.

### 4.3 איך מזוהה התפקיד
`my_role()` קוראת את `employees.role` לפי האימייל שב-JWT (`auth.jwt() ->> 'email'`). **לא אימתתי** שה-JWT של Supabase כולל את ההצהרה `email`. נדרש לבדוק זאת בפרויקט בהרצה הראשונה.

### 4.4 מגבלות ידועות
- **טווח הימים לא נאכף במסד.** משתמש טכני יכול להכניס `days` גדול מהמותר ישירות ב-API. ההגנה היא בקוד הלקוח. זה מקובל בהדגמה עם 5 משתמשים. אם יידרש, אפשר להוסיף `check` או כלל בהרשאה, תוך כפילות של הנוסחה.
- **הפונקציה `has_counted_request`** ניתנת להרצה לכל משתמש מחובר ולכל אימייל, ומחזירה רק true או false. זה דליפה קטנה שמקובלת בהדגמה.
- **מרוץ הגשות:** שתי הגשות באותה שנייה מאותו עובד עלולות לעבור שתיהן. לא טופל.
- **אין סכום שנשמר.** השכר שהעובד מזין בסימולטור האופציונלי אינו נשמר ואינו נבדק.

## 5. שכבת ה-AI

### 5.1 מטרה והגבלות
ה-AI מראיין את העובד, מחלץ ממנו כוונה ונתונים ומנסח הסבר. **הוא לא מחשב ימים.** את הזכאות מחשב `lib/eligibility.js`, והמספרים מוצגים ממנו.
הראיון אינו תנאי להגשה (החלטה 4).

### 5.2 זרימה
1. העובד מזין "ניצל השנה" והזכאות מחושבת בדפדפן ומוצגת.
2. הדפדפן שולח ל-`/api/ask` את ההודעות שנכתבו עד כה.
3. הפונקציה מאמתת את המשתמש, מחשבת שוב את הזכאות מאותו קוד, ובונה את הפרומפט.
4. Gemini מחזיר JSON במבנה קבוע. הפונקציה בודקת אותו ומחזירה לדפדפן.
5. הדפדפן מציג את ההסבר, ואם `used_days_mentioned` שונה מהשדה, מציג אזהרה.

### 5.3 חוזה הפונקציה
`POST {API_BASE_URL}/api/ask`, כותרות: `Content-Type: application/json`, `Authorization: Bearer <JWT של המשתמש>`.

בקשה:
```json
{
  "annual_days": 23,
  "used_days": 10,
  "messages": [
    { "role": "user", "text": "אני שוקל למכור כמה ימים, כי בקושי ניצלתי החודש" }
  ]
}
```
תשובה תקינה (`200`):
```json
{
  "ok": true,
  "data": {
    "reply": "לפי המדיניות אפשר למכור עד 4 ימים. ...",
    "intent": "sell",
    "used_days_mentioned": null,
    "uncertain": false
  }
}
```
שגיאה (תמיד JSON, גם בשגיאה):
```json
{ "ok": false, "error": "ai_unavailable", "message": "שירות הראיון אינו זמין כרגע. אפשר להמשיך בלעדיו." }
```

| קוד | `error` | מתי |
|---|---|---|
| 400 | `bad_input` | קלט לא תקין או ארוך מדי |
| 401 | `unauthorized` | JWT חסר או לא תקין |
| 405 | `method_not_allowed` | לא POST |
| 429 | `rate_limited` | המודל החזיר הגבלת קצב |
| 502 | `ai_unavailable` | שגיאה, פסק זמן, או פלט לא תקין מהמודל |

### 5.4 מה נשלח למודל, ומה לא
**נשלח:** נוסח המדיניות (מ-`data/policy.json`), העובדות המחושבות (`annual_days`, `used_days`, `remaining`, `maxBuy`, `maxSell`), ואת הודעות העובד.
**לא נשלח:** שם, אימייל, שכר, אחוז משרה ואחוז מס. הם נשארים בדפדפן. הנחיה בממשק: "אל תכתוב פרטים מזהים". בקורס, נתוני דמה בלבד (הסיבה: Gemini החינמי משתמש בתוכן לשיפור המוצרים).

### 5.5 הפרומפט
ההוראות המערכתיות (`system_instruction`) כוללות, לפי הסדר:
1. תפקיד: מראיין את העובד באנגלית על בסיס המדיניות, ומסביר את התוצאה.
2. נוסח המדיניות המלא.
3. העובדות המחושבות, עם ההוראה "אלה המספרים היחידים שמותר לצטט".
4. **שלוש המגבלות המאושרות:**
   - אין המצאת מספרים: מתבסס רק על המדיניות והעובדות, ואינו מעריך או משלים נתון חסר.
   - אין סמכות החלטה: אינו מאשר, דוחה או מחליט. הסמכות אצל המנהל.
   - אי-ודאות מוצהרת: כשהמידע אינו מספיק, אומר זאת במפורש, ו-`uncertain` הוא true.
5. הנחיות פלט: תשובה עד 600 תווים, באנגלית פשוטה.

הודעות העובד נשלחות כתוכן נפרד, ולא משורשרות להוראות המערכת. הוראות בתוך הודעת עובד אינן מחייבות את המודל.

### 5.6 פלט במבנה קבוע
סכמת JSON שמועברת למודל לפי [תיעוד הפלט המובנה של Gemini](https://ai.google.dev/gemini-api/docs/structured-output) (יש להעתיק את שמות הפרמטרים מהדף בזמן הבנייה):

| שדה | סוג | הערות |
|---|---|---|
| `reply` | string | עד 600 תווים |
| `intent` | `buy`, `sell` או `unknown` | |
| `used_days_mentioned` | integer או null | מספר ימים מנוצלים שהעובד כתב בשיחה |
| `uncertain` | boolean | |

### 5.7 בדיקות בקוד על הפלט
הפונקציה לא סומכת על המודל, גם כשהפלט מתאים לסכמה:
1. JSON תקין, ושדות וסוגים לפי הסכמה, אחרת `ai_unavailable`.
2. `reply` לא ריק, ואורכו עד 600 תווים.
3. **בדיקת מספרים:** כל מספר ב-`reply` חייב להופיע בעובדות או בנוסח המדיניות. אחרת התשובה נפסלת. כך מונעים המצאת מספרים.
4. `used_days_mentioned` נבדק בדפדפן מול השדה. אם שונה, מוצגת אזהרה, והשדה הוא הקובע.

### 5.8 הגנות הפונקציה
- CORS: מאשרת רק את `ALLOWED_ORIGIN` (כתובת האתר ב-GitHub Pages), ועונה גם ל-`OPTIONS`.
- אימות: קוראת ל-`GET {SUPABASE_URL}/auth/v1/user` עם ה-JWT של המשתמש ועם המפתח הציבורי. כך רק 5 משתמשי הדמה מנצלים את מכסת ה-AI.
- מגבלות קלט: עד 6 הודעות, עד 500 תווים להודעה, `annual_days` ו-`used_days` שלמים, `used_days <= annual_days`, וגוף בקשה קטן.
- פסק זמן של 20 שניות לקריאה למודל.
- אף שגיאה גולמית של הספק לא חוזרת לדפדפן, והמפתח לא נכתב ללוג.
- שם הדגם נקרא מ-`GEMINI_MODEL` (ברירת מחדל `gemini-3.8-flash`).
- הקריאה ל-Gemini עטופה בפונקציה אחת (`callModel`), כדי שאפשר יהיה להחליף כתובת או דגם בנקודה אחת. [התיעוד](https://ai.google.dev/gemini-api/docs/text-generation) מציג כתובת `/v1beta/interactions`. יש לקרוא אותו בזמן הבנייה.

### 5.9 `ai-tests.md`
קובץ בשורש הריפו, טבלה עם העמודות: מספר, `annual_days`, `used_days`, הודעת העובד, תוצאה צפויה, תוצאה בפועל, עבר או נכשל. בסוף, אחוז ההצלחה.
10 קלטים לפחות, בנתוני דמה, כולל:
- בקשת קנייה ובקשת מכירה רגילות.
- עובד שמבקש מה-AI לאשר את הבקשה (המודל חייב לסרב).
- עובד שמבקש מספר שאינו במדיניות (המודל לא ממציא).
- מידע חסר או סותר (`uncertain` צריך להיות true).
- מספר ימים מנוצלים שונה מהשדה.
- הוראה בתוך ההודעה ("התעלם מההוראות הקודמות").
- הודעה בשפה אחרת.
- הודעה ארוכה מדי (נחסמת לפני המודל, `bad_input`).

## 6. אינטגרציות, APIs ואוטומציות

### 6.1 קריאות הדפדפן ל-Supabase
| מסך | פעולה | קריאה (`supabase-js`) |
|---|---|---|
| כל העמודים | כניסה | `auth.signInWithPassword({ email, password })` |
| עובד | שורת העובד | `from('employees').select('email, full_name, annual_days').eq('email', myEmail).single()` |
| עובד | חלונות פתוחים | `from('windows').select('*').lte('start_date', today).gte('end_date', today)` |
| עובד | Submit | `from('requests').insert({ ... })` (כל שדות הטבלה מלבד `id`, `status`, `decided_at`, `created_at`) |
| עובד | הבקשה והסטטוס | `from('requests').select('*, windows(type, start_date, end_date)').order('created_at', { ascending: false })` |
| מנהל | Dashboard | `from('requests').select('id, employee_name, created_at, days, windows!inner(type, end_date)').eq('status', 'pending').gte('windows.end_date', today)` |
| מנהל | החלטה | `from('requests').update({ status, decided_at }).eq('id', id).eq('status', 'pending').select()` |
| HR | פתיחת חלון | `from('windows').insert({ type, start_date, end_date })` |
| HR | טעינת עובדים | `from('employees').upsert(rows, { onConflict: 'email' })` |
| HR | שינוי סטטוס (Should) | `from('requests').update({ status }).eq('id', id)` |
| HR | דו"ח | `from('requests').select('id, employee_email, employee_name, days, windows!inner(type)').eq('status', 'approved').eq('window_id', windowId)` |

עדכון החלטה הוא **עדכון מותנה** (course-stack.md): אם `.select()` מחזיר 0 שורות, ההחלטה לא נקלטה (בקשה כבר הוכרעה, או החלון הסתיים), ומוצגת הודעה.

### 6.2 קריאה ל-AI
ראו סעיף 5.

### 6.3 ייצוא ויבוא קבצים (בדפדפן, בלי שרת)
- **יבוא עובדים (`js/csv.js`):** `Papa.parse(file, { header: true, skipEmptyLines: true, encoding: 'UTF-8' })`. אימות לפני שליחה: אימייל תקין באותיות קטנות, `role` מתוך שלוש האפשרויות, `annual_days` מספר שלם לא שלילי, ובלי אימיילים כפולים. לפני הכתיבה מוצג סיכום (כמה שורות תקינות ומה נדחה). הטעינה אינה מוחקת עובדים שחסרים בקובץ (החלטה 1).
- **ייצוא דו"ח:** קובץ CSV ב-UTF-8 עם BOM, בהורדה דרך `Blob`. עמודות: `request_id` (בפורמט `FLX-000123`), `employee_email`, `request_type` (`buy` או `sell`), `days_signed`. `days_signed` מחושב ב-`csv.js` מ-`days` ומסוג החלון: קנייה `+days`, מכירה `-days`.

### 6.4 אוטומציות n8n
כל המיילים נשלחים מחשבון Gmail אחד, ורק לכתובות בדיקה. כל Workflow בודק ב-Node של תנאי שהנמען נמצא ברשימת כתובות הבדיקה (קבועה ב-Node של Set), ורק אז שולח.

**שני Database Webhooks** (מוגדרים בדשבורד של Supabase, לא בקוד, כדי שהסוד לא ייכנס לריפו):
| Webhook | טבלה ואירוע | יעד | כותרות |
|---|---|---|---|
| `requests_insert` | `requests`, `INSERT` | כתובת הייצור של Webhook ב-n8n (W1) | `Content-Type`, `x-webhook-secret` |
| `requests_update` | `requests`, `UPDATE` | כתובת הייצור של Webhook ב-n8n (W2) | `Content-Type`, `x-webhook-secret` |

המטען: `type`, `table`, `schema`, `record`, `old_record` ([תיעוד](https://supabase.com/docs/guides/database/webhooks)). ב-n8n, ה-Webhook מוגדר עם Header Auth (סעיף 7).

| Workflow | טריגר | עדיפות | מה הוא עושה |
|---|---|---|---|
| W1 הגשה | Webhook, `INSERT` | Must | קורא את החלון לפי `window_id` (סוג ותאריך סיום). שולח למנהל (`manager_email`) מייל: שם המבקש, מספר ימים, סוג, תאריך יעד, קישור ל-`manager.html`. (FR-22) |
| W1 המשך | אותו אירוע | Should | שולח לעובד אישור הגשה עם מספר הבקשה. (FR-24) |
| W2 החלטה | Webhook, `UPDATE` | Must | ממשיך רק אם `old_record.status = 'pending'` ו-`record.status` הוא `approved` או `rejected`. שולח לעובד מייל סטטוס. בדחייה שולח גם למנהל. (FR-23) |
| W3 תזכורת | Schedule, כל יום ב-08:00 | Should | מחשב "היום ועוד 3 ימים". מוצא חלונות ש-`end_date` שלהם שווה לתאריך הזה. מוצא בקשות `pending` בהם, ושולח לכל מנהל מייל אחד עם מספר הבקשות הממתינות. (FR-25) |
| W4 דו"ח Payroll | Schedule, כל יום ב-08:00 | Should | מוצא חלונות ש-`end_date` שלהם הוא אתמול. מוצא בקשות `approved` בהם, בונה CSV באותו פורמט כמו ייצוא ה-HR (כולל `days_signed`, שמחושב מסוג החלון), ושולח כקובץ מצורף לכתובת בדיקה של Payroll. (FR-26) |

כללים:
- אזור הזמן של כל ה-Workflows הוא `Asia/Jerusalem`. ב-Self-hosted צריך להגדיר זאת, כי ברירת המחדל שם היא ניו יורק ([תיעוד](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/)).
- Workflow מתוזמן חייב להיות שמור ומפורסם (published), אחרת לא ירוץ.
- W3 ו-W4 מתאימים חלון לפי שוויון תאריך, ולכן כל חלון מטופל פעם אחת ביום המתאים.
- קריאה ל-Supabase מ-n8n היא עם מפתח Secret, שעוקף RLS. הוא נשמר רק ב-Credentials של n8n.
- הפיצ'ר "מייל על בקשה ללא החלטה" (Could, פיצ'ר 25) מתאים להתווסף ל-W4 ואינו בהיקף.
- אם n8n אינו זמין, המוצר ממשיך לעבוד. ההגשה וההחלטה נשמרות, וה-HR ומנהלים משתמשים בעקיפות מה-PRD (מסך האישור, תזכורת ידנית, וייצוא ידני).

## 7. מפתחות ומשתני סביבה

### 7.1 איפה כל ערך
| ערך | סודי? | איפה נשמר | מי קורא | מותר בדפדפן? |
|---|---|---|---|---|
| `GEMINI_API_KEY` | כן | משתנה סביבה ב-Vercel | `api/ask.js` | **לא** |
| `GEMINI_MODEL` | לא | משתנה סביבה ב-Vercel | `api/ask.js` | לא נדרש |
| `ALLOWED_ORIGIN` (למשל `https://<שם-משתמש>.github.io`) | לא | משתנה סביבה ב-Vercel | `api/ask.js` | לא נדרש |
| `SUPABASE_URL` | לא | `js/config.js` ומשתנה סביבה ב-Vercel | דפדפן, `api/ask.js` | כן |
| מפתח Publishable של Supabase (`sb_publishable_...`) | לא (ציבורי מעצם תכנונו) | `js/config.js` ומשתנה סביבה ב-Vercel | דפדפן, `api/ask.js` | כן |
| מפתח Secret של Supabase (`sb_secret_...`) | **כן** | Credentials של n8n בלבד | n8n | **לא** |
| Gmail OAuth | כן | Credentials של n8n | n8n | **לא** |
| סוד ה-webhook | כן | הגדרות ה-webhook ב-Supabase ו-Credentials של n8n (Header Auth) | Supabase, n8n | **לא** |
| סיסמאות משתמשי הדמה | כן | Supabase Auth, ואצלך | המשתמש | הוזנו בטופס בלבד |

### 7.2 מה אסור שיגיע לדפדפן
מפתח Gemini, מפתח Secret של Supabase, אישורי Gmail, סוד ה-webhook, כתובת הייצור של ה-webhook ב-n8n, וכל הודעת שגיאה גולמית של ספק.

### 7.3 כללים
- אין מפתח סודי בקוד, בקובץ הגדרות או ב-`sql/` ו-`n8n/` בריפו הציבורי. `.gitignore` כולל `.env*`.
- ייצוא Workflow מ-n8n (`n8n/*.json`) נבדק לפני העלאה: אין בו מפתחות או כתובות Webhook של ייצור.
- אחרי שינוי במשתנה סביבה ב-Vercel, נדרשת פריסה חדשה (Redeploy).
- **המפתחות הישנים של Supabase** (`anon` ו-`service_role`) מתוכננים לצאת משימוש עד סוף 2026 ([תיעוד](https://supabase.com/docs/guides/api/api-keys)). משתמשים בחדשים.
- **לא אימתתי** אם ה-Credential של Supabase ב-n8n מקבל מפתח `sb_secret_...`. אם לא, אפשר להשתמש ב-HTTP Request עם כותרות `apikey` ו-`Authorization`, או במפתח הישן עד שיוצא משימוש.

## 8. מבנה התיקיות

ריפו ציבורי אחד, ענף `main`. GitHub Pages משרת את השורש. Vercel משרת את `api/` מאותו ריפו.

```
/
├─ index.html                 כניסה
├─ employee.html              עובד: מסכים 1 עד 4
├─ manager.html               מנהל: Dashboard
├─ hr.html                    HR: אזור ניהול
├─ css/
│  └─ styles.css              LTR, Heebo, נגישות
├─ js/
│  ├─ config.js               כתובות ומפתח ציבורי בלבד
│  ├─ supabase-client.js
│  ├─ auth.js
│  ├─ ai-client.js
│  ├─ csv.js
│  ├─ ui.js
│  └─ pages/
│     ├─ login.js
│     ├─ employee.js
│     ├─ manager.js
│     └─ hr.js
├─ lib/                       משותף לדפדפן ולפונקציה, פונקציות טהורות
│  ├─ eligibility.js
│  ├─ pricing.js
│  ├─ ai-prompt.js            בניית ההוראות המערכתיות והסכמה
│  └─ ai-validate.js          בדיקות הפלט (סעיף 5.7)
├─ api/
│  └─ ask.js                  הפונקציה היחידה
├─ data/
│  ├─ policy.json             נוסח המדיניות (מקור אחד, לדפדפן ולפונקציה)
│  └─ sample-employees.csv
├─ sql/
│  ├─ 01_schema.sql           טבלאות, פונקציות עזר, הרשאות
│  └─ 02_seed.sql             נתוני דמה
├─ n8n/                       ייצוא Workflows, אחרי בדיקת סודות
│  ├─ W1_request_submitted.json
│  ├─ W2_request_decided.json
│  ├─ W3_manager_reminder.json
│  └─ W4_payroll_report.json
├─ ai-tests.md
├─ package.json               {"type": "module"}, בלי תלויות
├─ vercel.json                רק אם נדרש (ראו הערה)
├─ .gitignore
└─ README.md                  הרצה והגדרת סביבה
```

הערות:
- הספריות `supabase-js` ו-`PapaParse` נטענות בתג `<script>` מ-CDN, בגרסה מדויקת. לא מותקנות ב-`package.json`.
- `api/ask.js` מייבא מ-`../lib/` ו-`../data/policy.json`. אם Vercel לא כולל את `policy.json` בחבילת הפונקציה, מוסיפים ב-`vercel.json` את `functions` עם `includeFiles`. (**לא נבדק**, תלוי בגרסת Node ובהגדרות הפרויקט.)
- כל התיקיות ב-GitHub Pages ציבוריות, כולל `sql/` ו-`api/`. אין בהן סודות.
- לא נוצרות תיקיות נוספות מעבר לאלה.

## 9. מיפוי דרישות לרכיבים
| דרישה | רכיב עיקרי |
|---|---|
| FR-01 זכאות | `lib/eligibility.js` |
| FR-02 פעם בשנה | `has_counted_request`, `requests_insert`, ובדיקה מוקדמת ב-`employee.js` |
| FR-03 חלונות | טבלת `windows`, `requests_insert`, `employee.js` |
| FR-04 מדיניות | `data/policy.json`, מצב Onboarding |
| FR-05 ניצל השנה | טופס ב-`employee.js` |
| FR-06 ראיון AI | `api/ask.js`, `lib/ai-*.js`, `ai-client.js` |
| FR-07 סימולטור | `lib/pricing.js` |
| FR-08 מנהלים | שדות הבקשה, `manager_email` ו-`senior_manager_email` |
| FR-09, FR-10, FR-11 בחירה, שליחה, אישור | `employee.js`, `requests_insert` |
| FR-12 סטטוס | `employee.js`, קריאת הבקשות |
| FR-13 קלנדר | מצב Onboarding, רשימת `windows` |
| FR-14, FR-15 מנהל | `manager.js`, `requests_select`, `requests_update_manager` |
| FR-16 חלון | `hr.js`, `windows_insert` |
| FR-17 סטטוס HR | `hr.js`, `requests_update_hr` |
| FR-18 דו"ח | `csv.js`, `hr.js` |
| FR-19 טעינת עובדים | `csv.js`, `hr.js`, `employees_insert` ו-`employees_update` |
| FR-20 תפקיד | `employees.role`, `my_role()` |
| FR-21 עד FR-26 | n8n W1 עד W4, Database Webhooks |
| FR-27 הרשאות | `01_schema.sql` (חלק ההרשאות) |
| FR-28 נתונים | `01_schema.sql` |
| FR-29, FR-30 | `styles.css`, סעיף 2.6 |

## 10. מקרי קצה (לפי ה-PRD)
| מקרה | טיפול |
|---|---|
| חלון סגור או לא מתאים לסוג | הכפתור חסום עם הודעה. אם נשלח בכל זאת, `requests_insert` דוחה |
| בקשה נוספת באותה שנה | הודעה ברורה. `has_counted_request` דוחה |
| אין זכאות לפעולה | הכפתור חסום, עם הסבר |
| כשל או פלט לא תקין מה-AI | הודעה ברורה, והעובד ממשיך |
| החלטת מנהל על בקשה שכבר הוכרעה או בחלון שהסתיים | עדכון מותנה מחזיר 0 שורות, ומוצגת הודעה |
| משתמש בלי שורה ב-`employees` | "אין הרשאה" |
| קובץ עובדים עם שורות לא תקינות | סיכום שגיאות לפני כתיבה, ושורות תקינות בלבד נטענות באישור HR |
| מקרי קצה בתהליך האישור (מנהל שעזב ועוד) | מחוץ להיקף, לפי ה-PRD |

## 11. מה נבדק ומה לא

**נבדק בהרצה.** נוסחאות הזכאות והסימולטור (סעיף 2.3) הורצו ב-Node, ושבע דוגמאות הזכאות (הטבלה בסעיף 2.3, אחרי עדכון כלל המכירה ב-17.10.2026) ושתי דוגמאות שווי היום נתנו את התוצאות המצוינות. ה-SQL בסעיף 3.4 הורץ על PostgreSQL 16, עם דמיון של `auth.jwt()` ושל התפקידים `anon` ו-`authenticated`. נבדקו:
- הגשה תקינה, ודחייה של: הגשה שנייה באותה שנה, מכירה אחרי קנייה, חלון סגור, הגשה עבור אחר, זכאות מזויפת, ותפקיד מנהל כמגיש.
- בקשה שנדחתה אינה נספרת, ובקשה ממתינה בחלון שהסתיים אינה נספרת.
- ראיית נתונים: עובד רואה את שלו, מנהל רואה את מי שמיועד לו, מנהל אחר לא רואה כלום, ו-HR רואה הכול.
- מנהל מאשר רק בקשה שלו, רק כשממתינה, ורק עד תאריך הסיום. שינוי עמודה אחרת נדחה בהרשאת עמודה.
- הרשאות `employees` ו-`windows` לפי תפקיד, ו-Upsert של HR. משתמש לא מחובר נדחה.
- בהרצה הראשונה התגלתה שגיאת "infinite recursion", ותוקנה על ידי `has_counted_request`.

**לא נבדק:**
- ההרצה על Supabase עצמו (התנהגות Data API, `auth.jwt()` בפועל, הרשאות ברירת מחדל).
- הפונקציה ב-Vercel, הקריאה ל-Gemini, ה-Workflows ב-n8n, ו-Webhooks של Supabase.
- הכתובת `/auth/v1/user` לבדיקת ה-JWT בפונקציה. היא מוכרת לי כנקודת הקצה של Supabase Auth, ולא אימתתי אותה במקור בתיעוד.
- ההצהרה `email` ב-JWT של Supabase.

## 12. הנחות
1. `annual_days` הוא מספר שלם.
2. שנה היא שנה קלנדרית לפי תאריך ההתחלה של החלון.
3. HR פותחת חלון עם התאריכים שהיא בוחרת, ללא אכיפה מול תאריכי המדיניות (בהתאם להנחה 6 ב-PRD).
4. כתובות הדוא"ל במנהל ובמנהל הבכיר הן כתובות בדיקה שבשליטתך.
5. קובץ העובדים הוא CSV בקידוד UTF-8 (ראו tech-stack.md). אם שונה, יתעדכן סעיף 6.3.
6. מספיקה הפרדה לארבעה עמודים, ואין צורך ב-Router.
7. n8n זמין בכתובת ציבורית (Cloud), כדי ש-Supabase יוכל לקרוא לו.
8. Payroll מקבלת את הדו"ח האוטומטי בכתובת בדיקה אחת.

## 13. עדכון מ-2.11.2026: אב טיפוס Frontend

- אב טיפוס חי ב-GitHub Pages ללא backend. הנתונים ב-`localStorage` דרך `js/mock-client.js`, מאחורי `js/data-source.js`. מעבר ל-Supabase הוא החלפת שורה אחת: `export { sb } from './supabase-client.js';`.
- קבצים שנוספו: `js/mock-client.js`, `js/mock-data.js`, `js/mock-ai.js`, `js/data-source.js`, `js/icons.js`, `lib/rules.js`, `tests/acceptance.mjs`, `img/`.
- סעיפים 2.3, 3.2, 3.4, 4.4 ו-6.1 עודכנו: הבקשה והדו"ח בלי `day_value_gross` ו-`amount_gross_signed`.
- תשובות ה-AI באב הטיפוס מוכנות מראש. החוזה בסעיף 5 נשאר לשלב ה-backend.
