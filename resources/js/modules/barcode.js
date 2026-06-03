import { BrowserMultiFormatReader } from '@zxing/browser';
import { api } from './api.js';

const OFF_API = 'https://world.openfoodfacts.org/api/v2/product';
const OFF_FIELDS = 'product_name,product_name_pl,brands,quantity,categories_tags,image_url,nutriments';

let reader = null;
let scanning = false;
let zones = [];
let scanMode = 'add'; // 'add' | 'waste'

export function initBarcodeScanner(zonesData) {
    zones = zonesData;
}

export function openBarcodeScanner(defaultZoneId = null) {
    if (document.getElementById('barcode-backdrop')) return;
    scanMode = 'add';
    document.body.insertAdjacentHTML('beforeend', buildHTML(defaultZoneId));
    startScanner();
}

export function openWasteScanner() {
    if (document.getElementById('barcode-backdrop')) return;
    scanMode = 'waste';
    document.body.insertAdjacentHTML('beforeend', buildWasteHTML());
    startScanner();
}

function buildHTML(defaultZoneId) {
    const zoneOptions = zones.map(z =>
        `<option value="${z.id}" ${z.id == defaultZoneId ? 'selected' : ''}>${z.icon} ${z.name}</option>`
    ).join('');

    return `
    <div class="modal-backdrop is-open" id="barcode-backdrop">
        <div class="modal" style="max-width:440px">
            <div class="modal__header">
                <h3>🔍 Skanuj kod kreskowy</h3>
                <button class="btn btn--ghost btn--sm" id="barcode-close">✕</button>
            </div>
            <div class="modal__body" style="padding:0">

                <!-- Podgląd kamery -->
                <div id="barcode-camera-wrap" style="position:relative;background:#000;overflow:hidden;border-radius:0">
                    <video id="barcode-video" style="width:100%;display:block;max-height:260px;object-fit:cover"></video>
                    <!-- Ramka celownicza -->
                    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
                        <div id="barcode-frame" class="barcode-frame"></div>
                    </div>
                    <div id="barcode-hint" style="position:absolute;bottom:10px;left:0;right:0;text-align:center;color:#fff;font-size:12px;text-shadow:0 1px 3px rgba(0,0,0,.8)">
                        Skieruj kamerę na kod kreskowy
                    </div>
                </div>

                <!-- Stan: ładowanie -->
                <div id="barcode-loading" style="display:none;text-align:center;padding:24px">
                    <div class="spinner" style="margin:0 auto 12px;width:28px;height:28px;border-width:3px"></div>
                    <p style="color:var(--text-muted);font-size:13px">Pobieranie danych produktu…</p>
                </div>

                <!-- Wynik -->
                <div id="barcode-result" style="display:none;padding:16px">
                    <div id="barcode-product-card"></div>
                    <div style="margin-top:12px">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                            <div class="form-group" style="margin:0">
                                <label class="form-label">Ilość</label>
                                <input type="number" id="bc-quantity" class="form-input" value="1" min="0.01" step="0.01">
                            </div>
                            <div class="form-group" style="margin:0">
                                <label class="form-label">Jednostka</label>
                                <select id="bc-unit" class="form-input">
                                    <option value="szt">szt.</option>
                                    <option value="kg">kg</option>
                                    <option value="g">g</option>
                                    <option value="l">l</option>
                                    <option value="ml">ml</option>
                                    <option value="opak">opak.</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom:10px">
                            <label class="form-label">Strefa</label>
                            <select id="bc-zone" class="form-input">${zoneOptions}</select>
                        </div>
                        <div class="form-group" style="margin:0">
                            <label class="form-label">Data ważności</label>
                            <input type="date" id="bc-expiry" class="form-input">
                        </div>
                    </div>
                </div>

                <!-- Błąd (kod nieznany) -->
                <div id="barcode-unknown" style="display:none;padding:16px">
                    <div class="alert alert--warning" style="margin-bottom:12px">
                        Produktu nie znaleziono w bazie — wpisz ręcznie.
                    </div>
                    <div class="form-group">
                        <label class="form-label">Nazwa produktu</label>
                        <input type="text" id="bc-manual-name" class="form-input" placeholder="np. Mleko UHT 3,2%">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                        <div class="form-group" style="margin:0">
                            <label class="form-label">Ilość</label>
                            <input type="number" id="bc-manual-quantity" class="form-input" value="1" min="0.01" step="0.01">
                        </div>
                        <div class="form-group" style="margin:0">
                            <label class="form-label">Jednostka</label>
                            <select id="bc-manual-unit" class="form-input">
                                <option value="szt">szt.</option>
                                <option value="kg">kg</option>
                                <option value="g">g</option>
                                <option value="l">l</option>
                                <option value="ml">ml</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:10px">
                        <label class="form-label">Strefa</label>
                        <select id="bc-manual-zone" class="form-input">${zoneOptions}</select>
                    </div>
                </div>

            </div>
            <div class="modal__footer" id="barcode-footer" style="display:none">
                <button class="btn btn--ghost" id="barcode-rescan">🔁 Skanuj inne</button>
                <button class="btn btn--primary" id="barcode-add">✅ Dodaj do lodówki</button>
            </div>
        </div>
    </div>`;
}

