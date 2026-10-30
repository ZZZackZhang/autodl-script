(function (root) {
  "use strict";

  var inspectedAt = "2026-10-31";
  var sourceUrl = "https://www.autodl.com/market/list";
  // Exact visible cascader combinations; do not form a cross-product of versions.
  var observedBaseImageRows = [
    ["PyTorch", "2.8.0", "3.12(ubuntu22.04)", "12.8"],
    ["PyTorch", "2.12.1", "3.12(ubuntu22.04)", "13.0"],
    ["PyTorch", "2.5.1", "3.12(ubuntu22.04)", "12.4"],
    ["PyTorch", "2.3.0", "3.12(ubuntu22.04)", "12.1"],
    ["PyTorch", "2.1.2", "3.10(ubuntu22.04)", "11.8"],
    ["PyTorch", "2.1.0", "3.10(ubuntu22.04)", "12.1"],
    ["PyTorch", "2.0.0", "3.8(ubuntu20.04)", "11.8"],
    ["PyTorch", "1.11.0", "3.8(ubuntu20.04)", "11.3"],
    ["PyTorch", "1.10.0", "3.8(ubuntu20.04)", "11.3"],
    ["PyTorch", "1.9.0", "3.8(ubuntu18.04)", "11.1"],
    ["PyTorch", "1.8.1", "3.8(ubuntu18.04)", "11.1"],
    ["PyTorch", "1.7.0", "3.8(ubuntu18.04)", "11.0"],
    ["PyTorch", "1.6.0", "3.8(ubuntu18.04)", "10.1"],
    ["PyTorch", "1.5.1", "3.8(ubuntu18.04)", "10.1"],
    ["PyTorch", "1.1.0", "3.7(ubuntu18.04)", "10.0"],
    ["TensorFlow", "2.9.0", "3.8(ubuntu20.04)", "11.2"],
    ["TensorFlow", "2.5.0", "3.8(ubuntu18.04)", "11.2"],
    ["TensorFlow", "1.15.5", "3.8(ubuntu20.04)", "11.4"],
    ["Miniconda", "conda3", "3.7(ubuntu16.04)", "9.0"],
    ["Miniconda", "conda3", "3.8(ubuntu18.04)", "10.0"],
    ["Miniconda", "conda3", "3.8(ubuntu18.04)", "10.1"],
    ["Miniconda", "conda3", "3.8(ubuntu18.04)", "10.2"],
    ["Miniconda", "conda3", "3.8(ubuntu18.04)", "11.1"],
    ["Miniconda", "conda3", "3.8(ubuntu18.04)", "11.3"],
    ["Miniconda", "conda3", "3.8(ubuntu20.04)", "11.3(cudagl)"],
    ["Miniconda", "conda3", "3.8(ubuntu20.04)", "11.6"],
    ["Miniconda", "conda3", "3.8(ubuntu20.04)", "11.8"],
    ["Miniconda", "conda3", "3.10(ubuntu22.04)", "11.8"],
    ["tritonserver", "24.12", "3.12(ubuntu24.04)", "12.6"],
    ["JAX", "0.3.10", "3.8(ubuntu18.04)", "11.1"],
    ["PaddlePaddle", "2.2.0", "3.8(ubuntu18.04)", "11.2"],
    ["PaddlePaddle", "2.4.0", "3.8(ubuntu18.04)", "11.2"],
    ["TensorRT", "8.5.1", "3.8(ubuntu20.04)", "11.8"],
    ["TensorRT", "8.6.1", "3.8(ubuntu20.04)", "11.8"],
    ["Gromacs", "2022.2", "3.8(ubuntu18.04)", "11.4"],
    ["Gromacs", "2023.2", "3.10(ubuntu22.04)", "11.8"]
  ];
  // Columns: host ID, region, model, VRAM, CPU/GPU, RAM/GPU, free disk,
  // max paid extra disk, idle GPUs, total GPUs, displayed payg price, original price.
  var observedOfferRows = [
    ["8a1a43bc4a", "西北B区", "RTX 4090", 24, 25, 90, 50, 685, 0, 8, 1.98, 2.08],
    ["1b2041a5c3", "北京B区", "RTX 4090", 24, 16, 120, 50, 120, 1, 8, 2.18, 2.29],
    ["s72tj2swur", "北京B区", "A800-80GB-NVLink", 80, 16, 120, 50, 0, 1, 8, 7.98, 8.40],
    ["3739469e24", "北京B区", "RTX 5090", 32, 25, 90, 50, 6445, 1, 8, 2.88, 3.03],
    ["f3c348b58e", "西北B区", "RTX PRO 6000", 96, 22, 110, 50, 0, 1, 9, 6.98, 7.35],
    ["3fb9439642", "西北B区", "RTX 3080 Ti", 12, 12, 90, 50, 808, 1, 4, 1.08, 1.14],
    ["9el52ll8z4", "西北B区", "vGPU-32GB", 32, 12, 62, 50, 3983, 0, 8, 1.58, 1.66],
    ["680642a699", "西北B区", "RTX 3080x2", 20, 12, 48, 50, 3000, 0, 10, 1.28, 1.35],
    ["505f459471", "西北B区", "RTX PRO 6000", 96, 22, 110, 50, 546, 0, 9, 6.98, 7.35],
    ["4fd1438c3f", "西北B区", "vGPU-48GB", 48, 12, 90, 50, 71, 0, 10, 2.88, 3.03],
    ["a5bf4fbe10", "西北B区", "RTX 5090", 32, 25, 90, 50, 7020, 0, 8, 2.78, 2.93],
    ["ee40439ecb", "重庆A区", "vGPU-32GB", 32, 16, 62, 50, 1420, 1, 8, 1.58, 1.66],
    ["86b04fa436", "重庆A区", "RTX 4090D", 24, 16, 80, 50, 2500, 0, 12, 1.88, 1.98],
    ["3trrlc6l9f", "内蒙B区", "RTX 3080 Ti", 12, 20, 30, 50, 147, 1, 4, 1.08, 1.14],
    ["0d694697d2", "内蒙B区", "RTX 3090", 24, 14, 60, 50, 636, 1, 8, 1.48, 1.56],
    ["e9a846b5a6", "内蒙B区", "TITAN Xp", 12, 7, 15, 50, 0, 1, 7, 0.49, 0.52],
    ["lsbhpgx9bu", "内蒙B区", "RTX 3080 Ti", 12, 10, 30, 50, 586, 2, 8, 1.08, 1.14],
    ["3686439328", "内蒙B区", "RTX 4090", 24, 16, 120, 50, 716, 0, 8, 1.98, 2.08],
    ["df0d11a752", "北京A区", "RTX 3090", 24, 12, 43, 50, 0, 0, 8, 1.32, 1.39],
    ["ecb611b152", "北京A区", "RTX 3080", 10, 12, 40, 50, 200, 0, 8, 0.88, 0.93],
    ["13da1185fa", "佛山区", "V100-32GB", 32, 10, 72, 50, 50, 0, 8, 1.98, 2.08],
    ["7bda11a2fa", "佛山区", "V100-32GB", 32, 10, 72, 50, 278, 0, 8, 1.98, 2.08],
    ["d6f74e95d2", "A800专区", "A800-80GB", 80, 14, 120, 50, 0, 0, 8, 5.59, 5.88],
    ["314449b55a", "A800专区", "A800-80GB", 80, 14, 120, 50, 40, 0, 8, 5.59, 5.88],
    ["q1r3pykb7c", "摩尔线程专区", "MTT S4000", 48, 15, 100, 50, 2050, 1, 8, 1.86, 1.96],
    ["vt0rgm2v1l", "摩尔线程专区", "MTT S4000", 48, 15, 100, 50, 4000, 2, 8, 1.86, 1.96],
    ["91b911ad00", "V100专区", "V100-32GB", 32, 6, 25, 50, 4, 0, 8, 1.88, 1.98],
    ["763447a3ef", "V100专区", "V100-32GB", 32, 6, 25, 50, 150, 0, 8, 1.88, 1.98]
  ];

  root.AUTODL_CATALOG = {
    schemaVersion: 1,
    merchant: "AutoDL",
    currency: "CNY",
    inspectedAt: inspectedAt,
    inspectedAtPrecision: "date",
    inspectedTimeZone: "Australia/Sydney",
    sourceUrl: sourceUrl,
    coverage: {
      kind: "inspection_snapshot",
      isLive: false,
      isCompleteHostCatalog: false,
      modelObservationRegions: ["西北B区", "北京B区", "重庆A区", "内蒙B区", "北京A区", "佛山区", "V100专区", "A800专区", "摩尔线程专区"],
      regionalOptionGroupsObserved: 9,
      selectableModelCount: 33,
      billingTypesObserved: 4,
      hostPriceSampleRegions: ["西北B区", "北京B区", "重庆A区", "内蒙B区", "北京A区", "佛山区", "V100专区", "A800专区", "摩尔线程专区"],
      note: "2026-10-31 從 Chrome 逐一檢視 9 個地區選項組，合計 33 個可選型號，並確認 4 種計費類型。主機價格僅為各頁已檢視樣本，並非完整或即時庫存；未列報價的型號不代表免費或不可租用。",
      priceNote: "價格為檢視時頁面顯示的每 GPU 價格，可能含當時顯示的 9.5 折。僅供歷史估算；下單必須重新核對目前帳戶可取得的實際價格。",
      uninspectedPricingModes: [],
      prepaidPriceSampleHostIds: ["13da1185fa", "7bda11a2fa"],
      prepaidPriceNote: "包日、包周、包月報價只在佛山区 V100 主機 13da1185fa 與 7bda11a2fa 逐項檢視確認，不代表其他主機也已有包期報價；均為單 GPU 價格，未包含額外付費儲存。"
    },
    regions: [
      { id: "西北B区", label: "西北B区" },
      { id: "北京B区", label: "北京B区" },
      { id: "重庆A区", label: "重庆A区" },
      { id: "内蒙B区", label: "内蒙B区" },
      { id: "北京A区", label: "北京A区" },
      { id: "佛山区", label: "佛山区" },
      { id: "V100专区", label: "V100专区" },
      { id: "A800专区", label: "A800专区" },
      { id: "摩尔线程专区", label: "摩尔线程专区" }
    ],
    billingModes: [
      { id: "payg", label: "按量计费", unit: "小时" },
      { id: "day", label: "包日", unit: "日" },
      { id: "week", label: "包周", unit: "周" },
      { id: "month", label: "包月", unit: "月" }
    ],
    gpuCounts: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12],
    gpuModels: [
      { name: "vGPU-32GB", vramGB: 32, vramSource: "model_label" },
      { name: "RTX 5090", vramGB: 32, vramSource: "host_snapshot" },
      { name: "RTX PRO 6000", vramGB: 96, vramSource: "host_snapshot" },
      { name: "RTX 6000D" },
      { name: "PRO 6000 Max-Q" },
      { name: "vGPU-48GB", vramGB: 48, vramSource: "model_label" },
      { name: "RTX 5090 D" },
      { name: "RTX PRO 5000" },
      { name: "H800" },
      { name: "RTX 4090D", vramGB: 24, vramSource: "host_snapshot" },
      { name: "RTX 4090", vramGB: 24, vramSource: "host_snapshot" },
      { name: "RTX 3090", vramGB: 24, vramSource: "host_snapshot" },
      { name: "RTX 3080 Ti", vramGB: 12, vramSource: "host_snapshot" },
      { name: "RTX 3080x2", vramGB: 20, vramSource: "host_snapshot" },
      { name: "RTX A4000" },
      { name: "RTX 3060" },
      { name: "GTX 1080 Ti" },
      { name: "CPU" },
      { name: "CPU-close-HT" },
      { name: "vGPU-48GB-350W", vramGB: 48, vramSource: "model_label" },
      { name: "A800-80GB-NVLink", vramGB: 80, vramSource: "model_label" },
      { name: "vGPU-48GB-425W", vramGB: 48, vramSource: "model_label" },
      { name: "RTX 2080 Ti x2" },
      { name: "TITAN Xp", vramGB: 12, vramSource: "host_snapshot" },
      { name: "H20-NVLink" },
      { name: "V100-SXM2-32GB", vramGB: 32, vramSource: "model_label" },
      { name: "RTX 2080 Ti" },
      { name: "RTX 3080", vramGB: 10, vramSource: "host_snapshot" },
      { name: "A100-PCIE-40GB", vramGB: 40, vramSource: "model_label" },
      { name: "V100-32GB", vramGB: 32, vramSource: "model_label" },
      { name: "Tesla T4" },
      { name: "A800-80GB", vramGB: 80, vramSource: "model_label" },
      { name: "MTT S4000", vramGB: 48, vramSource: "host_snapshot" }
    ],
    storage: {
      paygCnyPerGBDay: 0.0066,
      paygRateScope: "additional_paid_data_disk_only",
      chargesWhileStopped: true,
      inspectedAt: inspectedAt,
      sourceUrl: sourceUrl,
      note: "按量付費擴容每 GB 每日 ¥0.0066，關機仍計費；不推定包日、包周或包月適用此費率。"
    },
    images: {
      base: observedBaseImageRows.map(function (row) {
        return { framework: row[0], version: row[1], python: row[2], cuda: row[3] };
      }),
      frameworks: Array.from(new Set(observedBaseImageRows.map(function (row) { return row[0]; }))),
      pythonVersions: Array.from(new Set(observedBaseImageRows.map(function (row) { return row[2]; }))),
      cudaVersions: Array.from(new Set(observedBaseImageRows.map(function (row) { return row[3]; }))),
      community: { dynamic: true, note: "使用執行時可見搜尋結果，並核對所有已設定條件。" },
      mine: { dynamic: true, note: "私人鏡像依登入帳戶而異；本快照不包含私人鏡像內容。" },
      inspectedAt: inspectedAt,
      sourceContext: "西北B区 vGPU-48GB 主機建立頁的基礎鏡像選擇器",
      note: "本次於西北B区 vGPU-48GB 主機，逐框架、版本與 Python 展開可見選項，記錄 8 個框架的完整 36 組組合；不同主機或架構可能提供不同鏡像，執行時須再次核對，不將各版本任意交叉組合。"
    },
    offers: observedOfferRows.map(function (row) {
      var billing = {
        payg: { pricePerGpu: row[10], displayedOriginalPricePerGpu: row[11], unit: "小时", priceScope: "per_gpu", includesStorage: false }
      };
      if (row[0] === "13da1185fa" || row[0] === "7bda11a2fa") {
        billing.day = { pricePerGpu: 45.6, displayedOriginalPricePerGpu: 48, unit: "日", priceScope: "per_gpu", includesStorage: false };
        billing.week = { pricePerGpu: 290.7, displayedOriginalPricePerGpu: 306, unit: "周", priceScope: "per_gpu", includesStorage: false };
        billing.month = { pricePerGpu: 1138.1, displayedOriginalPricePerGpu: 1198, unit: "月", priceScope: "per_gpu", includesStorage: false };
      }
      return {
        id: row[0],
        region: row[1],
        gpuModel: row[2],
        vramGB: row[3],
        perGPU: { cpuCores: row[4], ramGB: row[5] },
        freeDiskGB: row[6],
        maxExtraDiskGB: row[7],
        availableGpu: row[8],
        totalGpu: row[9],
        billing: billing,
        priceBasis: "market_display_snapshot",
        discountGuaranteed: false,
        inspectedAt: inspectedAt,
        sourceUrl: sourceUrl,
        note: "市場頁面顯示價快照；可能含檢視時的 9.5 折，不保證執行時仍可取得。最終建立實例前須重新核對實際價格。"
      };
    })
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
