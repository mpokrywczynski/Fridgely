import Pusher from 'pusher-js';
import { api } from './api.js';
import { getUser } from './auth.js';
import { openPremiumModal } from './premium.js';

let pusherChannel = null;
let pusherInstance = null;
let boughtItemsCache = [];
let shoppingIsPremium = false;

export async function renderShopping(container, isPremium = false) {
    container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted)">
        <div class="spinner" style="margin:0 auto 12px"></div>Ładowanie listy…</div>`;

    try {
        const items = await api.shopping.list();
        buildUI(container, items, isPremium);
        if (isPremium) initPusher(container);
    } catch {
        container.innerHTML = `<div class="alert alert--error" style="margin:24px">Nie udało się załadować listy zakupów.</div>`;
    }
}

function buildUI(container, items, isPremium = false) {
    shoppingIsPremium = isPremium;
    const realtimeBadge = isPremium
        ? `<div id="shopping-realtime-badge" style="display:none;text-align:center;margin-top:16px">
                <span style="font-size:12px;color:var(--text-muted);background:var(--bg);
                    padding:4px 10px;border-radius:99px;border:1px solid var(--border)">
                    🟢 Aktualizacje na żywo aktywne
                </span>
           </div>`
        : `<div style="margin-top:16px;padding:14px 16px;background:#FFFBEB;border:1px solid #FDE68A;
                border-radius:10px">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;
                    flex-wrap:wrap;gap:10px;margin-bottom:10px">
                    <div style="font-size:13px;font-weight:700;color:#92400E">
                        ⭐ Odblokuj funkcje Premium
                    </div>
                    <button class="btn btn--sm" id="btn-shopping-upgrade"
                        style="background:#F59E0B;color:#fff;border:none;white-space:nowrap;flex-shrink:0">
                        Przejdź na Premium
                    </button>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#92400E">
                        <span style="font-size:14px">⚡</span>
                        <span><strong>Aktualizacje na żywo</strong> — lista synchronizuje się w czasie rzeczywistym między urządzeniami.</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#92400E">
                        <span style="font-size:14px">🗂️</span>
                        <span><strong>Smart sortowanie (alejki)</strong> — produkty grupowane automatycznie wg kategorii (nabiał, mięso, warzywa…).</span>
                    </div>
                </div>
           </div>`;

    container.innerHTML = `
    <div id="shopping-wrap" style="max-width:640px;margin:0 auto;padding:24px 16px">
        <div class="card" style="margin-bottom:16px">
            <div class="card__body" style="padding:16px">
                <form id="shopping-add-form" style="display:flex;gap:8px">
                    <input type="text" id="shopping-new-name" class="form-input"
                        placeholder="Dodaj produkt… (np. Mleko, 2 szt.)" style="flex:1;padding:8px 12px">
                    <button type="submit" class="btn btn--primary">+ Dodaj</button>
                </form>
                <div id="shopping-add-err" style="display:none" class="form-error" style="margin-top:4px"></div>
            </div>
        </div>

        <div id="shopping-list-wrap"></div>

        ${realtimeBadge}
    </div>`;

    renderList(items);
    bindAddForm();

    document.getElementById('btn-shopping-upgrade')
        ?.addEventListener('click', () => openPremiumModal(false));
}

// ── Kategoryzacja ─────────────────────────────────────────

const SHOPPING_CATEGORIES = [
    { label: '🥛 Nabiał',           kw: ['mleko','jogurt','kefir','śmietana','smietan','masło','maslo','masel','twaróg','twarog','mozzarell','ricotta','ser ','serek','maślanka','maslanka'] },
    { label: '🥩 Mięso i ryby',     kw: ['mięso','mies','kurczak','wołowina','wolowi','wieprzowi','indyk','ryba','łosoś','losos','tuńczyk','tuncz','krewetki','kiełbas','kielb','szynk','boczek','parówk','parowk','wędlin','wedlin','drób','drob'] },
    { label: '🥬 Warzywa',          kw: ['pomidor','ogórek','ogurek','marchew','kapusta','brokul','szpinak','sałata','salat','papryka','cebula','czosnek','ziemniak','bakłażan','baklaz','cukinia','fasolka','groszek','kalafior','seler','warzywa'] },
    { label: '🍎 Owoce',            kw: ['jabłk','jablk','gruszk','banan','truskawk','malina','wiśni','wisni','porzeczk','mango','kiwi','pomarańcz','pomaranc','cytryn','winogron','borówk','borowk','owoce'] },
    { label: '🍞 Pieczywo',         kw: ['chleb','bułk','bulk','tost','bagietk','croissant','pieczywo','drożdżówk','drozdz','bagel','wrap'] },
    { label: '🥫 Suche i konserwy', kw: ['makaron','ryż','ryz','kasza','mąka','maka','cukier','sól ','sol ','pieprz','przyprawa','konserw','puszka','płatk','platk','musli','granola','owsian','miód','miod','dżem','dzem','powidł','ocet','ketchup','musztard','majonez','olej','oliwa','herbatnik','proszek do piecz','soda oczyszczon','drożdże','drozdze','ekstrakt wanili','budyń','budyn','żelatyn','zelatyn'] },
    { label: '☕ Napoje i używki',   kw: ['herbata','kawa','kakao','sok ','woda','piwo','wino','napój','napoj','cola','energetyk','smoothie','kompot','lemoniada'] },
    { label: '🍫 Słodycze',         kw: ['czekolad','ciastk','wafle','baton','cukierek','lody','tort ','ciasto','lizak','żelek','zelek','orzech','migdał','migdal','rodzynk'] },
    { label: '🍿 Przekąski',        kw: ['chipsy','paluszk','krakersy','popcorn','nachos','piszkotek','precel','precl','chrupk','przekąsk','snack','batonik zbożow'] },
    { label: '🧴 Chemia i higiena', kw: ['szampon','pasta do','mydło','mydlo','proszek','płyn do','plyn do','środek','srodek','papier toal','podpask','tampon','chusteczk','dezodor','perfum','krem ','balsam','zmywak','gąbka','gabka'] },
];

function categorizeItem(name) {
    const lower = name.toLowerCase();
    for (const cat of SHOPPING_CATEGORIES) {
        if (cat.kw.some(kw => lower.includes(kw))) return cat.label;
    }
    return '📦 Inne';
}

function groupByCategory(items) {
    const groups = {};
    for (const item of items) {
        const cat = categorizeItem(item.name);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
    }
    return groups;
}

function renderList(items) {
    const wrap = document.getElementById('shopping-list-wrap');
    if (!wrap) return;

    const unchecked = items.filter(i => !i.is_bought);
    const bought    = items.filter(i => i.is_bought);
    boughtItemsCache = bought;

    let html = '';

    if (unchecked.length === 0 && bought.length === 0) {
        html = `<div class="empty-state">
            <div class="empty-state__icon">🛒</div>
            <div class="empty-state__title">Lista jest pusta</div>
            <div class="empty-state__text">Dodaj produkty które potrzebujesz kupić.</div>
        </div>`;
    } else {
        if (unchecked.length > 0) {
            let itemsHtml = '';

            if (shoppingIsPremium) {
                const grouped  = groupByCategory(unchecked);
                const catKeys  = Object.keys(grouped);
                const showHdr  = catKeys.length > 1;
                for (const key of catKeys) {
                    if (showHdr) {
                        itemsHtml += `<li style="padding:8px 16px 4px;font-size:11px;font-weight:700;
                            color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;
                            background:var(--bg);border-top:1px solid var(--border);list-style:none">
                            ${key}
                        </li>`;
                    }
                    itemsHtml += grouped[key].map(renderItem).join('');
                }
            } else {
                itemsHtml = unchecked.map(renderItem).join('');
            }

            html += `<div class="card" style="margin-bottom:16px">
                <div class="card__header">
                    <span class="card__title">Do kupienia <span class="shopping-count">${unchecked.length}</span></span>
                </div>
                <div class="card__body" style="padding:0">
                    <ul class="shopping-list" id="list-unchecked">
                        ${itemsHtml}
                    </ul>
                </div>
            </div>`;
        }

        if (bought.length > 0) {
            html += `<div class="card">
                <div class="card__header">
                    <span class="card__title" style="color:var(--text-muted)">✅ Kupione <span>${bought.length}</span></span>
                    <div style="display:flex;gap:6px">
                        <button class="btn btn--outline btn--sm" id="btn-move-to-fridge">🧊 Do lodówki</button>
                        <button class="btn btn--ghost btn--sm" id="btn-clear-bought">🗑 Wyczyść</button>
                    </div>
                </div>
                <div class="card__body" style="padding:0">
                    <ul class="shopping-list" id="list-bought">
                        ${bought.map(renderItem).join('')}
                    </ul>
                </div>
            </div>`;
        }
    }

    wrap.innerHTML = html;
    bindListEvents();
}

function renderItem(item) {
    const qty = item.quantity
        ? `<span class="shopping-item__qty">${fmtQty(item.quantity)} ${escHtml(item.unit)}</span>`
        : '';
    const notes = item.notes
        ? `<span class="shopping-item__notes">${escHtml(item.notes)}</span>`
        : '';
    const who = item.added_by_name || item.added_by?.name || '';

    return `
    <li class="shopping-item${item.is_bought ? ' is-bought' : ''}" data-id="${item.id}">
        <label class="shopping-item__check-wrap">
            <input type="checkbox" class="shopping-check" data-id="${item.id}" ${item.is_bought ? 'checked' : ''}>
        </label>
        <div class="shopping-item__body">
            <span class="shopping-item__name">${escHtml(item.name)}</span>
            ${qty}${notes}
        </div>
        <span class="shopping-item__who">${escHtml(who)}</span>
        <button class="btn btn--ghost btn--sm shopping-item__del" data-id="${item.id}" title="Usuń">✕</button>
    </li>`;
}

function bindAddForm() {
    document.getElementById('shopping-add-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('shopping-new-name');
        const err   = document.getElementById('shopping-add-err');
        const raw   = input.value.trim();
        if (!raw) return;

        // Prosta heurystyka: "2 szt." lub "Mleko 2 l"
        const parsed = parseNameInput(raw);

        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;

        try {
            err.style.display = 'none';
            const item = await api.shopping.add(parsed);
            input.value = '';
            if (shoppingIsPremium) {
                await reloadList();
            } else {
                addItemToDOM(item);
            }
        } catch (ex) {
            err.textContent = ex.message || 'Błąd dodawania';
            err.style.display = 'block';
        } finally {
            btn.disabled = false;
            input.focus();
        }
    });
}

function bindListEvents() {
    document.querySelectorAll('.shopping-check').forEach(cb => {
        cb.addEventListener('change', async (e) => {
            const id       = parseInt(e.target.dataset.id);
            const isBought = e.target.checked;
            // Optymistyczny UI
            const li = document.querySelector(`.shopping-item[data-id="${id}"]`);
            if (li) li.classList.toggle('is-bought', isBought);
            try {
                const updated = await api.shopping.update(id, { is_bought: isBought });
                updateItemInDOM(updated);
            } catch {
                // rollback
                if (li) li.classList.toggle('is-bought', !isBought);
                e.target.checked = !isBought;
            }
        });
    });

    document.querySelectorAll('.shopping-item__del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const li = document.querySelector(`.shopping-item[data-id="${id}"]`);
            if (li) li.style.opacity = '0.4';
            try {
                await api.shopping.delete(id);
                removeItemFromDOM(id);
            } catch {
                if (li) li.style.opacity = '1';
            }
        });
    });

    document.getElementById('btn-move-to-fridge')?.addEventListener('click', () => {
        openMoveToFridgeModal(boughtItemsCache);
    });

    document.getElementById('btn-clear-bought')?.addEventListener('click', async () => {
        try {
            await api.shopping.clearBought();
            // Remove all bought items from DOM
            document.querySelectorAll('.shopping-item.is-bought').forEach(el => el.remove());
            refreshCounts();
            const boughtCard = document.getElementById('list-bought')?.closest('.card');
            if (boughtCard) boughtCard.remove();
        } catch (ex) {
            alert(ex.message || 'Błąd');
        }
    });
}

// ── DOM helpers ───────────────────────────────────────────

function addItemToDOM(item) {
    // Szybka ścieżka: dodaj na górze listy "Do kupienia"
    let ul = document.getElementById('list-unchecked');

    if (!ul) {
        // Nie ma jeszcze sekcji — przebuduj całą listę
        reloadList();
        return;
    }

    ul.insertAdjacentHTML('afterbegin', renderItem(item));
    // Bind event na nowo dodany element
    const cb = ul.querySelector(`.shopping-check[data-id="${item.id}"]`);
    if (cb) {
        cb.addEventListener('change', async (e) => {
            const isBought = e.target.checked;
            const li = document.querySelector(`.shopping-item[data-id="${item.id}"]`);
            if (li) li.classList.toggle('is-bought', isBought);
            try {
                const updated = await api.shopping.update(item.id, { is_bought: isBought });
                updateItemInDOM(updated);
            } catch {
                if (li) li.classList.toggle('is-bought', !isBought);
                e.target.checked = !isBought;
            }
        });
    }
    const delBtn = ul.querySelector(`.shopping-item__del[data-id="${item.id}"]`);
    if (delBtn) {
        delBtn.addEventListener('click', async () => {
            const li = document.querySelector(`.shopping-item[data-id="${item.id}"]`);
            if (li) li.style.opacity = '0.4';
            try {
                await api.shopping.delete(item.id);
                removeItemFromDOM(item.id);
            } catch {
                if (li) li.style.opacity = '1';
            }
        });
    }
    refreshCounts();
}

function updateItemInDOM(item) {
    const existing = document.querySelector(`.shopping-item[data-id="${item.id}"]`);
    if (!existing) {
        reloadList();
        return;
    }
    // Zamień element i przebuduj listę żeby przenieść do właściwej sekcji
    reloadList();
}

function removeItemFromDOM(id) {
    document.querySelector(`.shopping-item[data-id="${id}"]`)?.remove();
    refreshCounts();
    // Usuń pustą sekcję
    ['list-unchecked', 'list-bought'].forEach(listId => {
        const ul = document.getElementById(listId);
        if (ul && ul.children.length === 0) {
            ul.closest('.card')?.remove();
        }
    });
    // Pokaż empty state jeśli nic nie ma
    const wrap = document.getElementById('shopping-list-wrap');
    if (wrap && !document.querySelector('.shopping-item')) {
        wrap.innerHTML = `<div class="empty-state">
            <div class="empty-state__icon">🛒</div>
            <div class="empty-state__title">Lista jest pusta</div>
            <div class="empty-state__text">Dodaj produkty które potrzebujesz kupić.</div>
        </div>`;
    }
}

function refreshCounts() {
    const uncheckedCount = document.querySelectorAll('.shopping-item:not(.is-bought)').length;
    const countEl = document.querySelector('#list-unchecked')
        ?.closest('.card')
        ?.querySelector('.shopping-count');
    if (countEl) countEl.textContent = uncheckedCount;
}

async function reloadList() {
    try {
        const items = await api.shopping.list();
        renderList(items);
    } catch { /* ignore */ }
}

// ── Pusher real-time ──────────────────────────────────────

function initPusher(container) {
    const key     = window.PUSHER_KEY;
    const cluster = window.PUSHER_CLUSTER || 'mt1';
    const user    = getUser();

    if (!key || !user?.family_id) return;

    try {
        pusherInstance = new Pusher(key, {
            cluster,
            authEndpoint: (window.APP_URL || '') + '/broadcasting/auth',
            auth: {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('fridge_token')}`,
                    Accept: 'application/json',
                },
            },
        });

        pusherChannel = pusherInstance.subscribe(`private-family.${user.family_id}`);

        pusherChannel.bind('pusher:subscription_succeeded', () => {
            const badge = document.getElementById('shopping-realtime-badge');
            if (badge) badge.style.display = 'block';
        });

        pusherChannel.bind('shopping.updated', ({ action, item }) => {
            handleRealtimeUpdate(action, item);
        });
    } catch (e) {
        console.warn('Pusher init failed:', e);
    }
}