async function startScanner() {
    document.getElementById('barcode-close').addEventListener('click', closeScanner);
    document.getElementById('barcode-backdrop').addEventListener('click', (e) => {
        if (e.target.id === 'barcode-backdrop') closeScanner();
    });

    const video = document.getElementById('barcode-video');

    try {
        reader = new BrowserMultiFormatReader();
        scanning = true;

        await reader.decodeFromVideoDevice(undefined, video, (result, err) => {
            if (!scanning) return;
            if (result) {
                scanning = false;
                onBarcodeDetected(result.getText());
            }
            // NotFoundException jest normalny między klatkami — ignorujemy
        });
    } catch (e) {
        showCameraError(e.message);
    }
}

async function onBarcodeDetected(barcode) {
    if (navigator.vibrate) navigator.vibrate(100);
    animateFrameSuccess();

    document.getElementById('barcode-camera-wrap').style.display = 'none';
    document.getElementById('barcode-loading').style.display     = 'block';

    if (scanMode === 'waste') {
        try {
            const product = await api.products.findByBarcode(barcode);
            showWasteResult(product);
        } catch {
            await handleWasteByName(barcode);
        }
        return;
    }

    try {
        const data = await fetchProductByBarcode(barcode);
        showProductResult(barcode, data);
    } catch {
        showUnknownProduct(barcode);
    }
}

async function fetchProductByBarcode(barcode) {
    const res = await fetch(`${OFF_API}/${barcode}?fields=${OFF_FIELDS}`, {
        headers: { 'Accept': 'application/json' },
    });
    const json = await res.json();
    if (json.status !== 1 || !json.product) throw new Error('not found');
    return json.product;
}

function showProductResult(barcode, product) {
    document.getElementById('barcode-loading').style.display = 'none';
    document.getElementById('barcode-result').style.display  = 'block';
    document.getElementById('barcode-footer').style.display  = 'flex';

    const name  = product.product_name_pl || product.product_name || 'Produkt ' + barcode;
    const brand = product.brands || '';
    const qty   = product.quantity || '';
    const img   = product.image_url || '';

    document.getElementById('barcode-product-card').innerHTML = `
        <div style="display:flex;gap:12px;align-items:flex-start;background:var(--bg);padding:12px;border-radius:8px;margin-bottom:4px">
            ${img ? `<img src="${escHtml(img)}" style="width:56px;height:56px;object-fit:contain;border-radius:6px;background:#fff;flex-shrink:0" loading="lazy">` : '<div style="width:56px;height:56px;background:#e5e7eb;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px">🛒</div>'}
            <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:14px;margin-bottom:2px">${escHtml(name)}</div>
                ${brand ? `<div style="font-size:12px;color:var(--text-muted)">${escHtml(brand)}</div>` : ''}
                ${qty ? `<div style="font-size:12px;color:var(--text-muted)">${escHtml(qty)}</div>` : ''}
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">🌍 Open Food Facts</div>
            </div>
        </div>`;

    // Auto-dobierz jednostkę na podstawie quantity z OFF
    if (qty) {
        const qtyLower = qty.toLowerCase();
        if (qtyLower.includes('kg'))      document.getElementById('bc-unit').value = 'kg';
        else if (qtyLower.includes(' g')) document.getElementById('bc-unit').value = 'g';
        else if (qtyLower.includes(' l')) document.getElementById('bc-unit').value = 'l';
        else if (qtyLower.includes('ml')) document.getElementById('bc-unit').value = 'ml';
    }

    // Termin ważności z ExpiryRule jeśli znamy kategorię
    const categoryTag = (product.categories_tags || []).find(t => t.startsWith('pl:') || t.startsWith('en:'));
    const categoryHint = categoryTag ? categoryTag.replace(/^(pl:|en:)/, '') : name;

    // Zapisz dane do użycia przy dodawaniu
    document.getElementById('barcode-add')._productData = { name, brand, barcode, categoryHint };

    document.getElementById('barcode-rescan').addEventListener('click', resetToCamera);
    document.getElementById('barcode-add').addEventListener('click', () => addProduct(false));
}

