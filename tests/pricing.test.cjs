"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { estimate } = require("../assets/webui/pricing.js");

function catalog() {
  return {
    inspectedAt: "2026-10-31T00:00:00+11:00",
    currency: "CNY",
    billingModes: [{ id: "payg", label: "按量計費", unit: "時" }],
    regions: [{ id: "west-C", label: "西北B區" }],
    gpuModels: [{ name: "RTX 4090", vramGB: 24 }],
    offers: [{
      id: "host-01", region: "west-C", gpuModel: "RTX 4090", vramGB: 24,
      freeDiskGB: 50, maxExtraDiskGB: 200, perGPU: { cpuCores: 12, ramGB: 64 },
      billing: {
        payg: { pricePerGpu: 1.8, unit: "時" },
        day: { pricePerGpu: 30, unit: "日" },
        week: { pricePerGpu: 190, unit: "周" },
        month: { pricePerGpu: 650, unit: "月" }
      },
      availableGpu: 0, totalGpu: 8, sourceUrl: "https://www.autodl.com/market/list"
    }],
    storage: { paygCnyPerGBDay: 0.0066 },
    images: { base: [] }
  };
}

function preset() {
  return {
    schema_version: 1, merchant: "AutoDL", instance_count: 1,
    gpu: { models: ["RTX 4090"], count: 2, min_vram_gb: 24 },
    regions: ["west-C"],
    resources: { min_cpu_cores: 24, min_ram_gb: 128 },
    disk: { min_total_gb: 150, allow_paid_expansion: true, max_paid_extra_gb: 100 },
    billing: {
      mode: "payg", periods: 1, max_total_rate_cny_per_hour: 3.7,
      max_order_total_cny: null, max_storage_cny_per_day: null, auto_renew: false
    }
  };
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
}

test("whole-instance hourly rate includes only required paid disk, with stopped-machine disk fee explicit", () => {
  const result = estimate(preset(), catalog());
  assert.equal(result.offers.length, 1);
  const offer = result.offers[0];
  assert.equal(offer.gpuCount, 2);
  assert.equal(offer.freeDiskGB, 50);
  assert.equal(offer.extraDiskGB, 100);
  near(offer.computeCost, 3.6);
  near(offer.storageDailyCost, 0.66);
  near(offer.allInHourly, 3.6275);
  assert.equal(offer.orderTotal, null);
  assert.equal(offer.withinBudget, true);
  assert.equal(offer.pricingComplete, true);
  assert.equal(offer.budgetExecutable, true);
  assert.ok(offer.notes.length > 0);
});

test("zero idle stock does not erase snapshot estimates; insufficient host capacity does", () => {
  const source = catalog();
  assert.equal(estimate(preset(), source).offers[0].availableGpu, 0);
  source.offers[0].totalGpu = 1;
  assert.equal(estimate(preset(), source).offers.length, 0);
});

test("single-card pricing cannot satisfy a whole-instance cap", () => {
  const request = preset();
  request.billing.max_total_rate_cny_per_hour = 2;
  const offer = estimate(request, catalog()).offers[0];
  assert.equal(offer.withinBudget, false);
  assert.equal(offer.budgetExecutable, false);
});

test("free allocation, expansion permission, paid expansion cap and host disk limit remain distinct", () => {
  const request = preset();
  const source = catalog();
  request.disk.allow_paid_expansion = false;
  assert.equal(estimate(request, source).offers.length, 0);
  source.offers[0].freeDiskGB = 150;
  source.offers[0].maxExtraDiskGB = null;
  const free = estimate(request, source).offers[0];
  assert.equal(free.extraDiskGB, 0);
  assert.equal(free.storageDailyCost, 0);

  const limited = preset();
  limited.disk.max_paid_extra_gb = 99;
  assert.equal(estimate(limited, catalog()).offers.length, 0);
  const capacity = catalog();
  capacity.offers[0].maxExtraDiskGB = 99;
  assert.equal(estimate(preset(), capacity).offers.length, 0);
});

test("similar GPU variants and unapproved regions do not match", () => {
  const source = catalog();
  source.offers.push({ ...source.offers[0], id: "variant", gpuModel: "RTX 4090D" });
  source.offers.push({ ...source.offers[0], id: "other-region", region: "west-E" });
  assert.deepEqual(estimate(preset(), source).offers.map(x => x.offerId), ["host-01"]);
});

test("VRAM is per GPU while CPU and RAM thresholds apply to the whole requested instance", () => {
  const request = preset();
  request.gpu.min_vram_gb = 32;
  assert.equal(estimate(request, catalog()).offers.length, 0);
  request.gpu.min_vram_gb = 24;
  request.resources.min_cpu_cores = 25;
  assert.equal(estimate(request, catalog()).offers.length, 0);
  request.resources.min_cpu_cores = 24;
  request.resources.min_ram_gb = 129;
  assert.equal(estimate(request, catalog()).offers.length, 0);
  request.resources.min_ram_gb = 128;
  assert.equal(estimate(request, catalog()).offers.length, 1);
});

