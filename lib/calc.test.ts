import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPeriods, derive, missingCompleted, mondayOf, paceShare, targetYears, toFlows, yearToDate,
  type MonthlyRow, type WeeklyRow,
} from "./calc.ts";

const near = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test("contribution margin, GP/ad spend and revenue", () => {
  const f = toFlows({
    shopify_revenue: 10000, shopee_revenue: 4000, other_revenue: 1000,
    shopify_cogs: 2000, shopee_cogs: 1000, other_cogs: 200,
    meta_spend: 2000, google_spend: 500, shopee_ads: 400, affiliate: 500,
  });
  const d = derive(f, 0.1);
  assert.equal(d.revenue, 15000);
  // (10000-2000) / (2000+500+500)
  near(d.shopifyGpPerAd, 8000 / 3000);
  // (4000-1000) / 400
  near(d.shopeeGpPerAd, 7.5);
  // 15000*0.9 - 3200 - 2000 - 500 - 400 - 500
  near(d.contribution, 13500 - 3200 - 2000 - 500 - 400 - 500);
});

test("zero ad spend gives no ratio instead of infinity", () => {
  const d = derive(toFlows({ shopify_revenue: 100 }), 0.1);
  assert.equal(d.shopifyGpPerAd, null);
  assert.equal(d.shopeeGpPerAd, null);
});

test("weeks start on Monday", () => {
  assert.equal(mondayOf("2026-10-25"), "2026-10-19"); // Sunday
  assert.equal(mondayOf("2026-10-19"), "2026-10-19");
  assert.equal(mondayOf("2026-10-26"), "2026-10-26");
});

const month = (m: string, shopify: number, cash: number | null, ccc: number | null): MonthlyRow => ({
  month_start: m, shopify_revenue: shopify, ccc_days: ccc, cash_in_bank: cash,
});

test("quarters add flows and take the latest month's cash and CCC", () => {
  const monthly = [month("2026-07-01", 100, 50, 30), month("2026-08-01", 200, 60, 28), month("2026-09-01", 300, 70, 25), month("2026-10-01", 400, 80, 20)];
  const q = buildPeriods("quarterly", [], monthly, "2026-10-25");
  const q3 = q.find((p) => p.key === "2026-Q3")!;
  assert.equal(q3.flows!.shopify_revenue, 600);
  assert.equal(q3.cash, 70);
  assert.equal(q3.ccc, 25);
  assert.equal(q3.monthsIn, 3);
  const q4 = q.find((p) => p.key === "2026-Q4")!;
  assert.equal(q4.monthsIn, 1);
  assert.equal(q4.monthsExpected, 3);
});

test("quarterly margin ratio comes from sums, not an average of monthly ratios", () => {
  const monthly: MonthlyRow[] = [
    { month_start: "2026-07-01", shopify_revenue: 1000, shopify_cogs: 0, meta_spend: 100, ccc_days: null, cash_in_bank: null },
    { month_start: "2026-08-01", shopify_revenue: 1000, shopify_cogs: 0, meta_spend: 900, ccc_days: null, cash_in_bank: null },
  ];
  const q3 = buildPeriods("quarterly", [], monthly, "2026-10-25").find((p) => p.key === "2026-Q3")!;
  near(derive(q3.flows!, 0).shopifyGpPerAd, 2000 / 1000);
});

test("missing last completed week is flagged", () => {
  const weekly: WeeklyRow[] = [{ week_start: "2026-10-12", shopify_revenue: 5 }];
  const p = buildPeriods("weekly", weekly, [], "2026-10-25");
  assert.equal(p.length, 12);
  assert.equal(p[p.length - 1].key, "2026-10-19"); // current week
  // last finished week (12 Oct) is entered, so nothing is missing
  assert.equal(missingCompleted("weekly", p, "2026-10-25"), null);
  // with no entries, the last finished week (12 Oct) is the one flagged
  const none = buildPeriods("weekly", [], [], "2026-10-25");
  assert.equal(missingCompleted("weekly", none, "2026-10-25")?.key, "2026-10-12");
});

test("year to date and pace", () => {
  const monthly = [month("2026-12-01", 999, null, null), month("2027-01-01", 100, null, null), month("2027-02-01", 150, null, null)];
  assert.equal(yearToDate(monthly, 2027), 250);
  assert.equal(paceShare("2026-10-25", 2027), null);
  near(paceShare("2027-07-02", 2027), 182 / 365);
});

test("year to date and pace follow the chosen year", () => {
  const monthly = [month("2026-03-01", 70, null, null), month("2026-04-01", 30, null, null), month("2027-01-01", 5, null, null)];
  assert.equal(yearToDate(monthly, 2026), 100);
  assert.equal(yearToDate(monthly, 2027), 5);
  near(paceShare("2026-07-02", 2026), 182 / 365);
  assert.equal(paceShare("2026-07-02", 2027), null);
});

test("target years keep past goals and always include the current year", () => {
  assert.deepEqual(targetYears([{ year: 2027, amount: 1 }, { year: 2025, amount: 1 }], 2026), [2025, 2026, 2027]);
  assert.deepEqual(targetYears([], 2026), [2026]);
  assert.deepEqual(targetYears([{ year: 2026, amount: 1 }], 2026), [2026]);
});

test("total gross profit / ad spend uses every channel and all ad spend plus affiliate", () => {
  const f = toFlows({
    shopify_revenue: 10000, shopee_revenue: 4000, other_revenue: 1000,
    shopify_cogs: 2000, shopee_cogs: 1000, other_cogs: 200,
    meta_spend: 2000, google_spend: 500, shopee_ads: 400, affiliate: 500,
  });
  // (15000 - 3200) / (2000 + 500 + 400 + 500)
  near(derive(f, 0.1).totalGpPerAd, 11800 / 3400);
  assert.equal(derive(toFlows({ shopify_revenue: 100 }), 0.1).totalGpPerAd, null);
});
