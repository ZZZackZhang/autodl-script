(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const catalog = window.AUTODL_CATALOG || {};
  const STORAGE_KEY = 'autodl-rental-presets-v1';
  const selectedModels = new Set();
  const selectedRegions = new Set();
  const rawModels = Array.isArray(catalog.gpuModels) ? catalog.gpuModels : [];
  const models = rawModels.map((item) => typeof item === 'string' ? { name: item } : item).filter((item) => item && typeof item.name === 'string');
  const regions = (Array.isArray(catalog.regions) ? catalog.regions : []).map((item) => typeof item === 'string' ? { id: item, label: item } : item).filter((item) => item && (item.id || item.label));
  const knownModelNames = new Set(models.map((item) => item.name));
  const knownRegionNames = new Set(regions.map((item) => item.id || item.label));
  const billingLabels = { payg: '按量計費', day: '包日', week: '包周', month: '包月' };
  const billingUnits = { payg: '小時', day: '日', week: '周', month: '月' };
  let savedPresets = [];
  let currentPresetId = '';
  let showValidation = false;
  let currentInvocation = '';
  let storageUnavailable = false;

  function splitList(value) {
    return [...new Set(String(value || '').split(/[,，、\n]+/).map((part) => part.trim()).filter(Boolean))];
  }

  function isWildcard(value) {
    return ['*', 'all', 'any', '不限', '全部', '任意', '任選'].includes(String(value).trim().toLocaleLowerCase());
  }

  function numberValue(id) {
    const value = $(id).value.trim();
    if (value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function money(value, digits) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '未檢視';
    return '¥' + value.toLocaleString('zh-TW', { minimumFractionDigits: digits === undefined ? 2 : digits, maximumFractionDigits: digits === undefined ? 2 : digits });
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function announce(message, isError) {
    const notice = $('notification');
    notice.textContent = message;
    notice.className = 'notification' + (isError ? ' error' : '');
    notice.hidden = false;
  }

  function inspectedDate() {
    return catalog.inspectedAt || catalog.inspected_at || null;
  }

  function makeChoice(value, label, hint, group, checkedSet) {
    const wrapper = element('label', 'choice');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = group;
    input.value = value;
    input.checked = checkedSet.has(value);
    const text = element('span', 'choice-label');
    text.append(element('strong', '', label));
    if (hint) text.append(element('small', '', hint));
    wrapper.append(input, text);
    input.addEventListener('change', () => {
      if (input.checked) checkedSet.add(value); else checkedSet.delete(value);
      update();
    });
    return wrapper;
  }

  function renderGpuOptions() {
    const target = $('gpu-options');
    target.replaceChildren();
    const query = $('gpu-search').value.trim().toLocaleLowerCase();
    const visible = models.filter((model) => !query || model.name.toLocaleLowerCase().includes(query));
    visible.forEach((model) => {
      const memories = Array.isArray(model.vramGB) ? model.vramGB : (Number.isFinite(model.vramGB) ? [model.vramGB] : []);
      let hint = memories.length ? memories.join(' / ') + ' GB 顯存' : '依主機規格';
      if (model.kind === 'cpu' || model.name.toUpperCase().startsWith('CPU')) hint = 'CPU 算力';
      target.append(makeChoice(model.name, model.name, hint, 'gpu-model', selectedModels));
    });
    if (!visible.length) target.append(element('div', 'empty-catalog', query ? '沒有符合的已檢視型號。可在下方加入其他型號。' : '尚未載入已檢視型號。可在下方填寫完整型號。'));
  }

  function renderRegionOptions() {
    const target = $('region-options');
    target.replaceChildren();
    regions.forEach((region) => target.append(makeChoice(region.id || region.label, region.label || region.id, '', 'region', selectedRegions)));
    if (!regions.length) target.append(element('div', 'empty-catalog', '尚未載入已檢視地區。可在下方填寫地區名稱。'));
  }

  function baseImages() {
    if (Array.isArray(catalog.images)) return catalog.images;
    if (catalog.images && Array.isArray(catalog.images.base)) return catalog.images.base;
    return [];
  }

  function setDatalist(id, values) {
    const target = $(id);
    target.replaceChildren();
    [...new Set(values.filter((value) => value !== undefined && value !== null && String(value).trim()).map(String))].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      target.append(option);
    });
  }

  function updateImageOptions() {
    const images = baseImages();
    const framework = $('image-framework').value.trim().toLocaleLowerCase();
    const filtered = images.filter((image) => !framework || String(image.framework || image.name || '').toLocaleLowerCase() === framework);
    const extras = catalog.images || {};
    setDatalist('framework-options', [...images.map((image) => typeof image === 'string' ? image : (image.framework || image.name)), ...(Array.isArray(extras.frameworks) ? extras.frameworks : [])]);
    setDatalist('framework-version-options', filtered.map((image) => image.frameworkVersion || image.framework_version || image.version));
    setDatalist('python-options', [...filtered.map((image) => image.pythonVersion || image.python_version || image.python), ...(Array.isArray(extras.pythonVersions) ? extras.pythonVersions : [])]);
    setDatalist('cuda-options', [...filtered.map((image) => image.cudaVersion || image.cuda_version || image.cuda), ...(Array.isArray(extras.cudaVersions) ? extras.cudaVersions : [])]);
    renderImageCombinations();
  }

  function renderImageCombinations() {
    const frameworkQuery = $('image-framework').value.trim().toLocaleLowerCase();
    const all = baseImages().filter((image) => image && typeof image === 'object' && typeof image.framework === 'string');
    const rows = all.filter((image) => !frameworkQuery || image.framework.toLocaleLowerCase().includes(frameworkQuery));
    const body = $('image-combination-rows');
    body.replaceChildren();
    rows.forEach((image) => {
      const row = document.createElement('tr');
      [image.framework, image.frameworkVersion || image.framework_version || image.version, image.pythonVersion || image.python_version || image.python, image.cudaVersion || image.cuda_version || image.cuda].forEach((value) => {
        row.append(element('td', '', value === undefined || value === null || value === '' ? '未檢視' : String(value)));
      });
      body.append(row);
    });
    $('image-combination-count').textContent = frameworkQuery ? rows.length + ' / ' + all.length + ' 組' : all.length + ' 組';
    $('image-combination-table-wrap').hidden = rows.length === 0;
    const empty = $('image-combination-empty');
    empty.hidden = rows.length > 0;
    empty.textContent = all.length === 0 ? '尚未載入已檢視的基礎鏡像組合；仍可在上方手動指定條件。' : '沒有符合目前框架輸入的檢視組合。可清空框架欄位查看全部，或保留自行指定的條件。';
  }

  function buildPreset() {
    const mode = $('billing-mode').value;
    const source = $('image-source').value;
    return {
      schema_version: 1,
      merchant: 'AutoDL',
      preset_name: $('preset-name').value.trim(),
      instance_count: 1,
      gpu: { models: [...new Set([...selectedModels, ...splitList($('custom-gpu').value)])], count: numberValue('gpu-count'), min_vram_gb: numberValue('min-vram') },
      regions: [...new Set([...selectedRegions, ...splitList($('custom-regions').value)])],
      resources: { min_cpu_cores: numberValue('min-cpu'), min_ram_gb: numberValue('min-ram') },
      disk: { min_total_gb: numberValue('disk-total'), allow_paid_expansion: $('allow-expansion').checked, max_paid_extra_gb: numberValue('disk-extra-max') },
      image: { source: source, framework: $('image-framework').value.trim(), framework_versions: splitList($('framework-versions').value), python_versions: splitList($('python-versions').value), cuda_versions: splitList($('cuda-versions').value), image_id: $('image-id').value.trim(), query: $('image-query').value.trim(), allow_any_matching: source === 'any' || $('allow-any-image').checked },
      billing: { mode: mode, periods: mode === 'payg' ? 1 : numberValue('billing-periods'), max_total_rate_cny_per_hour: mode === 'payg' ? numberValue('price-cap') : null, max_order_total_cny: mode === 'payg' ? null : numberValue('price-cap'), max_storage_cny_per_day: numberValue('storage-cap'), auto_renew: false },
      watch: { interval_seconds: numberValue('refresh-seconds'), timeout_minutes: numberValue('timeout-minutes') },
      action: { auto_order: true, stop_after_first_success: true },
      estimate: { source: 'snapshot', inspected_at: inspectedDate() }
    };
  }

  function validatePreset(preset) {
    const errors = [];
    if (!preset.gpu.models.length) errors.push('請選取至少一個可接受的 GPU 型號。');
    if (!preset.regions.length) errors.push('請選取至少一個可接受的地區。');
    if (preset.gpu.models.some(isWildcard)) errors.push('GPU 型號須逐一列出，不能用「全部」或萬用字元。');
    if (preset.regions.some(isWildcard)) errors.push('地區須逐一列出，不能用「不限」或萬用字元。');
    if ([...preset.image.framework_versions, ...preset.image.python_versions, ...preset.image.cuda_versions].some(isWildcard)) errors.push('版本不限時請留空；有版本條件時須列出明確版本。');
    if (!Number.isInteger(preset.gpu.count) || preset.gpu.count < 1 || preset.gpu.count > 128) errors.push('GPU 張數必須為 1–128 的整數。');
    if (!Number.isInteger(preset.disk.min_total_gb) || preset.disk.min_total_gb < 1) errors.push('請設定數據盤總容量，至少 1 GB。');
    ['min_vram_gb'].forEach((field) => { if (preset.gpu[field] !== null && preset.gpu[field] < 0) errors.push('最低顯存不能為負數。'); });
    if (preset.resources.min_cpu_cores !== null && (!Number.isInteger(preset.resources.min_cpu_cores) || preset.resources.min_cpu_cores < 0)) errors.push('最低 CPU 核心數須為非負整數。');
    if (preset.resources.min_ram_gb !== null && preset.resources.min_ram_gb < 0) errors.push('最低記憶體不能為負數。');
    if (preset.disk.max_paid_extra_gb !== null && (!Number.isInteger(preset.disk.max_paid_extra_gb) || preset.disk.max_paid_extra_gb < 0)) errors.push('額外付費容量上限須為非負整數。');
    const cap = preset.billing.mode === 'payg' ? preset.billing.max_total_rate_cny_per_hour : preset.billing.max_order_total_cny;
    if (cap === null || cap <= 0) errors.push(preset.billing.mode === 'payg' ? '請設定整台實例含儲存費的每小時價格上限。' : '請設定本次購買全部期數的總價上限。');
    if (!Number.isInteger(preset.billing.periods) || preset.billing.periods < 1) errors.push('購買期數必須為至少 1 的整數。');
    if (preset.billing.max_storage_cny_per_day !== null && preset.billing.max_storage_cny_per_day < 0) errors.push('數據盤每日費用上限不能為負數。');
    if (!Number.isInteger(preset.watch.interval_seconds) || preset.watch.interval_seconds < 5) errors.push('刷新間隔必須為至少 5 秒的整數。');
    if (preset.watch.timeout_minutes !== null && (!Number.isInteger(preset.watch.timeout_minutes) || preset.watch.timeout_minutes < 1)) errors.push('最長等待時間必須為至少 1 分鐘的整數，或留空持續等待。');
    if (preset.image.source === 'base' && !preset.image.framework && !preset.image.query && !preset.image.image_id && !preset.image.allow_any_matching) errors.push('請指定基礎鏡像框架、名稱或 ID，或明確允許任選符合版本條件的鏡像。');
    if (['community', 'mine'].includes(preset.image.source) && !preset.image.query && !preset.image.image_id && !preset.image.allow_any_matching) errors.push('請指定鏡像搜尋條件／ID，或明確允許任選。');
    return errors;
  }

  function renderValidation(errors) {
    const target = $('validation-errors');
    target.replaceChildren();
    target.hidden = !showValidation || errors.length === 0;
    if (target.hidden) return;
    target.append(element('p', '', '完成以下設定，即可交給技能執行：'));
    const list = document.createElement('ul');
    errors.forEach((error) => list.append(element('li', '', error)));
    target.append(list);
  }

  function addSummary(label, value, missing) {
    const row = document.createElement('div');
    row.append(element('dt', '', label), element('dd', missing ? 'missing' : '', value));
    $('selection-summary').append(row);
  }

  function renderSummary(preset, errors) {
    $('selection-summary').replaceChildren();
    addSummary('GPU', preset.gpu.models.length ? preset.gpu.models.join('、') + ' × ' + (preset.gpu.count || '?') + ' 張' : '尚未選取', !preset.gpu.models.length);
    addSummary('地區', preset.regions.length ? preset.regions.join('、') : '尚未選取', !preset.regions.length);
    addSummary('數據盤', (preset.disk.min_total_gb || '?') + ' GB 起 · ' + (preset.disk.allow_paid_expansion ? '可付費擴容' : '僅免費容量'));
    const imageNames = { base: '基礎鏡像', community: '社區鏡像', mine: '我的鏡像', any: '任一來源' };
    const imageDetail = preset.image.image_id || preset.image.query || preset.image.framework || (preset.image.allow_any_matching ? '任選符合條件' : '待設定');
    addSummary('鏡像', imageNames[preset.image.source] + ' · ' + imageDetail, imageDetail === '待設定');
    const cap = preset.billing.mode === 'payg' ? preset.billing.max_total_rate_cny_per_hour : preset.billing.max_order_total_cny;
    addSummary('價格上限', cap === null ? '尚未設定' : '¥' + cap.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + (preset.billing.mode === 'payg' ? ' / 小時，含儲存' : ' / 本次 ' + preset.billing.periods + ' ' + billingUnits[preset.billing.mode]), cap === null);
    addSummary('監看', '每 ' + (preset.watch.interval_seconds || '?') + ' 秒 · ' + (preset.watch.timeout_minutes === null ? '直到成功或取消' : '最多 ' + preset.watch.timeout_minutes + ' 分鐘'));
    $('readiness').textContent = errors.length ? '尚有 ' + errors.length + ' 項待設定' : '可直接執行';
    $('readiness').className = 'readiness' + (errors.length ? '' : ' ready');
    $('gpu-selection-count').textContent = preset.gpu.models.length ? preset.gpu.models.length + ' 個可接受型號' : '尚未選取';
  }

  function estimate(preset) {
    if (!preset.gpu.models.length || !preset.regions.length) return { offers: [], warnings: [] };
    if (!window.AutoDLPricing || typeof window.AutoDLPricing.estimate !== 'function') return { offers: [], warnings: ['尚未載入價格試算資料。'] };
    try {
      const result = window.AutoDLPricing.estimate(preset, catalog);
      return { offers: Array.isArray(result.offers) ? result.offers : [], warnings: Array.isArray(result.warnings) ? result.warnings : [] };
    } catch (error) {
      return { offers: [], warnings: ['目前條件沒有可計算的檢視價格。完整預設仍會在執行時核對網站實價。'] };
    }
  }

  function renderOfferList(offers, mode) {
    const target = $('offer-list');
    target.replaceChildren();
    $('offer-count').textContent = offers.length + ' 項';
    if (!offers.length) {
      target.append(element('p', 'empty-catalog', '目前範圍沒有可對照的已檢視報價。調整條件可查看其他檢視項目。'));
      return;
    }
    offers.slice(0, 100).forEach((offer) => {
      const row = element('div', 'offer-item');
      const head = element('div', 'offer-item-top');
      head.append(element('strong', '', offer.gpuModel || '未提供型號'), element('span', '', mode === 'payg' ? money(offer.allInHourly, 3) + ' / 時' : money(offer.orderTotal) + ' / 本次'));
      row.append(head);
      const availability = Number.isFinite(offer.availableGpu) ? '檢視時空閒 ' + offer.availableGpu + ' 張' : '庫存未檢視';
      row.append(element('p', '', (offer.region || '地區未提供') + ' · ' + availability + ' · 額外付費盤 ' + (Number.isFinite(offer.extraDiskGB) ? offer.extraDiskGB + ' GB' : '未確認')));
      const notes = Array.isArray(offer.notes) ? offer.notes : [];
      if (notes.length) row.append(element('p', '', notes.join('；')));
      target.append(row);
    });
    if (offers.length > 100) target.append(element('p', 'empty-catalog', '顯示前 100 項，共 ' + offers.length + ' 項檢視報價。'));
  }

  function renderEstimate(preset) {
    const mode = preset.billing.mode;
    const result = estimate(preset);
    const costKey = mode === 'payg' ? 'allInHourly' : 'orderTotal';
    const numeric = result.offers.filter((offer) => offer.pricingComplete === true && typeof offer[costKey] === 'number' && Number.isFinite(offer[costKey]));
    numeric.sort((a, b) => a[costKey] - b[costKey]);
    const within = numeric.filter((offer) => offer.withinBudget === true);
    const preferred = within.length ? within[0] : numeric[0];
    const badge = $('estimate-badge');
    $('estimate-unit').textContent = mode === 'payg' ? '/ 小時起' : '/ 本次起';
    $('period-cost-label').textContent = mode === 'payg' ? '連續使用 24 小時' : '本次購買期數';
    if (preferred) {
      $('estimate-price').textContent = money(preferred[costKey], mode === 'payg' ? 3 : 2);
      const values = (within.length ? within : numeric).map((offer) => offer[costKey]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      $('estimate-range').textContent = (within.length ? within.length + ' 個報價在預算內' : numeric.length + ' 個可計算檢視報價') + (max > min ? ' · ' + money(min, 2) + '–' + money(max, 2) : '') + ' · ' + (preferred.region || '地區未提供');
      $('compute-cost').textContent = money(preferred.computeCost, 3) + (mode === 'payg' ? ' / 時' : ' / 本次');
      $('storage-cost').textContent = money(preferred.storageDailyCost, 3) + ' / 日';
      $('period-cost').textContent = mode === 'payg' ? money(preferred.allInHourly * 24) : preset.billing.periods + ' ' + billingUnits[mode];
      const hasCap = mode === 'payg' ? preset.billing.max_total_rate_cny_per_hour !== null : preset.billing.max_order_total_cny !== null;
      badge.textContent = within.length ? '預算內快照' : (hasCap ? '高於上限' : '尚未設上限');
      badge.className = 'badge ' + (within.length ? 'good' : (hasCap ? 'over' : 'neutral'));
    } else {
      $('estimate-price').textContent = '—';
      $('estimate-range').textContent = !preset.gpu.models.length || !preset.regions.length ? '先選取 GPU 與地區' : '此範圍的價格尚未檢視';
      $('compute-cost').textContent = '未檢視';
      $('storage-cost').textContent = '未檢視';
      $('period-cost').textContent = '未檢視';
      badge.textContent = !preset.gpu.models.length || !preset.regions.length ? '待設定' : '未檢視';
      badge.className = 'badge neutral';
    }
    const warnings = $('estimate-warnings');
    warnings.replaceChildren();
    result.warnings.slice(0, 5).forEach((warning) => warnings.append(element('p', '', typeof warning === 'string' ? warning : String(warning.message || '部分價格未確認'))));
    renderOfferList(result.offers, mode);
  }

  function updateVisibility() {
    const mode = $('billing-mode').value;
    const source = $('image-source').value;
    $('disk-extra-max').disabled = !$('allow-expansion').checked;
    $('billing-periods-field').hidden = mode === 'payg';
    $('price-cap-label').textContent = mode === 'payg' ? '整台含儲存費的最高費率' : '本次全部期數的最高總價';
    $('price-cap-unit').textContent = mode === 'payg' ? '/ 小時' : '/ 本次';
    $('billing-periods-note').textContent = '購買 ' + ($('billing-periods').value || '?') + ' ' + billingUnits[mode] + '；不自動續租';
    $('billing-note').textContent = mode === 'payg' ? '按量上限約束下單時的費率，並非整段租期的累計費用上限。技能停止後，實例與付費盤仍依 AutoDL 規則計費。' : '總價上限包含本次期數及必要費用，不啟用自動續租。付費盤等持續性費用以網站實際規則核對。';
    $('image-search-fields').hidden = false;
    $('framework-field').hidden = false;
    $('any-image-row').hidden = source === 'any';
  }

  function update() {
    updateVisibility();
    const preset = buildPreset();
    const errors = validatePreset(preset);
    renderSummary(preset, errors);
    renderValidation(errors);
    renderEstimate(preset);
  }

  function loadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('invalid preset store');
        savedPresets = parsed.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && item.preset && item.preset.schema_version === 1);
      }
    } catch (error) {
      savedPresets = [];
      storageUnavailable = true;
      announce('此瀏覽器目前無法讀取本機預設。你仍可設定條件並下載 JSON。', true);
    }
    renderSavedOptions();
  }

  function persistStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPresets));
      storageUnavailable = false;
      return true;
    } catch (error) {
      storageUnavailable = true;
      announce('本機儲存失敗，預設尚未保存。請下載 JSON 保留設定。', true);
      return false;
    }
  }

  function renderSavedOptions() {
    const select = $('saved-presets');
    select.replaceChildren();
    const first = document.createElement('option');
    first.value = '';
    first.textContent = '載入預設…';
    select.append(first);
    savedPresets.forEach((saved) => {
      const option = document.createElement('option');
      option.value = saved.id;
      let draft = true;
      try { draft = validatePreset(saved.preset).length > 0; } catch (error) { draft = true; }
      option.textContent = saved.name + (draft ? '（草稿）' : '');
      select.append(option);
    });
    select.value = currentPresetId;
    $('delete-preset').disabled = !currentPresetId;
  }

  function savePreset() {
    const preset = buildPreset();
    if (!preset.preset_name) {
      announce('請先為預設命名。', true);
      $('preset-name').focus();
      return;
    }
    const record = { id: currentPresetId || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2, 9)), name: preset.preset_name, updated_at: new Date().toISOString(), preset: preset };
    const previous = savedPresets.slice();
    const index = savedPresets.findIndex((saved) => saved.id === record.id);
    if (index >= 0) savedPresets[index] = record; else savedPresets.push(record);
    if (!persistStorage()) { savedPresets = previous; return; }
    currentPresetId = record.id;
    renderSavedOptions();
    announce(validatePreset(preset).length ? '已儲存草稿「' + preset.preset_name + '」。完成缺少的條件後即可執行。' : '已儲存「' + preset.preset_name + '」，可載入後直接產生執行設定。');
  }

  function assignValue(id, value) { $(id).value = value === null || value === undefined ? '' : String(value); }

  function populate(preset) {
    selectedModels.clear();
    selectedRegions.clear();
    preset.gpu.models.filter((name) => knownModelNames.has(name)).forEach((name) => selectedModels.add(name));
    preset.regions.filter((name) => knownRegionNames.has(name)).forEach((name) => selectedRegions.add(name));
    assignValue('custom-gpu', preset.gpu.models.filter((name) => !knownModelNames.has(name)).join(', '));
    assignValue('custom-regions', preset.regions.filter((name) => !knownRegionNames.has(name)).join(', '));
    assignValue('preset-name', preset.preset_name);
    assignValue('gpu-count', preset.gpu.count);
    assignValue('min-vram', preset.gpu.min_vram_gb);
    assignValue('min-cpu', preset.resources.min_cpu_cores);
    assignValue('min-ram', preset.resources.min_ram_gb);
    assignValue('disk-total', preset.disk.min_total_gb);
    $('allow-expansion').checked = preset.disk.allow_paid_expansion;
    assignValue('disk-extra-max', preset.disk.max_paid_extra_gb);
    assignValue('image-source', preset.image.source);
    assignValue('image-framework', preset.image.framework);
    assignValue('framework-versions', preset.image.framework_versions.join(', '));
    assignValue('python-versions', preset.image.python_versions.join(', '));
    assignValue('cuda-versions', preset.image.cuda_versions.join(', '));
    assignValue('image-id', preset.image.image_id);
    assignValue('image-query', preset.image.query);
    $('allow-any-image').checked = preset.image.allow_any_matching;
    assignValue('billing-mode', preset.billing.mode);
    assignValue('billing-periods', preset.billing.periods);
    assignValue('price-cap', preset.billing.mode === 'payg' ? preset.billing.max_total_rate_cny_per_hour : preset.billing.max_order_total_cny);
    assignValue('storage-cap', preset.billing.max_storage_cny_per_day);
    assignValue('refresh-seconds', preset.watch.interval_seconds);
    assignValue('timeout-minutes', preset.watch.timeout_minutes);
    assignValue('gpu-search', '');
    showValidation = false;
    renderGpuOptions();
    renderRegionOptions();
    updateImageOptions();
    update();
  }

  function schemaCheck(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON 必須是預設設定物件。');
    if (value.schema_version !== 1 || value.merchant !== 'AutoDL') throw new Error('只接受 AutoDL schema_version: 1 的預設。');
    if (value.instance_count !== 1 || !value.action || value.action.auto_order !== true || value.action.stop_after_first_success !== true) throw new Error('本技能的預設必須限定自動租用一台，並在首次成功後停止。');
    const objectFields = ['gpu', 'resources', 'disk', 'image', 'billing', 'watch'];
    objectFields.forEach((key) => { if (!value[key] || typeof value[key] !== 'object' || Array.isArray(value[key])) throw new Error('缺少有效的 ' + key + ' 設定。'); });
    const allowedKeys = {
      root: ['schema_version', 'merchant', 'preset_name', 'instance_count', 'gpu', 'regions', 'resources', 'disk', 'image', 'billing', 'watch', 'action', 'estimate'],
      gpu: ['models', 'count', 'min_vram_gb'], resources: ['min_cpu_cores', 'min_ram_gb'], disk: ['min_total_gb', 'allow_paid_expansion', 'max_paid_extra_gb'],
      image: ['source', 'framework', 'framework_versions', 'python_versions', 'cuda_versions', 'image_id', 'query', 'allow_any_matching'],
      billing: ['mode', 'periods', 'max_total_rate_cny_per_hour', 'max_order_total_cny', 'max_storage_cny_per_day', 'auto_renew'],
      watch: ['interval_seconds', 'timeout_minutes'], action: ['auto_order', 'stop_after_first_success'], estimate: ['source', 'inspected_at']
    };
    const assertKeys = (object, group) => {
      Object.keys(object).forEach((key) => { if (!allowedKeys[group].includes(key)) throw new Error('不支援的設定欄位 ' + (group === 'root' ? '' : group + '.') + key + '；為避免遺失條件，未匯入。'); });
    };
    assertKeys(value, 'root');
    [...objectFields, 'action'].forEach((group) => assertKeys(value[group], group));
    if (value.estimate !== undefined) {
      if (!value.estimate || typeof value.estimate !== 'object' || Array.isArray(value.estimate)) throw new Error('estimate 格式無效。');
      assertKeys(value.estimate, 'estimate');
    }
    const stringArray = (array, name) => {
      if (!Array.isArray(array) || array.length > 1000 || array.some((item) => typeof item !== 'string' || !item.trim() || item.length > 500)) throw new Error(name + ' 必須是字串陣列。');
      if (array.some((item) => /[,，、\n]/.test(item))) throw new Error(name + ' 的每個陣列元素只能包含一個選項；為避免擴大條件，未匯入。');
      if (array.some(isWildcard)) throw new Error(name + ' 不能包含萬用字元或「全部／不限」；請使用明確選項，版本不限則以空陣列表示。');
    };
    stringArray(value.gpu.models, 'gpu.models');
    stringArray(value.regions, 'regions');
    ['framework_versions', 'python_versions', 'cuda_versions'].forEach((key) => stringArray(value.image[key], 'image.' + key));
    const numberOrNull = (number, name) => { if (number !== null && (typeof number !== 'number' || !Number.isFinite(number))) throw new Error(name + ' 必須是數字或 null。'); };
    [['gpu', ['count', 'min_vram_gb']], ['resources', ['min_cpu_cores', 'min_ram_gb']], ['disk', ['min_total_gb', 'max_paid_extra_gb']], ['billing', ['periods', 'max_total_rate_cny_per_hour', 'max_order_total_cny', 'max_storage_cny_per_day']], ['watch', ['interval_seconds', 'timeout_minutes']]].forEach(([group, fields]) => fields.forEach((key) => numberOrNull(value[group][key], group + '.' + key)));
    if (typeof value.disk.allow_paid_expansion !== 'boolean' || typeof value.image.allow_any_matching !== 'boolean') throw new Error('擴容與鏡像任選許可必須是 boolean。');
    if (!['base', 'community', 'mine', 'any'].includes(value.image.source)) throw new Error('鏡像來源不受支援。');
    if (!['payg', 'day', 'week', 'month'].includes(value.billing.mode) || value.billing.auto_renew !== false) throw new Error('計費方式不受支援，或啟用了本技能不包含的自動續租。');
    if (value.billing.mode === 'payg' && value.billing.max_order_total_cny !== null) throw new Error('此按量預設另外包含總額限制；本介面無法呈現及保證該限制，因此未匯入。請保留原預設交由技能核對。');
    if (value.billing.mode !== 'payg' && value.billing.max_total_rate_cny_per_hour !== null) throw new Error('此包期預設另外包含每小時費率限制；本介面無法呈現該限制，因此未匯入。請保留原預設交由技能核對。');
    if (value.billing.mode === 'payg' && value.billing.periods !== 1) throw new Error('按量預設的 periods 必須為 1。');
    ['framework', 'image_id', 'query'].forEach((key) => { if (typeof value.image[key] !== 'string' || value.image[key].length > 2000) throw new Error('image.' + key + ' 必須是字串。'); });
    if (typeof value.preset_name !== 'string' || value.preset_name.length > 80) throw new Error('preset_name 必須是最多 80 字的名稱。');
    if (value.image.source === 'any' && value.image.allow_any_matching !== true) throw new Error('任一鏡像來源必須明確允許任選符合條件的鏡像。');
    return value;
  }

  function readyPreset() {
    const preset = buildPreset();
    const errors = validatePreset(preset);
    showValidation = true;
    renderValidation(errors);
    if (errors.length) {
      announce('還有 ' + errors.length + ' 項條件待設定，尚未產生可執行預設。', true);
      return null;
    }
    $('notification').hidden = true;
    return preset;
  }

  function invocation(preset) {
    return '$autodl-auto-rent\n\n請依照以下完整預設，在 AutoDL 持續刷新並自動租用一台符合全部條件的實例。條件已一次設定完成；網站實價在價格上限內即可直接下單，超出則跳過並繼續等待，不需有空閒後再次詢問規格。確認取得新實例或訂單後立即停止。\n\n```json\n' + JSON.stringify(preset, null, 2) + '\n```';
  }

  async function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try { await navigator.clipboard.writeText(text); return true; } catch (error) { /* manual fallback below */ }
    }
    return false;
  }

  function openCopyDialog(text) {
    $('invocation-output').value = text;
    $('dialog-copy-status').textContent = '';
    const dialog = $('copy-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    $('invocation-output').focus();
    $('invocation-output').select();
  }

  async function copyInvocation() {
    const preset = readyPreset();
    if (!preset) return;
    currentInvocation = invocation(preset);
    if (await copyText(currentInvocation)) announce('已複製完整執行設定。貼回聊天即可交給 $autodl-auto-rent 開始。');
    else openCopyDialog(currentInvocation);
  }

  function downloadPreset() {
    const preset = readyPreset();
    if (!preset) return;
    const blob = new Blob([JSON.stringify(preset, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = (preset.preset_name || 'autodl-preset').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80) + '.json';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('已產生預設 JSON。將檔案交給 $autodl-auto-rent 即可依設定執行。');
  }

  function initializeMetadata() {
    const raw = inspectedDate();
    if (raw) {
      const dateOnly = catalog.inspectedAtPrecision === 'date' || /^\d{4}-\d{2}-\d{2}$/.test(String(raw));
      if (dateOnly) {
        $('snapshot-date').textContent = String(raw).slice(0, 10).replace(/-/g, '/') + ' · 悉尼日期';
      } else {
        const date = new Date(raw);
        $('snapshot-date').textContent = Number.isNaN(date.getTime()) ? String(raw) : new Intl.DateTimeFormat('zh-TW', { timeZone: catalog.inspectedTimeZone || 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date) + ' · 悉尼';
      }
    } else $('snapshot-date').textContent = '尚未載入檢視時間';
    const offers = Array.isArray(catalog.offers) ? catalog.offers.length : 0;
    $('snapshot-coverage').textContent = regions.length + ' 個地區 · ' + models.length + ' 個型號 · ' + offers + ' 筆價格樣本';
    if (catalog.coverage && catalog.coverage.priceNote) $('estimate-disclaimer-text').textContent = catalog.coverage.priceNote;
    if (catalog.images && catalog.images.note) $('image-catalog-note').textContent = catalog.images.note + ' 社區與私人鏡像可用搜尋條件或精確 ID 指定。';
    const rate = catalog.storage && catalog.storage.paygCnyPerGBDay;
    if (typeof rate === 'number' && Number.isFinite(rate)) $('storage-rate-note').textContent = '本次檢視：額外付費盤 ¥' + rate + ' / GB / 日，關機仍計費。例如免費 50 GB 加付費 100 GB，總容量為 150 GB。';
    updateImageOptions();
  }

  $('gpu-search').addEventListener('input', renderGpuOptions);
  $('config-form').addEventListener('input', update);
  $('config-form').addEventListener('change', update);
  $('config-form').addEventListener('submit', (event) => event.preventDefault());
  $('image-framework').addEventListener('input', updateImageOptions);
  $('billing-mode').addEventListener('change', () => {
    $('price-cap').value = '';
    announce('計費方式已切換。請為這個計費方式設定價格上限，避免沿用不同單位的金額。');
  });
  $('preset-name').addEventListener('input', update);
  $('all-regions').addEventListener('click', () => { regions.forEach((region) => selectedRegions.add(region.id || region.label)); renderRegionOptions(); update(); });
  $('clear-regions').addEventListener('click', () => { selectedRegions.clear(); $('custom-regions').value = ''; renderRegionOptions(); update(); });
  $('save-preset').addEventListener('click', savePreset);
  $('saved-presets').addEventListener('change', () => {
    const record = savedPresets.find((item) => item.id === $('saved-presets').value);
    if (!record) return;
    try {
      schemaCheck(record.preset);
      currentPresetId = record.id;
      populate(record.preset);
      renderSavedOptions();
      announce('已載入「' + record.name + '」。');
    } catch (error) { announce('此預設格式無效：' + error.message, true); }
  });
  $('delete-preset').addEventListener('click', () => {
    if (!currentPresetId) return;
    const record = savedPresets.find((item) => item.id === currentPresetId);
    const previous = savedPresets.slice();
    savedPresets = savedPresets.filter((item) => item.id !== currentPresetId);
    if (!persistStorage()) { savedPresets = previous; return; }
    currentPresetId = '';
    renderSavedOptions();
    announce('已刪除本機預設「' + (record ? record.name : '') + '」。表單內的條件仍保留。');
  });
  $('reset-form').addEventListener('click', () => {
    $('config-form').reset();
    $('preset-name').value = '';
    selectedModels.clear();
    selectedRegions.clear();
    currentPresetId = '';
    showValidation = false;
    renderGpuOptions();
    renderRegionOptions();
    renderSavedOptions();
    updateImageOptions();
    update();
    announce('已重設表單。先前儲存的預設仍可載入。');
  });
  $('import-file').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { announce('檔案超過 1 MB，請選擇單一預設 JSON。', true); event.target.value = ''; return; }
    try {
      const value = schemaCheck(JSON.parse(await file.text()));
      currentPresetId = '';
      populate(value);
      renderSavedOptions();
      const errors = validatePreset(buildPreset());
      announce(errors.length ? '已匯入草稿；尚有 ' + errors.length + ' 項條件需補齊。' : '已匯入完整預設，可直接產生執行設定。');
    } catch (error) { announce('匯入失敗：' + (error instanceof SyntaxError ? '檔案不是有效的 JSON。' : error.message), true); }
    event.target.value = '';
  });
  $('copy-invocation').addEventListener('click', copyInvocation);
  $('download-preset').addEventListener('click', downloadPreset);
  $('close-dialog').addEventListener('click', () => { const dialog = $('copy-dialog'); if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); });
  $('dialog-copy').addEventListener('click', async () => {
    if (await copyText(currentInvocation)) $('dialog-copy-status').textContent = '已複製';
    else { $('invocation-output').focus(); $('invocation-output').select(); $('dialog-copy-status').textContent = '請按 ⌘C / Ctrl+C 複製已選取內容'; }
  });

  initializeMetadata();
  renderGpuOptions();
  renderRegionOptions();
  loadStorage();
  update();
})();