function showUnknownProduct(barcode) {
    document.getElementById('barcode-loading').style.display  = 'none';
    document.getElementById('barcode-unknown').style.display  = 'block';
    document.getElementById('barcode-footer').style.display   = 'flex';

    document.getElementById('barcode-add')._productData = { name: '', brand: '', barcode, categoryHint: '' };
    document.getElementById('barcode-add')._isManual = true;

    document.getElementById('barcode-rescan').addEventListener('click', resetToCamera);
    document.getElementById('barcode-add').addEventListener('click', () => addProduct(true));
}

async function addProduct(isManual) {
    const btn = document.getElementById('barcode-add');
    const data = btn._productData || {};

    let name, quantity, unit, zoneId;

    if (isManual) {
        name     = document.getElementById('bc-manual-name').value.trim();
        quantity = parseFloat(document.getElementById('bc-manual-quantity').value) || 1;
        unit     = document.getElementById('bc-manual-unit').value;
        zoneId   = parseInt(document.getElementById('bc-manual-zone').value);
        if (!name) { document.getElementById('bc-manual-name').focus(); return; }
    } else {
        name     = data.name;
        quantity = parseFloat(document.getElementById('bc-quantity').value) || 1;
        unit     = document.getElementById('bc-unit').value;
        zoneId   = parseInt(document.getElementById('bc-zone').value);
        const expiryVal = document.getElementById('bc-expiry').value;

        btn.disabled    = true;
        btn.textContent = 'Dodawanie…';

        try {
            await api.products.create({
                name,
                quantity,
                unit,
                storage_zone_id: zoneId,
                barcode:         data.barcode,
                expiry_date:     expiryVal || null,
                purchase_date:   new Date().toISOString().split('T')[0],
            });
            closeScanner();
            document.dispatchEvent(new CustomEvent('fridge:refresh'));
            showToast(`✅ Dodano: ${name}`);
            return;
        } catch (err) {
            btn.disabled    = false;
            btn.textContent = '✅ Dodaj do lodówki';
            showToast('❌ ' + (err.message || 'Błąd'), true);
            return;
        }
    }

    btn.disabled    = true;
    btn.textContent = 'Dodawanie…';

    try {
        await api.products.create({
            name,
            quantity,
            unit,
            storage_zone_id: zoneId,
            barcode:         data.barcode,
            purchase_date:   new Date().toISOString().split('T')[0],
        });
        closeScanner();
        document.dispatchEvent(new CustomEvent('fridge:refresh'));
        showToast(`✅ Dodano: ${name}`);
    } catch (err) {
        btn.disabled    = false;
        btn.textContent = '✅ Dodaj do lodówki';
        showToast('❌ ' + (err.message || 'Błąd'), true);
    }
}

function resetToCamera() {
    document.getElementById('barcode-camera-wrap').style.display = 'block';
    document.getElementById('barcode-loading').style.display     = 'none';
    document.getElementById('barcode-footer').style.display      = 'none';
    document.getElementById('barcode-frame').classList.remove('barcode-frame--success');

    if (scanMode === 'waste') {
        document.getElementById('barcode-waste-result')?.style.setProperty('display', 'none');
        document.getElementById('barcode-waste-notfound')?.style.setProperty('display', 'none');
        document.getElementById('barcode-hint').textContent = 'Skieruj kamerę na kod zużytego produktu';
    } else {
        document.getElementById('barcode-result').style.display  = 'none';
        document.getElementById('barcode-unknown').style.display = 'none';
        document.getElementById('barcode-hint').textContent = 'Skieruj kamerę na kod kreskowy';
    }

    scanning = true;
}

