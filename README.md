# Wolo Yoga dashboard

One-page company dashboard. Owners type in weekly and monthly numbers; everyone signed in sees the same page.

- **Editor** logins can enter and change numbers, the vision, core values, the 2027 target and the fee estimate.
- **View only** logins can see everything and change nothing. This is enforced in the database (row level security), not just by hiding buttons.
- Weekly and monthly are separate entries. Quarterly and yearly views add up the **monthly** entries.

## What gets entered

| | Weekly (Mon to Sun) | Monthly |
|---|---|---|
| Revenue | Shopify, Shopee | Shopify, Shopee, Other |
| COGS | Shopify, Shopee | Shopify, Shopee, Other |
| Ad spend | Meta, Google, Shopee ads | Meta, Google, Shopee ads |
| Other | Affiliate commission | Affiliate commission, cash conversion cycle (days), cash in bank at month end |

## Formulas

- Total revenue = Shopify + Shopee + Other revenue
- Shopify gross profit / ad spend = (Shopify revenue − Shopify COGS) ÷ (Meta + Google + affiliate commission)
- Shopee gross profit / ad spend = (Shopee revenue − Shopee COGS) ÷ Shopee ad spend
- Total contribution margin (est.) = total revenue × (1 − fee rate) − total COGS − Meta − Google − Shopee ads − affiliate commission. The fee rate defaults to 10% and is editable.
- Quarter and year ratios are computed from summed amounts, never by averaging monthly ratios.
- Quarter and year cash and cash conversion cycle are the period's latest month (they are balances, so they are not added).
- Weekly contribution margin covers Shopify and Shopee only (weekly has no "other" fields).
- 2027 target progress = sum of monthly total revenue in calendar 2027 ÷ target.

The maths is in `lib/calc.ts` with tests in `lib/calc.test.ts` (`npm test`).

## Setup (about 20 minutes)

### 1. GitHub
Create an empty private repo (for example `wolo-dashboard`), then from this folder:

```
git init
git add .
git commit -m "Wolo dashboard"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/wolo-dashboard.git
git push -u origin main
```

### 2. Supabase
1. Create a new project at supabase.com.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and run it.
3. **Authentication > Sign In / Providers > Email**: turn **off** "Allow new users to sign up". Nobody can then create their own account.
4. **Authentication > Users > Add user > Create new user**: add each person with an email and password and tick "Auto Confirm User". Everyone starts as view only.
5. Make editors. In the SQL Editor run, with your own emails:
   ```sql
   update public.profiles set role = 'editor' where email in ('dean.yeong@gmail.com');
   ```
6. **Project Settings > API**: copy the Project URL and the `anon` public key.

### 3. Vercel
1. **Add New > Project**, import the GitHub repo. Framework is detected as Next.js.
2. Add environment variables (Production, Preview and Development):
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key
3. Deploy. Open the URL, sign in, and enter your first numbers.

The anon key is meant to be public. Safety comes from the row level security rules in `schema.sql`, so do not skip step 2.2 and never put the `service_role` key in this app.

### Run locally
```
cp .env.example .env.local   # fill in the two values
npm install
npm run dev
```

## Notes
- Re-entering a week or month replaces it (one row per period).
- A finished week or month with no entry shows a "not submitted" banner and a dashed bar in the chart. It is never counted as zero.
- To add or remove people, or change their role, use Supabase **Authentication > Users** and the `profiles` table.
# wolo-dashboard
