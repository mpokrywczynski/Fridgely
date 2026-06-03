import { api } from './api.js';
import { getUser } from './auth.js';
import { initReceiptScanner, openReceiptScanner } from './receipt.js';
import { initBarcodeScanner, openBarcodeScanner, openWasteScanner } from './barcode.js';

let zones = [];
let products = [];
let activeFilter = null;
let fridgeContainer = null;

export async function renderFridge(container) {
    fridgeContainer = container;
    container.innerHTML = '<div style="padding:24px;text-align:center"><div class="spinner" style="margin:auto"></div></div>';

    try {
        [zones, products] = await Promise.all([
            api.zones.list(),
            api.products.list(),
        ]);
    } catch {
        container.innerHTML = '<div class="alert alert--error">Błąd ładowania danych.</div>';
        return;
    }

    initReceiptScanner(zones);
    initBarcodeScanner(zones);

    document.removeEventListener('fridge:refresh', onFridgeRefresh);
    document.addEventListener('fridge:refresh', onFridgeRefresh);

    render(container);
}

async function onFridgeRefresh() {
    if (!fridgeContainer) return;
    try {
        [zones, products] = await Promise.all([
            api.zones.list(),
            api.products.list(),
        ]);
        initReceiptScanner(zones);
        initBarcodeScanner(zones);
        render(fridgeContainer);
    } catch {}
}