function buildWasteHTML() {
    return `
    <div class="modal-backdrop is-open" id="barcode-backdrop">
        <div class="modal" style="max-width:440px">
            <div class="modal__header">
                <h3>🗑 Skanuj i usuń z lodówki</h3>
                <button class="btn btn--ghost btn--sm" id="barcode-close">✕</button>
            </div>
            <div class="modal__body" style="padding:0">

                <div id="barcode-camera-wrap" style="position:relative;background:#000;overflow:hidden;border-radius:0">
                    <video id="barcode-video" style="width:100%;display:block;max-height:260px;object-fit:cover"></video>
                    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
                        <div id="barcode-frame" class="barcode-frame"></div>
                    </div>
                    <div id="barcode-hint" style="position:absolute;bottom:10px;left:0;right:0;text-align:center;color:#fff;font-size:12px;text-shadow:0 1px 3px rgba(0,0,0,.8)">
                        Skieruj kamerę na kod zużytego produktu
                    </div>
                </div>

                <div id="barcode-loading" style="display:none;text-align:center;padding:24px">
                    <div class="spinner" style="margin:0 auto 12px;width:28px;height:28px;border-width:3px"></div>
                    <p style="color:var(--text-muted);font-size:13px">Szukam w lodówce…</p>
                </div>

                <div id="barcode-waste-result" style="display:none;padding:16px">
                    <div id="barcode-waste-card"></div>
                </div>

                <div id="barcode-waste-notfound" style="display:none;padding:16px">
                    <div class="alert alert--warning">
                        Produktu z tym kodem nie ma aktualnie w lodówce.
                    </div>
                </div>

            </div>
            <div class="modal__footer" id="barcode-footer" style="display:none">
                <button class="btn btn--ghost" id="barcode-rescan">🔁 Skanuj inne</button>
                <button class="btn btn--outline btn--sm" id="btn-waste-product" style="color:var(--danger);border-color:var(--danger)">🗑 Wyrzucony</button>
                <button class="btn btn--primary" id="btn-consume-product">✅ Zużyty</button>
            </div>
        </div>
    </div>`;
}

async function handleWasteByName(barcode) {
    const loadingP = document.querySelector('#barcode-loading p');
    if (loadingP) loadingP.textContent = 'Szukam produktu po nazwie…';

    let offName = null;
    try {
        const offData = await fetchProductByBarcode(barcode);
        offName = offData.product_name_pl || offData.product_name || null;
    } catch {}

    try {
        const allProducts = await api.products.list();

        if (offName) {
            const words = offName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            const matches = allProducts.filter(p =>
                words.some(w => p.name.toLowerCase().includes(w))
            );

            if (matches.length === 1) { showWasteResult(matches[0]); return; }
            if (matches.length > 1)  { showWasteResultList(matches, offName); return; }
        }
    } catch {}

    showWasteNotFound(barcode, offName);
}

function showWasteResultList(products, offName) {
    document.getElementById('barcode-loading').style.display      = 'none';
    document.getElementById('barcode-waste-result').style.display = 'block';
    document.getElementById('barcode-footer').style.display       = 'flex';
    document.getElementById('btn-consume-product').style.display  = 'none';
    document.getElementById('btn-waste-product').style.display    = 'none';

    const cards = products.map(p => {
        const zone = p.storage_zone?.name || '';
        const qty  = p.quantity ? `${p.quantity} ${escHtml(p.unit || '')}` : '';
        return `
        <div style="background:var(--bg);padding:12px;border-radius:8px;margin-bottom:8px;border:1px solid var(--border)">
            <div style="font-weight:600;font-size:14px">${escHtml(p.name)}</div>
            <div style="display:flex;gap:10px;font-size:12px;color:var(--text-muted);margin-top:2px">
                ${zone ? `<span>📍 ${escHtml(zone)}</span>` : ''}
                ${qty  ? `<span>📦 ${qty}</span>` : ''}
            </div>
            <div style="display:flex;gap:8px;margin-top:10px">
                <button class="btn btn--sm" data-waste-id="${p.id}" data-waste-action="waste"
                    style="color:var(--danger);border:1px solid var(--danger);background:transparent">
                    🗑 Wyrzucony
                </button>
                <button class="btn btn--sm btn--primary" data-waste-id="${p.id}" data-waste-action="consume">
                    ✅ Zużyty
                </button>
            </div>
        </div>`;
    }).join('');

    const el = document.getElementById('barcode-waste-card');
    el.innerHTML = `
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">
            Zidentyfikowano jako <strong>${escHtml(offName)}</strong>. Wybierz produkt:
        </p>
        ${cards}`;

    el.querySelectorAll('[data-waste-id]').forEach(btn => {
        btn.addEventListener('click', () =>
            doWasteAction(parseInt(btn.dataset.wasteId), btn.dataset.wasteAction)
        );
    });

    document.getElementById('barcode-rescan').onclick = () => resetToCamera();
}