export function destroyShopping() {
    if (pusherChannel && pusherInstance) {
        pusherChannel.unbind_all();
        pusherInstance.unsubscribe(pusherChannel.name);
    }
    pusherChannel  = null;
    pusherInstance = null;
}

function handleRealtimeUpdate(action, item) {
    switch (action) {
        case 'added':
            reloadList();
            break;
        case 'updated':
            reloadList();
            break;
        case 'deleted':
            removeItemFromDOM(item.id);
            break;
        case 'cleared':
            document.querySelectorAll('.shopping-item.is-bought').forEach(el => el.remove());
            document.getElementById('list-bought')?.closest('.card')?.remove();
            refreshCounts();
            break;
    }
}

// ── Utilities ─────────────────────────────────────────────

function parseNameInput(raw) {
    // Wykryj wzorzec: "Mleko 2 l" lub "2 szt. Chleb" lub po prostu "Chleb"
    const unitPattern = /\b(\d+(?:[.,]\d+)?)\s*(szt\.?|kg|g|l|ml|op\.?|pacz\.?|but\.?)\b/i;
    const match = raw.match(unitPattern);
    if (match) {
        const quantity = parseFloat(match[1].replace(',', '.'));
        const unit     = match[2].replace(/\.?$/, '.');
        const name     = raw.replace(match[0], '').trim().replace(/\s+/g, ' ') || raw;
        return { name, quantity, unit: unit.toLowerCase() };
    }
    return { name: raw };
}

