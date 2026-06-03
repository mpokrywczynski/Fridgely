import { api } from './api.js';

let zones = [];

export function initReceiptScanner(zonesData) {
    zones = zonesData;
}

export function openReceiptScanner() {
    const backdrop = document.getElementById('receipt-backdrop');
    if (backdrop) {
        backdrop.classList.add('is-open');
        return;
    }
    document.body.insertAdjacentHTML('beforeend', buildScannerHTML());
    bindScannerEvents();
}

function buildScannerHTML() {
    return `
    <div class="modal-backdrop is-open" id="receipt-backdrop">
        <div class="modal" style="max-width:600px">
            <div class="modal__header">
                <h3>📷 Skanuj paragon</h3>
                <button class="btn btn--ghost btn--sm" id="receipt-close">✕</button>
            </div>
            <div class="modal__body" id="receipt-body">
                <div id="receipt-upload-area" class="receipt-upload">
                    <input type="file" id="receipt-file" accept="image/*" capture="environment" style="display:none">
                    <button class="btn btn--outline btn--full" id="receipt-camera-btn" style="margin-bottom:8px">
                        📷 Zrób zdjęcie paragonu
                    </button>
                    <button class="btn btn--ghost btn--full" id="receipt-gallery-btn">
                        🖼️ Wybierz z galerii
                    </button>
                    <p style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:8px">
                        Obsługiwane formaty: JPG, PNG, HEIC — max 10 MB
                    </p>
                </div>
                <div id="receipt-scanning" style="display:none;text-align:center;padding:32px">
                    <div class="spinner" style="margin:0 auto 16px;width:32px;height:32px;border-width:3px"></div>
                    <p style="color:var(--text-muted)">Trwa skanowanie paragonu…</p>
                </div>
                <div id="receipt-results" style="display:none"></div>
            </div>
            <div class="modal__footer" id="receipt-footer" style="display:none">
                <button class="btn btn--outline" id="receipt-rescan">↩ Skanuj inny</button>
                <button class="btn btn--primary" id="receipt-confirm">✅ Dodaj</button>
            </div>
        </div>
    </div>`;
}

function bindScannerEvents() {
    document.getElementById('receipt-close').addEventListener('click', closeScanner);
    document.getElementById('receipt-backdrop').addEventListener('click', (e) => {
        if (e.target.id === 'receipt-backdrop') closeScanner();
    });

    const fileInput = document.getElementById('receipt-file');

    document.getElementById('receipt-camera-btn').addEventListener('click', () => {
        fileInput.setAttribute('capture', 'environment');
        fileInput.click();
    });

    document.getElementById('receipt-gallery-btn').addEventListener('click', () => {
        fileInput.removeAttribute('capture');
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) startScan(e.target.files[0]);
    });
}

async function startScan(file) {
    document.getElementById('receipt-upload-area').style.display = 'none';
    document.getElementById('receipt-scanning').style.display    = 'block';
    document.getElementById('receipt-results').style.display     = 'none';
    document.getElementById('receipt-footer').style.display      = 'none';

    try {
        const formData = new FormData();
        formData.append('image', file);

        const result = await api.receipts.scan(formData);
        showResults(result.products, result.raw_text || '');
    } catch (err) {
        showError(err.message || 'Wystąpił błąd podczas skanowania');
    }
}

