(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AutoDLPricing = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function number(value) {
    if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function positiveInteger(value) {
    var parsed = number(value);
    return parsed !== null && parsed > 0 && Number.isInteger(parsed) ? parsed : null;
  }

  function list(value) {
    return Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
  }

  function modelName(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  function within(value, cap) {
    return value <= cap + Math.max(1e-9, Math.abs(cap) * 1e-12);
  }

  function estimate(preset, catalog) {
    preset = preset || {};
    catalog = catalog || {};
    var warnings = [];
    var warningSet = new Set();
    function warn(message) {
      if (!warningSet.has(message)) {
        warningSet.add(message);
        warnings.push(message);
      }
    }

    var gpu = preset.gpu || {};
    var disk = preset.disk || {};
    var billingPreset = preset.billing || {};
    var resources = preset.resources || {};
    var selectedModels = list(gpu.models).map(modelName);
    var selectedRegions = list(preset.regions);
    var gpuCount = positiveInteger(gpu.count);
    var diskGB = number(disk.min_total_gb);
    var expansionAllowed = disk.allow_paid_expansion;
    var maxPaidExtra = number(disk.max_paid_extra_gb);
    var mode = billingPreset.mode;
    var periods = positiveInteger(billingPreset.periods === undefined ? 1 : billingPreset.periods);
    var priceCap = number(mode === "payg" ? billingPreset.max_total_rate_cny_per_hour : billingPreset.max_order_total_cny);
    var storageCap = number(billingPreset.max_storage_cny_per_day);
    var minVram = number(gpu.min_vram_gb) || 0;
    var minCpu = number(resources.min_cpu_cores) || 0;
    var minRam = number(resources.min_ram_gb) || 0;

    if (catalog.currency !== "CNY") warn("資料來源幣別未確認為人民幣 CNY，無法驗證預算。");
    if (!Array.isArray(catalog.offers) || !catalog.offers.length) warn("目前沒有可估價的主機快照。");
    if (!selectedModels.length) warn("請選擇可接受的 GPU 型號。");
    if (!gpuCount) warn("GPU 張數必須是正整數。");
    if (diskGB === null) warn("請填寫有效的數據盤總容量。");
    if (!["payg", "day", "week", "month"].includes(mode)) warn("請選擇有效的計費方式。");
    if (mode !== "payg" && !periods) warn("預付期數必須是正整數。");
    if (priceCap === null || priceCap === 0) warn("請設定整台實例的有效價格上限，才能判斷是否符合預算。");
    if (preset.instance_count !== undefined && preset.instance_count !== 1) warn("此設定僅支援建立一台實例。");

    if (!selectedModels.length || !gpuCount || diskGB === null || !["payg", "day", "week", "month"].includes(mode) || (mode !== "payg" && !periods) || (preset.instance_count !== undefined && preset.instance_count !== 1)) {
      return { offers: [], warnings: warnings };
    }

    var rejected = { capacity: 0, disk: 0, expansion: 0, expansionCap: 0, vram: 0, cpu: 0, ram: 0 };
    var offers = catalog.offers.filter(function (offer) {
      if (!selectedModels.includes(modelName(offer.gpuModel))) return false;
      if (selectedRegions.length && !selectedRegions.includes(offer.region)) return false;
      var totalGpu = number(offer.totalGpu);
      if (totalGpu === null || totalGpu < gpuCount) { rejected.capacity += 1; return false; }
      var freeDisk = number(offer.freeDiskGB);
      var maxExtra = number(offer.maxExtraDiskGB);
      if (freeDisk === null) { rejected.disk += 1; return false; }
      var extra = Math.max(0, diskGB - freeDisk);
      if (extra > 0 && (maxExtra === null || extra > maxExtra)) { rejected.disk += 1; return false; }
      if (extra > 0 && expansionAllowed !== true) { rejected.expansion += 1; return false; }
      if (maxPaidExtra !== null && extra > maxPaidExtra) { rejected.expansionCap += 1; return false; }
      var vram = number(offer.vramGB);
      if (minVram > 0 && (vram === null || vram < minVram)) { rejected.vram += 1; return false; }
      var perGPU = offer.perGPU || {};
      var cpu = number(perGPU.cpuCores);
      var ram = number(perGPU.ramGB);
      if (minCpu > 0 && (cpu === null || cpu * gpuCount < minCpu)) { rejected.cpu += 1; return false; }
      if (minRam > 0 && (ram === null || ram * gpuCount < minRam)) { rejected.ram += 1; return false; }
      return true;
    }).map(function (offer) {
      var notes = [];
      var freeDiskGB = number(offer.freeDiskGB);
      var extraDiskGB = Math.max(0, diskGB - freeDiskGB);
      var billing = offer.billing && offer.billing[mode];
      var price = billing ? number(billing.pricePerGpu) : null;
      var computeCost = price === null ? null : price * gpuCount * (mode === "payg" ? 1 : periods);
      var dailyStorageRate = mode === "payg" ? number(catalog.storage && catalog.storage.paygCnyPerGBDay) : null;
      var storageDailyCost = extraDiskGB === 0 ? 0 : dailyStorageRate === null ? null : extraDiskGB * dailyStorageRate;
      var allInHourly = null;
      var orderTotal = null;

      if (computeCost === null) {
        notes.push("尚未查得此主機在所選計費方式下的實際價格。");
        warn("部分主機缺少所選計費方式的價格；未套用其他方案或推算折扣。");
      }
      if (storageDailyCost === null) {
        notes.push(mode === "payg" ? "數據盤擴容單價未確認。" : "此預付方案的磁碟計費方式尚未確認，不能套用按量擴容費率。");
        warn(mode === "payg" ? "按量磁碟費率未確認，含擴容的總費率無法驗證。" : "預付方案的磁碟費用未查證，含擴容的應付總額無法驗證。");
      }
      if (computeCost !== null && storageDailyCost !== null) {
        if (mode === "payg") {
          allInHourly = computeCost + storageDailyCost / 24;
          notes.push("按量為持續計費，沒有固定訂單總額；磁碟擴容費可能在關機後繼續產生。");
        } else {
          orderTotal = computeCost;
        }
      }
      var pricingComplete = computeCost !== null && storageDailyCost !== null && catalog.currency === "CNY";
      var amount = mode === "payg" ? allInHourly : orderTotal;
      var withinBudget = pricingComplete && priceCap !== null && priceCap > 0 ? within(amount, priceCap) : null;
      if (storageCap !== null) {
        withinBudget = storageDailyCost === null ? null : withinBudget === null ? null : withinBudget && within(storageDailyCost, storageCap);
      }
      if (extraDiskGB > 0 && expansionAllowed !== true) withinBudget = null;

      return {
        offerId: offer.id,
        region: offer.region,
        gpuModel: offer.gpuModel,
        gpuCount: gpuCount,
        freeDiskGB: freeDiskGB,
        extraDiskGB: extraDiskGB,
        computeCost: computeCost,
        storageDailyCost: storageDailyCost,
        allInHourly: allInHourly,
        orderTotal: orderTotal,
        withinBudget: withinBudget,
        pricingComplete: pricingComplete,
        budgetExecutable: pricingComplete && withinBudget === true,
        availableGpu: number(offer.availableGpu),
        notes: notes
      };
    });

    if (rejected.capacity) warn("部分主機的總 GPU 張數不足；不會把不同主機拼成一台。");
    if (rejected.disk) warn("部分主機無法提供所需的數據盤總容量。");
    if (rejected.expansion) warn("需要付費擴容的主機已排除；目前未允許付費擴容。");
    if (rejected.expansionCap) warn("部分主機所需的付費擴容容量超過設定上限。");
    if (rejected.vram) warn("部分主機的單卡顯存未達要求或未確認。");
    if (rejected.cpu) warn("部分主機可分配的整台 CPU 核心數未達要求或未確認。");
    if (rejected.ram) warn("部分主機可分配的整台 RAM 未達要求或未確認。");
    if (!offers.length) warn("目前快照沒有符合硬體、地區與磁碟條件的可估價主機；這不代表未來不會出現庫存。");

    return { offers: offers, warnings: warnings };
  }

  return { estimate: estimate };
});
