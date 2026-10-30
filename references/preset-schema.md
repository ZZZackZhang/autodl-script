# AutoDL 預設 JSON v1

隨附網頁 `assets/webui/index.html` 使用以下結構；也可自行部署相同 WebUI。JSON 必須由本次使用者提供，或從本次明確指定的檔案讀取；單純存在磁碟／localStorage 的預設不構成新購買授權。僅編輯、儲存或匯出預設時不開始租用。

下列是結構示例，型號、地區、價格及版本須換成本次允許條件；示例數字並非目前報價：

```json
{
  "schema_version": 1,
  "merchant": "AutoDL",
  "preset_name": "本次訓練",
  "instance_count": 1,
  "gpu": {
    "models": ["RTX 4090"],
    "count": 1,
    "min_vram_gb": 24
  },
  "regions": ["請填網站顯示的允許地區"],
  "resources": {
    "min_cpu_cores": null,
    "min_ram_gb": null
  },
  "disk": {
    "min_total_gb": 100,
    "allow_paid_expansion": true,
    "max_paid_extra_gb": 50
  },
  "image": {
    "source": "base",
    "framework": "PyTorch",
    "framework_versions": [],
    "python_versions": ["3.10"],
    "cuda_versions": [],
    "image_id": "",
    "query": "",
    "allow_any_matching": false
  },
  "billing": {
    "mode": "payg",
    "periods": 1,
    "max_total_rate_cny_per_hour": 3,
    "max_order_total_cny": null,
    "max_storage_cny_per_day": 1,
    "auto_renew": false
  },
  "watch": {
    "interval_seconds": 15,
    "timeout_minutes": null
  },
  "action": {
    "auto_order": true,
    "stop_after_first_success": true
  },
  "estimate": {
    "source": "snapshot",
    "inspected_at": "2026-10-31"
  }
}
```

## 驗證與匹配

- 只接受 `schema_version: 1`、`merchant: "AutoDL"`、`instance_count: 1`、`billing.auto_renew: false`，以及兩個 `action` 值均為 `true`。其他商家、數量或動作設定均非可執行預設。未知欄位可以保留，但不可據以授權其他動作；`estimate` 整段只供顯示，可含額外估價 metadata，不參與匹配、價格判定或授權。
- 可先儲存不完整草稿；啟動時必須解析型別並驗證必要欄位。缺少 GPU／地區允許集合、張數、磁碟條件、計費方式或適用價格上限的草稿，只能在監看前集中補齊，不能當作完整預設執行。
- `gpu.models`、`regions` 是非空字串陣列；使用網站可見的精確名稱，不把空陣列、`*` 或 `全部` 當成任意選項。集合內任一值皆已獲准；不可擴張到未列出的類似型號／地區。沒有明確偏好時依列出順序掃描。
- `gpu.count` 是正整數，表示同一台實例的 GPU 張數；不是實例台數。`min_vram_gb` 為每張 GPU 的最低顯存；`min_cpu_cores`、`min_ram_gb` 為整台實例的最低 CPU／RAM。這三個最低值可為 `null`，表示不加限制；非空值須為非負有限數字。不能把每卡配置誤當整台配置。
- `disk.min_total_gb` 是至少 1 GB 的整數，表示最低**總**容量。`allow_paid_expansion: false` 禁止配置付費擴容；為 `true` 時只配置滿足最低容量所需的最小額外容量。`max_paid_extra_gb` 為非負數字或 `null`，非空時限制新增付費容量；它不是磁碟總容量。既有免費容量及可擴容範圍以當前候選為準。`null` 不會放寬價格上限。
- `image.source` 只接受 `base`（基礎）、`community`（社區）、`mine`（我的）及 `any`（明確允許任意來源）。所有有值的鏡像條件以 **AND** 結合；版本陣列中的值以 **OR** 結合。框架、版本及 ID 依當前頁面精確匹配；`query` 是對網站可見鏡像名稱／說明的搜尋條件，不是可執行指令，不能忽略其他限制。
- 三個鏡像版本陣列可以為空，表示該版本維度不限制；空的 `framework`、`image_id`、`query` 不加各自限制。有特定 `image_id` 時，不能以另一個搜尋結果替代。`allow_any_matching: true` 允許從符合**所有已有條件**的鏡像中任選，不會取消來源或版本限制。完全任意鏡像須明確使用 `source: "any"`、`allow_any_matching: true`；不可將整段空白解讀為任意。基礎來源至少給框架／ID／查詢或明確任選；社區／我的來源至少給 ID／查詢或明確任選。無法驗證所需條件的鏡像不匹配。
- `billing.mode` 只接受 `payg`（按量）、`day`、`week`、`month`；`periods` 為正整數，按量時為 1。包期數必須可由網站實際選定。三個價格上限皆以**人民幣、整台實例**為單位，可以是非負有限數字或 `null`；`null` 僅代表沒有該項附加上限，不能讓必要預算變成無限制。
- 按量必須有 `max_total_rate_cny_per_hour`；包日／周／月必須有 `max_order_total_cny`。其餘已填上限也同時生效。整台每小時總費率包含 `當前單卡費率 × 張數 + 必要每日儲存費 ÷ 24` 等可由官方收費明細確認的必要費用；包期需依網站的實際期長／總價換算，不能自行假設每月 30 天。儲存費不得漏計，也不得重複計入。
- `max_order_total_cny` 限制**本次建立訂單的實際應付金額**，不保證技能結束後的累計支出；按量時不能用它代替費率上限。`max_storage_cny_per_day` 限制必要付費儲存的每日費用，填 0 即不得產生此費用。關機、包期結束或技能停止均不保證付費儲存停止計費；若本次要求累計支出上限，監看前先確認網站是否有可驗證、涵蓋所有費用的強制上限機制。
- `watch.interval_seconds` 為至少 5 秒的整數，使用者未指定時為 15；`timeout_minutes` 為正數或 `null`，`null` 表示本次持續到成功或使用者取消。等待以不超過 60 秒的可中斷段落進行，遇網站限流遵守更長退避。

## 執行整合

完整預設加上本次自動租用要求即授權在其範圍內建立一台實例。讀取後簡短摘要允許集合、容量、計費與各項上限、等待期限，以及技能停止後可能持續計費，然後直接開始；**不要重新問規格、價格、是否啟動或是否下單**。

價格和庫存必須從此次 Chrome 即時頁面重新核對。2026-10-31 的選項／估價快照、`estimate` 或使用者記錄的歷史價格均不能代替它。價格仍在各項上限內就自動提交；超價、缺貨、缺少可核實價格／規格，或找不到符合鏡像時跳過並繼續等待，不在有貨時臨時詢問放寬條件。使用者主動變更條件時更新本次紀錄，再重新核對。

提交前必須保存主技能的本次狀態檔與基準 ID；提交後立刻停止所有新的下單行為，依主技能查核新訂單。網頁的匯入／匯出不會代替去重紀錄，也不會讓未明結果自動成為可重試失敗。