function showResults(products, rawText) {
    document.getElementById('receipt-scanning').style.display = 'none';
    document.getElementById('receipt-footer').style.display   = 'flex';

    const zoneOptions = zones.map(z =>
        `<option value="${z.id}">${z.icon} ${z.name}</option>`
    ).join('');

    if (products.length === 0) {
        document.getElementById('receipt-results').style.display = 'block';
        document.getElementById('receipt-results').innerHTML = `
            <div class="empty-state">
                <div class="empty-state__icon">🤷</div>
                <div class="empty-state__title">Brak produktów</div>
                <div class="empty-state__text">Nie udało się rozpoznać produktów na paragonie.<br>Spróbuj z lepszym oświetleniem lub wyraźniejszym zdjęciem.</div>
            </div>`;
        document.getElementById('receipt-footer').style.display = 'none';
        document.getElementById('receipt-rescan-only').style.display = 'block';
        return;
    }

    const rows = products.map((p, i) => {
        const categoryLabel = p.category
            ? `<span style="font-size:11px;color:var(--text-muted);background:var(--bg);padding:1px 6px;border-radius:99px">${escHtml(p.category)}</span>`
            : '';
        return `
        <tr class="receipt-row" data-index="${i}">
            <td style="padding:6px 4px">
                <input type="checkbox" class="receipt-check" data-index="${i}" ${p.selected ? 'checked' : ''}>
            </td>
            <td style="padding:6px 4px">
                <input type="text" class="form-input receipt-name" data-index="${i}"
                    value="${escHtml(p.name)}" style="padding:4px 8px;font-size:13px">
                <div style="margin-top:2px">${categoryLabel}</div>
            </td>
            <td style="padding:6px 4px;white-space:nowrap">
                <input type="number" class="form-input receipt-qty" data-index="${i}"
                    value="${p.quantity}" min="0.01" step="0.01"
                    style="padding:4px 8px;font-size:13px;width:64px">
                <span style="font-size:12px;color:var(--text-muted)">${escHtml(p.unit)}</span>
            </td>
            <td style="padding:6px 4px">
                <select class="form-input receipt-zone-sel" data-index="${i}"
                    style="padding:4px 8px;font-size:13px">
                    ${zones.map(z =>
                        `<option value="${z.id}" ${z.id == p.storage_zone_id ? 'selected' : ''}>${z.icon} ${z.name}</option>`
                    ).join('')}
                </select>
            </td>
            <td style="padding:6px 4px">
                <input type="date" class="form-input receipt-expiry" data-index="${i}"
                    value="${p.expiry_date || ''}"
                    style="padding:4px 6px;font-size:12px;width:128px">
            </td>
        </tr>`;
    }).join('');

    const fewProducts = products.length < 3;
    const qualityWarning = fewProducts
        ? `<div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:#92400E">
               ⚠️ Znaleziono tylko ${products.length} produkt(y). Spróbuj zrobić zdjęcie z lepszym oświetleniem, bez odblasków, na ciemnym tle.
           </div>`
        : '';

    const rawBlock = rawText
        ? `<details style="margin-top:10px">
               <summary style="font-size:12px;color:var(--text-muted);cursor:pointer;user-select:none">🔍 Surowy tekst OCR (diagnostyka)</summary>
               <pre style="margin-top:6px;padding:8px;background:#F9FAFB;border:1px solid var(--border);border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap;max-height:200px;overflow-y:auto">${escHtml(rawText)}</pre>
           </details>`
        : '';

    const container = document.getElementById('receipt-results');
    container.style.display = 'block';
    container.innerHTML = `
        ${qualityWarning}
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:8px">
            Znaleziono <strong>${products.length}</strong> produktów — odznacz te których nie chcesz dodawać:
        </p>
        <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
                <tr style="border-bottom:1px solid var(--border)">
                    <th style="padding:4px;width:28px"></th>
                    <th style="padding:4px;text-align:left">Produkt</th>
                    <th style="padding:4px;text-align:left">Ilość</th>
                    <th style="padding:4px;text-align:left">Strefa</th>
                    <th style="padding:4px;text-align:left">Termin</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        </div>
        ${rawBlock}`;

    // Zbierz dane i wyślij po potwierdzeniu
    document.getElementById('receipt-confirm').onclick = () => confirmProducts(products);
    document.getElementById('receipt-rescan').onclick  = resetToUpload;
}

async function confirmProducts(originalProducts) {
    const checks   = document.querySelectorAll('.receipt-check');
    const names    = document.querySelectorAll('.receipt-name');
    const qtys     = document.querySelectorAll('.receipt-qty');
    const zonesSel = document.querySelectorAll('.receipt-zone-sel');
    const expiries = document.querySelectorAll('.receipt-expiry');

    const selected = [];
    checks.forEach((cb, i) => {
        if (!cb.checked) return;
        selected.push({
            name:            names[i].value.trim(),
            name_raw:        originalProducts[i].name_raw || originalProducts[i].name,
            quantity:        parseFloat(qtys[i].value) || 1,
            unit:            originalProducts[i].unit,
            price:           originalProducts[i].price,
            storage_zone_id: parseInt(zonesSel[i].value),
            expiry_date:     expiries[i]?.value || null,
            category:        originalProducts[i].category || null,
        });
    });

    if (selected.length === 0) {
        alert('Zaznacz przynajmniej jeden produkt.');
        return;
    }

    const btn = document.getElementById('receipt-confirm');
    btn.disabled    = true;
    btn.textContent = 'Dodawanie…';

    try {
        const res = await api.receipts.confirm(selected);
        closeScanner();
        // Odśwież widok lodówki
        document.dispatchEvent(new CustomEvent('fridge:refresh'));
        showToast(`✅ ${res.message}`);
    } catch (err) {
        btn.disabled    = false;
        btn.textContent = '✅ Dodaj zaznaczone do lodówki';
        showError(err.message);
    }
}

function showError(msg) {
    document.getElementById('receipt-scanning').style.display = 'none';
    document.getElementById('receipt-results').style.display  = 'block';
    document.getElementById('receipt-results').innerHTML = `
        <div class="alert alert--error">${escHtml(msg)}</div>`;
    document.getElementById('receipt-footer').innerHTML = `
        <button class="btn btn--outline btn--full" id="receipt-rescan-err">↩ Spróbuj ponownie</button>`;
    document.getElementById('receipt-footer').style.display = 'flex';
    document.getElementById('receipt-rescan-err').onclick = resetToUpload;
}

function resetToUpload() {
    document.getElementById('receipt-upload-area').style.display = 'block';
    document.getElementById('receipt-scanning').style.display    = 'none';
    document.getElementById('receipt-results').style.display     = 'none';
    document.getElementById('receipt-footer').style.display      = 'none';
    document.getElementById('receipt-file').value = '';
}

function closeScanner() {
    document.getElementById('receipt-backdrop')?.remove();
}

function showToast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    el.style.cssText = `
        position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
        background:#2D6A4F;color:#fff;padding:10px 20px;border-radius:24px;
        font-size:14px;font-weight:600;z-index:9999;
        box-shadow:0 4px 12px rgba(0,0,0,.2);white-space:nowrap`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}