function fmtQty(n) {
    return n % 1 === 0 ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '');
}

function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

// ── Przenieś zakupione do lodówki ─────────────────────────

async function openMoveToFridgeModal(items) {
    document.getElementById('mf-backdrop')?.remove();

    if (items.length === 0) return;

    let zones;
    try {
        zones = await api.zones.list();
    } catch {
        alert('Nie udało się załadować stref przechowywania.');
        return;
    }

    if (zones.length === 0) {
        alert('Brak stref przechowywania. Dodaj strefę najpierw w ustawieniach lodówki.');
        return;
    }

    const zonesHtml = zones.map(z =>
        `<option value="${z.id}">${z.icon ? z.icon + ' ' : ''}${escHtml(z.name)}</option>`
    ).join('');

    const itemsHtml = items.map(item => {
        const qty = item.quantity
            ? `<span style="color:var(--text-muted);font-size:13px;white-space:nowrap">${fmtQty(item.quantity)} ${escHtml(item.unit)}</span>`
            : '';
        return `<li style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
            <input type="checkbox" class="mf-item-check" data-id="${item.id}" checked
                style="width:16px;height:16px;flex-shrink:0;cursor:pointer">
            <span style="flex:1;font-size:14px">${escHtml(item.name)}</span>
            ${qty}
        </li>`;
    }).join('');

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-backdrop is-open" id="mf-backdrop">
            <div class="modal" style="max-width:440px">
                <div class="modal__header">
                    <h3>🧊 Dodaj do lodówki</h3>
                    <button class="btn btn--ghost btn--sm" id="mf-close">✕</button>
                </div>
                <div class="modal__body" style="padding:20px">
                    <div style="margin-bottom:16px">
                        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Gdzie umieścić?</label>
                        <select id="mf-zone" class="form-input">${zonesHtml}</select>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                        <span style="font-size:13px;font-weight:600">Produkty:</span>
                        <div style="display:flex;gap:6px">
                            <button type="button" class="btn btn--ghost btn--sm" id="mf-all">Zaznacz wszystkie</button>
                            <button type="button" class="btn btn--ghost btn--sm" id="mf-none">Odznacz</button>
                        </div>
                    </div>
                    <ul style="list-style:none;margin:0;padding:0;max-height:280px;overflow-y:auto">
                        ${itemsHtml}
                    </ul>
                    <div id="mf-error" class="alert alert--error"
                        style="display:none;margin-top:12px"></div>
                </div>
                <div class="modal__footer">
                    <button class="btn btn--outline" id="mf-cancel">Anuluj</button>
                    <button class="btn btn--primary" id="mf-confirm">🧊 Dodaj</button>
                </div>
            </div>
        </div>`);

    bindMoveToFridgeModal();
}

function bindMoveToFridgeModal() {
    const close = () => document.getElementById('mf-backdrop')?.remove();

    document.getElementById('mf-close')?.addEventListener('click', close);
    document.getElementById('mf-cancel')?.addEventListener('click', close);
    document.getElementById('mf-backdrop')?.addEventListener('click', e => {
        if (e.target.id === 'mf-backdrop') close();
    });

    document.getElementById('mf-all')?.addEventListener('click', () => {
        document.querySelectorAll('.mf-item-check').forEach(cb => cb.checked = true);
    });
    document.getElementById('mf-none')?.addEventListener('click', () => {
        document.querySelectorAll('.mf-item-check').forEach(cb => cb.checked = false);
    });

    document.getElementById('mf-confirm')?.addEventListener('click', async () => {
        const zoneId  = parseInt(document.getElementById('mf-zone')?.value);
        const itemIds = [...document.querySelectorAll('.mf-item-check:checked')]
            .map(cb => parseInt(cb.dataset.id));

        const errEl = document.getElementById('mf-error');
        if (itemIds.length === 0) {
            errEl.textContent = 'Wybierz przynajmniej jeden produkt.';
            errEl.style.display = 'block';
            return;
        }

        const btn = document.getElementById('mf-confirm');
        btn.disabled  = true;
        btn.textContent = '…';

        try {
            const res = await api.shopping.moveToFridge({ storage_zone_id: zoneId, item_ids: itemIds });
            close();
            showToast(`Dodano ${res.added} ${plPl(res.added, 'produkt', 'produkty', 'produktów')} do „${res.zone}"`);
        } catch (ex) {
            errEl.textContent = ex.message || 'Błąd dodawania do lodówki.';
            errEl.style.display = 'block';
            btn.disabled    = false;
            btn.textContent = '🧊 Dodaj';
        }
    });
}

function showToast(msg) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
        'background:#10b981;color:#fff;padding:10px 22px;border-radius:8px;' +
        'font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

function plPl(n, one, few, many) {
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return few;
    return many;
}