test("uninspected prepaid price is unknown rather than extrapolated from payg", () => {
  const request = preset();
  request.disk.min_total_gb = 50;
  request.billing.mode = "day";
  request.billing.max_order_total_cny = 100;
  const source = catalog();
  delete source.offers[0].billing.day;
  const result = estimate(request, source);
  assert.equal(result.offers[0].computeCost, null);
  assert.equal(result.offers[0].orderTotal, null);
  assert.equal(result.offers[0].withinBudget, null);
  assert.equal(result.offers[0].pricingComplete, false);
  assert.equal(result.offers[0].budgetExecutable, false);
  assert.ok(result.warnings.length > 0);
});

test("prepaid known compute multiplies card count and periods without inventing a monthly duration", () => {
  const request = preset();
  request.disk.min_total_gb = 50;
  request.billing.mode = "month";
  request.billing.periods = 3;
  request.billing.max_order_total_cny = 3900;
  let offer = estimate(request, catalog()).offers[0];
  assert.equal(offer.computeCost, 3900);
  assert.equal(offer.orderTotal, 3900);
  assert.equal(offer.storageDailyCost, 0);
  assert.equal(offer.allInHourly, null);
  assert.equal(offer.withinBudget, true);
  request.billing.max_order_total_cny = 3899.99;
  offer = estimate(request, catalog()).offers[0];
  assert.equal(offer.withinBudget, false);
});

test("payg disk rate is never silently applied to an uninspected prepaid storage policy", () => {
  const request = preset();
  request.billing.mode = "day";
  request.billing.periods = 2;
  request.billing.max_order_total_cny = 1000;
  const offer = estimate(request, catalog()).offers[0];
  assert.equal(offer.computeCost, 120);
  assert.equal(offer.storageDailyCost, null);
  assert.equal(offer.orderTotal, null);
  assert.equal(offer.allInHourly, null);
  assert.equal(offer.withinBudget, null);
  assert.equal(offer.pricingComplete, false);
  assert.equal(offer.budgetExecutable, false);
});

test("optional daily storage budget applies in addition to the combined hourly cap", () => {
  const request = preset();
  request.billing.max_storage_cny_per_day = 0.65;
  assert.equal(estimate(request, catalog()).offers[0].withinBudget, false);
  request.billing.max_storage_cny_per_day = 0.66;
  assert.equal(estimate(request, catalog()).offers[0].withinBudget, true);
});

test("unknown disk price blocks expanded-disk budget claims, while free disk needs no disk tariff", () => {
  const source = catalog();
  source.storage = {};
  let offer = estimate(preset(), source).offers[0];
  assert.equal(offer.allInHourly, null);
  assert.equal(offer.withinBudget, null);
  assert.equal(offer.pricingComplete, false);
  const request = preset();
  request.disk.min_total_gb = 50;
  offer = estimate(request, source).offers[0];
  assert.equal(offer.storageDailyCost, 0);
  assert.equal(offer.allInHourly, 3.6);
  assert.equal(offer.withinBudget, true);
});

test("unknown currency and absent budget cannot certify an executable budget", () => {
  const source = catalog();
  source.currency = "USD";
  assert.equal(estimate(preset(), source).offers[0].budgetExecutable, false);
  const request = preset();
  request.billing.max_total_rate_cny_per_hour = null;
  const result = estimate(request, catalog());
  assert.equal(result.offers[0].withinBudget, null);
  assert.equal(result.offers[0].budgetExecutable, false);
  assert.ok(result.warnings.length > 0);
});

test("invalid cardinality and missing required inputs fail without NaN or fabricated estimates", () => {
  for (const count of [0, -1, 1.5, "", null, true, Infinity]) {
    const request = preset();
    request.gpu.count = count;
    assert.equal(estimate(request, catalog()).offers.length, 0);
  }
  assert.deepEqual(estimate({}, {}).offers, []);
  const request = preset();
  request.instance_count = 2;
  assert.equal(estimate(request, catalog()).offers.length, 0);
});

test("estimation leaves both caller objects unchanged and supports classic browser script loading", () => {
  const request = preset();
  const source = catalog();
  const before = JSON.stringify({ request, source });
  estimate(request, source);
  assert.equal(JSON.stringify({ request, source }), before);
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "assets", "webui", "pricing.js"), "utf8"), context);
  assert.equal(typeof context.AutoDLPricing.estimate, "function");
  near(context.AutoDLPricing.estimate(request, source).offers[0].allInHourly, 3.6275);
});