function showWasteNotFound(barcode = null, offName = null) {
    document.getElementById('barcode-loading').style.display          = 'none';
    document.getElementById('barcode-waste-notfound').style.display   = 'block';
    document.getElementById('barcode-footer').style.display           = 'flex';
    document.getElementById('btn-consume-product').style.display      = 'none';
    document.getElementById('btn-waste-product').style.display        = 'none';

    let msg = 'Produktu z tym kodem nie ma aktualnie w lodówce.';
    if (offName) msg += `<br><span style="font-size:12px">Produkt: <strong>${escHtml(offName)}</strong></span>`;
    if (barcode) msg += `<br><span style="font-size:11px;color:var(--text-muted)">Kod: ${escHtml(barcode)}</span>`;

    document.getElementById('barcode-waste-notfound').innerHTML =
        `<div class="alert alert--warning" style="line-height:1.8">${msg}</div>`;

    document.getElementById('barcode-rescan').onclick = () => resetToCamera();
}

function showWasteResult(product) {
    document.getElementById('barcode-loading').style.display        = 'none';
    document.getElementById('barcode-waste-result').style.display   = 'block';
    document.getElementById('barcode-footer').style.display         = 'flex';

    const zone = product.storage_zone?.name || '';
    const qty  = product.quantity ? `${product.quantity} ${escHtml(product.unit || '')}` : '';

    document.getElementById('barcode-waste-card').innerHTML = `
        <div style="background:var(--bg);padding:14px;border-radius:8px">
            <div style="font-weight:600;font-size:15px;margin-bottom:6px">${escHtml(product.name)}</div>
            <div style="display:flex;gap:12px;font-size:12px;color:var(--text-muted)">
                ${zone ? `<span>📍 ${escHtml(zone)}</span>` : ''}
                ${qty  ? `<span>📦 ${qty}</span>` : ''}
            </div>
        </div>`;

    document.getElementById('btn-consume-product').onclick = () => doWasteAction(product.id, 'consume');
    document.getElementById('btn-waste-product').onclick   = () => doWasteAction(product.id, 'waste');
    document.getElementById('barcode-rescan').onclick      = () => resetToCamera();
}

async function doWasteAction(productId, action) {
    const btnId = action === 'consume' ? 'btn-consume-product' : 'btn-waste-product';
    const btn   = document.getElementById(btnId);
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    try {
        if (action === 'consume') {
            await api.products.consume(productId);
            closeScanner();
            document.dispatchEvent(new CustomEvent('fridge:refresh'));
            showToast('✅ Oznaczono jako zużyty');
        } else {
            await api.products.waste(productId);
            closeScanner();
            document.dispatchEvent(new CustomEvent('fridge:refresh'));
            showToast('🗑 Produkt wyrzucony');
        }
    } catch (err) {
        if (btn) {
            btn.disabled    = false;
            btn.textContent = action === 'consume' ? '✅ Zużyty' : '🗑 Wyrzucony';
        }
        showToast('❌ ' + (err.message || 'Błąd'), true);
    }
}

function animateFrameSuccess() {
    const frame = document.getElementById('barcode-frame');
    if (frame) {
        frame.classList.add('barcode-frame--success');
        document.getElementById('barcode-hint').textContent = '✅ Wykryto kod!';
    }
}

function showCameraError(msg) {
    document.getElementById('barcode-camera-wrap').innerHTML = `
        <div style="padding:32px;text-align:center;color:#fff">
            <div style="font-size:32px;margin-bottom:8px">📷</div>
            <p style="font-size:13px">Brak dostępu do kamery</p>
            <p style="font-size:11px;opacity:.7;margin-top:4px">${escHtml(msg)}</p>
        </div>`;
}

function closeScanner() {
    scanning = false;
    try { reader?.reset(); } catch {}
    reader = null;
    document.getElementById('barcode-backdrop')?.remove();
}

function showToast(msg, isError = false) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
        position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
        background:${isError ? '#E63946' : '#2D6A4F'};color:#fff;
        padding:10px 20px;border-radius:24px;font-size:14px;font-weight:600;
        z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2);white-space:nowrap`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
