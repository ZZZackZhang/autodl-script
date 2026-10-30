# AutoDL 自動租用技能與規格設定器

先一次設定所有可接受的規格與預算，再由技能持續查看 AutoDL 庫存。完整條件內出現可租用主機時，**直接自動下單一台，確認成功後停止監看**；有貨時不再詢問型號、鏡像、價格或是否下單。

本專案包含可安裝的 `$autodl-auto-rent` 技能，以及可離線使用的規格設定網頁。網頁負責設定、估價與匯出；實際租用由執行技能的代理操作已登入的 Chrome 完成。僅安裝、編輯或匯出預設不會開始租用。

## 前置條件

- 可使用自訂技能，並具備瀏覽器／電腦操作工具的代理環境。
- 已登入 AutoDL 的 Chrome，以及可用的 Chrome 工具橋接；環境若支援原生 Chrome 操作，也可依技能指引使用。
- Python 3：用於安裝技能，或啟動可選的本機 HTTP 伺服器。
- 支援 `node --test` 的 Node.js：用於執行測試。規格網頁本身不需要 Node.js。

本專案不保存帳號密碼、cookie 或付款憑證，不自動充值，也不安裝背景監看服務。

## 取得與安裝

```sh
git clone https://github.com/ZZZackZhang/autodl-script.git
cd autodl-script
python3 scripts/install_skill.py
```

安裝程式預設不覆寫已存在的技能。確定要替換既有版本時，明確加上 `--replace`：

```sh
python3 scripts/install_skill.py --replace
```

## 開啟規格設定器

直接用瀏覽器開啟 `assets/webui/index.html` 即可離線使用。也可以在專案根目錄啟動本機伺服器：

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory assets/webui
```

接著開啟 [本機規格設定器](http://localhost:8765)。預設儲存在目前瀏覽器的本機儲存空間；可匯出 JSON，方便備份、換裝置或交給技能。清除瀏覽器資料可能會移除已儲存的預設。

## 設定並開始租用

1. 在網頁列出**所有可接受條件**：GPU 型號與張數、地區、最低顯存／CPU／RAM、數據盤總容量、付費擴容許可與容量上限、鏡像來源及版本條件。
2. 設定計費方式、適用的價格上限、可選的每日儲存費上限，以及刷新間隔與等待期限。按量使用整台含必要儲存費的每小時上限；包日／周／月使用本次全部期數的訂單總額上限。
3. 複製網頁產生的執行指令，貼到支援技能的對話中；或提供匯出的 JSON 並明確要求 `$autodl-auto-rent` 依該預設自動租用。
4. 技能驗證完整預設，摘要條件後直接開始。只有缺少必要條件時，才會在監看開始前集中補齊。

符合條件就自動下單；超價、不符規格或無法核實的候選會被略過，繼續等待。靜態估價不會變成購買授權，也不會取代下單當時的實際報價。新增型號、提高預算或放寬鏡像條件，都必須由使用者明確變更。

技能每次只建立一台實例。提交後會核對新增的實例／訂單 ID；網站已接受、仍在建立或開機中的訂單也會停止後續搶購。提交結果不明時會先查核，不能把逾時當作失敗再買一台。登入失效、工具無法核實操作頁面等阻礙會停止並回報。

監看需要代理的執行工作持續進行；它不是離開對話後仍自行運作的背景服務。

## 估價資料的範圍

內附資料是 **2026-10-31（Australia/Sydney）** 的人工操作檢視快照：

| 項目 | 已檢視範圍 |
| --- | --- |
| 地區選項 | 9 個地區 |
| 可選型號 | 33 個型號 |
| 主機價格樣本 | 28 台主機 |
| 基礎鏡像 | 8 個框架、36 組完整版本組合 |

**價格只有部分主機樣本，並非完整或即時價目表。** 並非每個可選型號都有價格；包期價格也只在部分樣本逐項確認。畫面當時顯示的折扣不保證目前帳戶仍可取得，未檢視的價格與儲存計費方式不會由其他方案推算。

鏡像組合來自西北 B 區一台 vGPU-48GB 主機的實際選擇器；其他主機或架構可能不同。社區與私人鏡像依執行時可見內容匹配，公開快照不包含私人鏡像內容。

按量估價會區分單卡與整台費用、免費數據盤與額外付費容量，並將必要每日儲存費換算納入每小時比較。**技能停止不會關閉實例；付費數據盤在實例關機後仍可能繼續收費。** 費率上限或本次訂單金額上限不等於整段使用期間的累計支出上限，實際費用須依 AutoDL 當前規則核對。

## 測試

在專案根目錄執行其中一個指令：

```sh
npm test
```

```sh
node --test tests/pricing.test.cjs
```

測試驗證價格計算與重要邊界條件；不會登入 AutoDL、建立實例或產生租用費用。

## English

An AutoDL rental skill with an offline preset editor. Set all acceptable hardware, regions, disk, image constraints and spending limits up front. A complete preset lets the skill watch inventory, automatically order **one** matching instance, verify the order and stop—without asking again when stock appears.

Open `assets/webui/index.html`, or serve it with `python3 -m http.server 8765 --bind 127.0.0.1 --directory assets/webui`. Install with `python3 scripts/install_skill.py`; existing installations require explicit `--replace`. Run `npm test` or `node --test tests/pricing.test.cjs`.

The bundled 2026-10-31 snapshot contains 9 regions, 33 selectable models, 28 host-price samples and 36 image combinations. Prices are partial historical samples, not live quotes. Execution requires a signed-in Chrome session and supported browser/computer tools. No credentials are stored and no background service is installed. Stopping the skill does not stop the instance, and paid storage may remain billable even while the instance is off.
