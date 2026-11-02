# Milestone 1: Walking Skeleton (תוכנית)

סטטוס: ממתין לאישור. תאריך: 2.11.2026.

## מטרה
כל החלקים מדברים מקצה לקצה, בלי פיצ'ר מוצר: דפדפן ← Supabase (כניסה ונתונים) ← פונקציה ב-Vercel ← Gemini.

## סדר עבודה
קודם הטבלאות (SQL), אחר כך המסכים, כנדרש ב-`MILESTONES.md`.

## קבצים שייבנו
| קובץ | תפקיד |
|---|---|
| `sql/01_schema.sql` | שלוש הטבלאות, `my_role()`, `has_counted_request()`, הרשאות ו-RLS, בדיוק כמו ARCHITECTURE סעיף 3.4 |
| `sql/02_seed.sql` | 5 עובדי דמה (HR, מנהל, 3 עובדים), חלון קנייה פתוח, ו-3 בקשות לדוגמה (ממתינה, נדחתה, ממתינה בחלון שהסתיים) לבדיקות של מיילסטונים 2 ו-4 |
| `index.html` + `js/pages/login.js` | טופס כניסה (אימייל וסיסמה) והפניה לפי `employees.role` |
| `employee.html`, `manager.html`, `hr.html` | עמודים ריקים, עם כותרת, שם התפקיד והגנת תפקיד (חוויה בלבד) |
| `test.html` + `js/pages/test.js` | "Signed in as [email] ([role])", כפתור שקורא ל-`/api/ask`, מציג את התשובה הקבועה, וכפתור "call without JWT" שמראה את השגיאה |
| `api/ask.js` | OPTIONS/CORS, בדיקת JWT מול `/auth/v1/user`, מפתח Gemini ממשתנה סביבה, קלט קבוע, פלט JSON קבוע, פסק זמן 20 שניות, ללא שגיאה גולמית |
| `js/config.js`, `js/supabase-client.js`, `js/auth.js`, `js/ui.js` | רק URL ומפתח Publishable (ציבוריים) |
| `css/styles.css` | Heebo, צבעי DESIGN (כפתורים Ocean Blue עם טקסט לבן, 5.36:1), `lang="en" dir="ltr"`, רוחב מינימלי 1024px |
| `package.json`, `README.md`, `.env.example` | הרצה והגדרת סביבה, בלי ערכים סודיים |
| `build/flexication-m1.zip` | ארכיון הניתן להעלאה (אתר סטטי בלי שלב בנייה, ה-zip הוא העתק של הקבצים שבשורש. `build/` לא נכנס ל-git) |

## החלטות ופרטים
- **קלט קבוע ל-Gemini:** נתוני דמה קבועים בקוד (למשל "annual_days 23, used_days 10"), בלי שום פרט מזהה. מבנה פלט: `{ ok, data: { reply, intent, used_days_mentioned, uncertain } }` כמו בסעיף 5.3.
- **דגם Gemini:** ממשתנה `GEMINI_MODEL`. בבנייה אקרא את תיעוד Gemini הנוכחי (כתובת, שמות פרמטרים של פלט מובנה, שם דגם), כי ה-ARCHITECTURE מסמן זאת כ"לא נבדק".
- **CORS:** `ALLOWED_ORIGIN` תומך ברשימה מופרדת בפסיקים (GitHub Pages ו-`http://localhost:5500` לבדיקה מקומית).
- **JWT ב-RLS:** אבדוק בהרצה הראשונה שה-JWT כולל `email` (נקודה "לא נבדקה" ב-ARCHITECTURE 4.3).
- **משתמש בלי שורה ב-`employees`:** מוצג "No permission" ולא מופנה.
- **אפס סודות:** בקוד רק `SUPABASE_URL` ומפתח `sb_publishable_...`.

## מה אתה (המשתמש) עושה בעצמך, צעד אחר צעד
1. Supabase: פרויקט חדש, ביטול הרשמה עצמית, יצירת 5 משתמשים (אימייל, סיסמה, Auto Confirm), הרצת שני קבצי ה-SQL, העתקת URL ומפתח Publishable.
2. Gemini: מפתח ב-Google AI Studio.
3. Vercel: ייבוא הריפו, הוספת `GEMINI_API_KEY`, `GEMINI_MODEL`, `ALLOWED_ORIGIN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, ואז Redeploy.
הסיסמאות והמפתחות מוזנים רק על ידך בדשבורדים. לא בצ'אט.

## תנאי השלמה (DoD) ואיך נבדוק
| תנאי | בדיקה |
|---|---|
| כניסה מציגה אימייל ותפקיד, והפניה נכונה ל-3 תפקידים | כניסה עם עובד, מנהל ו-HR |
| משתמש לא מחובר לא רואה שורות | `select` בלי התחברות מחזיר 0 שורות |
| `/api/ask` בלי JWT ← JSON שגיאה, עם JWT ← מבנה קבוע | כפתורי עמוד הבדיקה |
| אין סוד בריפו, ב-JS וב-Network | סריקת `git grep` וחלון Network |
| רק נתוני דמה ל-Gemini | הקלט קבוע בקוד |

## שלבים
1. תכנון (המסמך הזה) ← אישור שלך.
2. בנייה.
3. הרצה: אתה בודק מקומית (`npx serve` או Live Server) מול Supabase ו-Vercel.
4. דחיפה: `git add` מפורש, push ל-`main`, לינק חי https://haiyael8.github.io/flexication/ . אחרי זה עוצרים וממתינים לאישור לפני מיילסטון 2.