function render(container) {
    const urgentCount = products.filter(p => p.days_until_expiry !== null && p.days_until_expiry <= 1).length;
    const soonCount   = products.filter(p => p.days_until_expiry !== null && p.days_until_expiry > 1 && p.days_until_expiry <= 3).length;

    const filteredProducts = activeFilter === 'urgent'
        ? products.filter(p => p.days_until_expiry !== null && p.days_until_expiry <= 1)
        : activeFilter === 'soon'
        ? products.filter(p => p.days_until_expiry !== null && p.days_until_expiry > 1 && p.days_until_expiry <= 3)
        : products;

    container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
            <div>
                <h2 style="font-size:22px;font-weight:700">Twoja lodówka</h2>
                <p style="color:#6B7280;font-size:13px">${products.length} produktów w ${zones.length} strefach</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn--outline" id="btn-scan-barcode">🔍 Skanuj i dodaj</button>
                <button class="btn btn--outline" id="btn-waste-scan" style="color:var(--danger);border-color:var(--danger)">🗑 Skanuj i usuń</button>
                <button class="btn btn--outline" id="btn-scan-receipt">📷 Paragon</button>
                <button class="btn btn--primary" id="btn-add-product">+ Dodaj</button>
            </div>
        </div>

        ${urgentCount || soonCount ? `
        <div class="expiry-bar">
            ${urgentCount ? `<div class="expiry-bar__item expiry-bar__item--urgent ${activeFilter === 'urgent' ? 'is-active' : ''}" data-filter="urgent">
                ⚠️ ${urgentCount} psuje się dziś/jutro
            </div>` : ''}
            ${soonCount ? `<div class="expiry-bar__item expiry-bar__item--soon ${activeFilter === 'soon' ? 'is-active' : ''}" data-filter="soon">
                🕐 ${soonCount} psuje się w 3 dni
            </div>` : ''}
            ${activeFilter ? `<div class="expiry-bar__item" data-filter="clear" style="background:#f3f4f6;color:#6B7280">✕ Wyczyść filtr</div>` : ''}
        </div>` : ''}

        <div class="zone-grid" id="zone-grid">
            ${zones.map(zone => renderZone(zone, filteredProducts)).join('')}
        </div>

        ${renderAddProductModal()}
    `;

    bindFridgeEvents(container);
}

function renderZone(zone, allProducts) {
    const zoneProducts = allProducts.filter(p => p.storage_zone_id === zone.id);

    return `
    <div class="zone-card" data-zone-id="${zone.id}">
        <div class="zone-card__header">
            <span class="zone-card__icon">${zone.icon}</span>
            <span class="zone-card__name">${zone.name}</span>
            <span class="zone-card__count">${zoneProducts.length}</span>
        </div>
        <div class="zone-card__body">
            ${zoneProducts.length === 0
                ? `<div style="padding:16px 24px;color:#9CA3AF;font-size:13px;text-align:center">Brak produktów</div>`
                : zoneProducts.map(p => renderProductItem(p)).join('')}
            <div style="padding:8px 16px">
                <button class="btn btn--ghost btn--sm btn--full btn-add-to-zone" data-zone="${zone.id}" style="justify-content:flex-start">
                    + Dodaj do ${zone.name}
                </button>
            </div>
        </div>
    </div>`;
}

function renderProductItem(product) {
    const expiry = getExpiryLabel(product);
    const openedBadge = product.opened_at
        ? `<span class="badge badge--opened">otwarte</span>`
        : '';

    return `
    <div class="product-item" data-product-id="${product.id}" draggable="true">
        <div style="flex:1;min-width:0;overflow:hidden">
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;font-size:13px">${product.name}</div>
            <div style="font-size:12px;color:#9CA3AF;display:flex;align-items:center;gap:5px;margin-top:1px">
                <span>${product.quantity} ${product.unit}</span>
                ${openedBadge}
            </div>
        </div>
        <span class="product-item__expiry product-item__expiry--${expiry.cls}" style="flex-shrink:0;margin:0 4px">${expiry.label}</span>
        <div class="product-item__actions">
            <button class="btn btn--ghost btn--sm btn-edit-product" data-id="${product.id}" title="Edytuj">✏️</button>
            ${!product.opened_at ? `<button class="btn btn--ghost btn--sm btn-open" data-id="${product.id}" title="Oznacz jako otwarte">📂</button>` : ''}
            <button class="btn btn--ghost btn--sm btn-consume" data-id="${product.id}" title="Zużyto">✓</button>
            <button class="btn btn--ghost btn--sm btn-waste" data-id="${product.id}" title="Wyrzuć" style="color:var(--danger)">🗑</button>
        </div>
    </div>`;
}

function getExpiryLabel(product) {
    const days = product.days_until_expiry;
    if (days === null || days === undefined) return { label: 'brak daty', cls: 'none' };
    if (days < 0)   return { label: 'przeterminowane', cls: 'expired' };
    if (days === 0) return { label: 'dziś!', cls: 'urgent' };
    if (days === 1) return { label: 'jutro', cls: 'urgent' };
    if (days <= 3)  return { label: `za ${days} dni`, cls: 'soon' };
    return { label: `za ${days} dni`, cls: 'fresh' };
}

function renderAddProductModal() {
    const zoneOptions = zones.map(z => `<option value="${z.id}">${z.icon} ${z.name}</option>`).join('');

    return `
    <div class="modal-backdrop" id="modal-add-product">
        <div class="modal">
            <div class="modal__header">
                <h3>Dodaj produkt</h3>
                <button class="btn btn--ghost btn--sm" id="modal-close">✕</button>
            </div>
            <div class="modal__body">
                <div id="modal-alert"></div>
                <form id="form-add-product">
                    <div class="form-group">
                        <label class="form-label">Nazwa produktu *</label>
                        <input type="text" name="name" class="form-input" placeholder="np. Mleko UHT 3.2%" required id="product-name-input" />
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div class="form-group">
                            <label class="form-label">Ilość</label>
                            <input type="number" name="quantity" class="form-input" value="1" min="0.01" step="0.01" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Jednostka</label>
                            <select name="unit" class="form-input">
                                <option value="szt">szt.</option>
                                <option value="kg">kg</option>
                                <option value="g">g</option>
                                <option value="l">l</option>
                                <option value="ml">ml</option>
                                <option value="opak">opak.</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Strefa przechowywania *</label>
                        <select name="storage_zone_id" class="form-input" id="modal-zone-select">
                            ${zoneOptions}
                        </select>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div class="form-group">
                            <label class="form-label">Data zakupu</label>
                            <input type="date" name="purchase_date" class="form-input" value="${new Date().toISOString().split('T')[0]}" />
                        </div>
                        <div class="form-group">
                            <label class="form-label">Data ważności</label>
                            <input type="date" name="expiry_date" class="form-input" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Cena (zł)</label>
                        <input type="number" name="price" class="form-input" placeholder="0.00" min="0" step="0.01" />
                    </div>
                </form>
            </div>
            <div class="modal__footer">
                <button class="btn btn--outline" id="modal-cancel">Anuluj</button>
                <button class="btn btn--primary" id="modal-submit">Dodaj produkt</button>
            </div>
        </div>
    </div>

    <div class="modal-backdrop" id="modal-edit-product">
        <div class="modal">
            <div class="modal__header">
                <h3>✏️ Edytuj produkt</h3>
                <button class="btn btn--ghost btn--sm" id="edit-modal-close">✕</button>
            </div>
            <div class="modal__body">
                <div id="edit-modal-alert"></div>
                <input type="hidden" id="edit-product-id">
                <div id="edit-opened-section" style="display:none;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;padding:10px 12px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px">
                    <span style="font-size:13px;color:#92400E">📂 Otwarto: <strong id="edit-opened-date"></strong></span>
                    <button type="button" id="edit-unopen-btn" class="btn btn--outline btn--sm" style="white-space:nowrap;color:#92400E;border-color:#FED7AA">✕ Cofnij otwarcie</button>
                </div>
                <div class="form-group">
                    <label class="form-label">Nazwa produktu *</label>
                    <input type="text" id="edit-name" class="form-input" required>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div class="form-group">
                        <label class="form-label">Ilość</label>
                        <input type="number" id="edit-qty" class="form-input" min="0.01" step="0.01">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Jednostka</label>
                        <select id="edit-unit" class="form-input">
                            <option value="szt">szt.</option>
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="l">l</option>
                            <option value="ml">ml</option>
                            <option value="opak">opak.</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Strefa przechowywania</label>
                    <select id="edit-zone" class="form-input">
                        ${zoneOptions}
                    </select>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div class="form-group">
                        <label class="form-label">Data ważności</label>
                        <input type="date" id="edit-expiry" class="form-input">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Cena (zł)</label>
                        <input type="number" id="edit-price" class="form-input" min="0" step="0.01" placeholder="0.00">
                    </div>
                </div>
            </div>
            <div class="modal__footer">
                <button class="btn btn--outline" id="edit-modal-cancel">Anuluj</button>
                <button class="btn btn--primary" id="edit-modal-submit">Zapisz zmiany</button>
            </div>
        </div>
    </div>`;
}

function bindFridgeEvents(container) {
    container.querySelector('#btn-scan-barcode')?.addEventListener('click', () => openBarcodeScanner());
    container.querySelector('#btn-waste-scan')?.addEventListener('click', () => openWasteScanner());
    container.querySelector('#btn-scan-receipt')?.addEventListener('click', () => openReceiptScanner());
    container.querySelector('#btn-add-product')?.addEventListener('click', () => openModal());

    container.querySelectorAll('.btn-add-to-zone').forEach(btn => {
        btn.addEventListener('click', () => openModal(btn.dataset.zone));
    });

    container.querySelectorAll('[data-filter]').forEach(el => {
        el.addEventListener('click', () => {
            const f = el.dataset.filter;
            activeFilter = f === 'clear' ? null : (activeFilter === f ? null : f);
            render(container);
        });
    });

    // ── Drag & Drop ─────────────────────────────────────
    let dragProductId = null;

    container.querySelectorAll('.product-item[draggable]').forEach(el => {
        el.addEventListener('dragstart', (e) => {
            dragProductId = parseInt(el.dataset.productId);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dragProductId);
            // Krótkie opóźnienie żeby przeglądarka zdążyła zrobić ghost
            requestAnimationFrame(() => el.classList.add('is-dragging'));
        });

        el.addEventListener('dragend', () => {
            el.classList.remove('is-dragging');
            container.querySelectorAll('.zone-card').forEach(z => z.classList.remove('drop-over'));
        });
    });

    container.querySelectorAll('.zone-card').forEach(zoneEl => {
        const zoneId = parseInt(zoneEl.dataset.zoneId);

        zoneEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zoneEl.classList.add('drop-over');
        });

        zoneEl.addEventListener('dragleave', (e) => {
            // Ignoruj jeśli kursor wchodzi w dziecko zone-card
            if (zoneEl.contains(e.relatedTarget)) return;
            zoneEl.classList.remove('drop-over');
        });

        zoneEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            zoneEl.classList.remove('drop-over');
            const pid = parseInt(e.dataTransfer.getData('text/plain'));
            if (!pid || !zoneId) return;

            const product = products.find(p => p.id === pid);
            if (!product || product.storage_zone_id === zoneId) return;

            // Optymistyczna aktualizacja UI — produkt pojawia się od razu
            product.storage_zone_id = zoneId;
            render(container);

            try {
                await api.products.update(pid, { storage_zone_id: zoneId });
            } catch {
                // Cofnij przy błędzie
                [zones, products] = await Promise.all([api.zones.list(), api.products.list()]);
                render(container);
            }
        });
    });
    // ────────────────────────────────────────────────────

    // ── Edycja produktu ─────────────────────────────────
    let editProductId = null;
    const editBackdrop   = container.querySelector('#modal-edit-product');
    const closeEditModal = () => editBackdrop?.classList.remove('is-open');

    container.querySelector('#edit-modal-close')?.addEventListener('click', closeEditModal);
    container.querySelector('#edit-modal-cancel')?.addEventListener('click', closeEditModal);
    editBackdrop?.addEventListener('click', (e) => { if (e.target === editBackdrop) closeEditModal(); });

    container.querySelector('#edit-unopen-btn')?.addEventListener('click', async () => {
        const btn = container.querySelector('#edit-unopen-btn');
        btn.disabled = true;
        btn.textContent = '…';
        try {
            await api.products.update(editProductId, { opened_at: null, opened_expiry_date: null });
            const idx = products.findIndex(x => x.id === editProductId);
            if (idx !== -1) {
                products[idx].opened_at          = null;
                products[idx].opened_expiry_date = null;
            }
            container.querySelector('#edit-opened-section').style.display = 'none';
            render(container);
            closeEditModal();
        } catch {
            btn.disabled = false;
            btn.textContent = '✕ Cofnij otwarcie';
        }
    });

    container.querySelectorAll('.btn-edit-product').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editProductId = parseInt(btn.dataset.id);
            const p = products.find(x => x.id === editProductId);
            if (!p) return;

            container.querySelector('#edit-product-id').value = p.id;
            container.querySelector('#edit-name').value        = p.name;
            container.querySelector('#edit-qty').value         = p.quantity ?? 1;
            container.querySelector('#edit-unit').value        = p.unit ?? 'szt';
            container.querySelector('#edit-zone').value        = p.storage_zone_id;
            container.querySelector('#edit-expiry').value      = p.expiry_date ? p.expiry_date.slice(0, 10) : '';
            container.querySelector('#edit-price').value       = p.price ?? '';
            container.querySelector('#edit-modal-alert').innerHTML = '';
            container.querySelector('#edit-modal-submit').disabled    = false;
            container.querySelector('#edit-modal-submit').textContent = 'Zapisz zmiany';

            const openedSection = container.querySelector('#edit-opened-section');
            if (p.opened_at) {
                const d = new Date(p.opened_at);
                container.querySelector('#edit-opened-date').textContent =
                    d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
                openedSection.style.display = 'flex';
            } else {
                openedSection.style.display = 'none';
            }

            editBackdrop.classList.add('is-open');
        });
    });

    container.querySelector('#edit-modal-submit')?.addEventListener('click', async () => {
        const btn     = container.querySelector('#edit-modal-submit');
        const alertEl = container.querySelector('#edit-modal-alert');
        alertEl.innerHTML = '';
        btn.disabled    = true;
        btn.textContent = 'Zapisywanie…';

        const body = {
            name:            container.querySelector('#edit-name').value.trim(),
            quantity:        parseFloat(container.querySelector('#edit-qty').value) || 1,
            unit:            container.querySelector('#edit-unit').value,
            storage_zone_id: parseInt(container.querySelector('#edit-zone').value),
            expiry_date:     container.querySelector('#edit-expiry').value || null,
            price:           container.querySelector('#edit-price').value
                                 ? parseFloat(container.querySelector('#edit-price').value)
                                 : null,
        };

        try {
            const updated = await api.products.update(editProductId, body);
            const idx = products.findIndex(x => x.id === editProductId);
            if (idx !== -1) {
                products[idx] = {
                    ...products[idx],
                    ...updated,
                    days_until_expiry: updated.expiry_date
                        ? Math.floor((new Date(updated.expiry_date) - new Date()) / 86400000)
                        : null,
                };
            }
            closeEditModal();
            render(container);
        } catch (err) {
            const msg = err.errors
                ? Object.values(err.errors).flat().join(' ')
                : (err.message || 'Błąd zapisu');
            alertEl.innerHTML = `<div class="alert alert--error" style="margin-bottom:8px">${msg}</div>`;
            btn.disabled    = false;
            btn.textContent = 'Zapisz zmiany';
        }
    });
    // ────────────────────────────────────────────────────

    container.querySelectorAll('.btn-open').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            try {
                await api.products.open(id);
                const p = products.find(x => x.id === id);
                if (p) { p.opened_at = new Date().toISOString(); }
                render(container);
            } catch {}
        });
    });

    container.querySelectorAll('.btn-consume').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            try {
                await api.products.consume(id);
                products = products.filter(x => x.id !== id);
                render(container);
            } catch {}
        });
    });

    container.querySelectorAll('.btn-waste').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            const product = products.find(x => x.id === id);
            if (!confirm(`Wyrzucić "${product?.name}"? To zwiększy statystyki marnowania.`)) return;
            try {
                await api.products.waste(id);
                products = products.filter(x => x.id !== id);
                render(container);
            } catch {}
        });
    });

    const backdrop = container.querySelector('#modal-add-product');
    const closeModal = () => backdrop?.classList.remove('is-open');

    container.querySelector('#modal-close')?.addEventListener('click', closeModal);
    container.querySelector('#modal-cancel')?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

    container.querySelector('#modal-submit')?.addEventListener('click', async () => {
        const form = container.querySelector('#form-add-product');
        const btn  = container.querySelector('#modal-submit');
        const alertEl = container.querySelector('#modal-alert');
        alertEl.innerHTML = '';
        btn.disabled = true;
        btn.textContent = 'Dodawanie...';

        const body = {
            name:            form.name.value,
            quantity:        parseFloat(form.quantity.value),
            unit:            form.unit.value,
            storage_zone_id: parseInt(form.storage_zone_id.value),
            purchase_date:   form.purchase_date.value || null,
            expiry_date:     form.expiry_date.value   || null,
            price:           form.price.value ? parseFloat(form.price.value) : null,
        };

        try {
            const created = await api.products.create(body);
            created.days_until_expiry = created.expiry_date
                ? Math.floor((new Date(created.expiry_date) - new Date()) / 86400000)
                : null;
            products.push(created);
            closeModal();
            render(container);
        } catch (err) {
            const msg = err.errors
                ? Object.values(err.errors).flat().join(' ')
                : err.message;
            alertEl.innerHTML = `<div class="alert alert--error" style="margin-bottom:12px">${msg}</div>`;
            btn.disabled = false;
            btn.textContent = 'Dodaj produkt';
        }
    });
}

function openModal(zoneId = null) {
    const backdrop = document.querySelector('#modal-add-product');
    if (!backdrop) return;
    backdrop.classList.add('is-open');
    document.querySelector('#modal-alert').innerHTML = '';
    document.querySelector('#modal-submit').disabled = false;
    document.querySelector('#modal-submit').textContent = 'Dodaj produkt';
    if (zoneId) {
        document.querySelector('#modal-zone-select').value = zoneId;
    }
    document.querySelector('#product-name-input')?.focus();
}
