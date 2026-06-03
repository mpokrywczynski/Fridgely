import { api } from './api.js';
import { getUser } from './auth.js';

let map = null;
let markers = [];
let myLocation = null;
let fsContainer = null;
let pollTimer = null;
let pollShareId = null;
let lastMessageId = 0;

function startPolling(container, shareId) {
    stopPolling();
    pollShareId = shareId;
    pollTimer = setInterval(() => pollMessages(container, shareId), 4000);

    // gdy zakładka wraca na wierzch — natychmiast sprawdź nowe wiadomości
    const onVisible = () => {
        if (!document.hidden && pollShareId) pollMessages(container, shareId);
    };
    document.addEventListener('visibilitychange', onVisible);
    // zapisz referencję żeby móc usunąć listener przy stopPolling
    startPolling._visibilityHandler = onVisible;
}

function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (startPolling._visibilityHandler) {
        document.removeEventListener('visibilitychange', startPolling._visibilityHandler);
        startPolling._visibilityHandler = null;
    }
    pollShareId = null;
    lastMessageId = 0;
}


async function pollMessages(container, shareId, force = false) {
    const panel = container.querySelector('#fs-panel');
    if (!panel || panel.style.display === 'none') { stopPolling(); return; }

    // blokuj tylko gdy okno jest aktywne I użytkownik aktualnie pisze
    if (!force && document.hasFocus()) {
        const focused = document.activeElement;
        if (panel.contains(focused) && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) return;
    }

    let share;
    try { share = await api.foodSharing.get(shareId); } catch { return; }

    const messages = share.messages || [];
    const newestId = messages.length ? messages[messages.length - 1].id : 0;
    if (newestId <= lastMessageId) return;

    lastMessageId = newestId;

    const user = getUser();
    const isOwn = Number(share.user_id) === Number(user?.id);
    const chatEl = panel.querySelector('#fs-chat');
    if (!chatEl) return;

    if (isOwn) {
        // owner: przebuduj wątki, zachowaj wartości inputów
        const savedInputs = {};
        panel.querySelectorAll('.fs-thread-input').forEach(inp => {
            savedInputs[inp.dataset.tid] = inp.value;
        });

        chatEl.innerHTML = buildOwnerThreadsHtml(messages, share.user_id, user?.id, false);
        bindThreadSendButtons(panel, container, shareId);

        panel.querySelectorAll('.fs-thread-input').forEach(inp => {
            if (savedInputs[inp.dataset.tid]) inp.value = savedInputs[inp.dataset.tid];
        });

        // scrolluj każdy wątek na dół (rAF — czekamy na render)
        requestAnimationFrame(() => {
            panel.querySelectorAll('.fs-thread-msgs').forEach(el => {
                el.scrollTop = el.scrollHeight;
            });
        });
    } else {
        // gość: patch #fs-chat, nie dotykaj inputa
        const wasAtBottom = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 40;
        chatEl.innerHTML = messages.map(m => {
            const mine = Number(m.user_id) === Number(user?.id);
            return `<div style="display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'};margin-bottom:10px">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">${mine ? 'Ty' : escHtml(m.user?.name)}</div>
                <div style="max-width:88%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.4;
                    background:${mine ? '#3b82f6' : '#f1f5f9'};color:${mine ? '#fff' : 'var(--text)'}">
                    ${escHtml(m.body)}
                </div>
            </div>`;
        }).join('');
        // force (po wysłaniu) zawsze scrolluj; autopoll tylko gdy był na dole
        if (force || wasAtBottom) {
            requestAnimationFrame(() => { chatEl.scrollTop = chatEl.scrollHeight; });
        }
    }
}

export async function renderFoodSharing(container) {
    stopPolling();
    fsContainer = container;

    container.innerHTML = `
    <div id="fs-page" style="display:flex;flex-direction:column;height:calc(100vh - 60px);overflow:hidden">
        <div style="padding:16px 20px 12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;flex-shrink:0">
            <div>
                <h2 style="font-size:20px;font-weight:700">🤝 Oddam Jedzenie</h2>
                <p style="color:var(--text-muted);font-size:13px">Produkty do oddania w promieniu 5 km</p>
            </div>
            <button class="btn btn--outline btn--sm" id="fs-my-btn">📋 Moje ogłoszenia</button>
        </div>

        <div id="fs-alert" style="padding:0 20px 8px;flex-shrink:0"></div>

        <div style="flex:1;position:relative;overflow:hidden;display:flex">
            <div id="fs-map" style="flex:1"></div>

            <div id="fs-panel" style="
                display:none;position:absolute;right:0;top:0;bottom:0;
                width:min(320px,100%);background:var(--surface);
                border-left:1px solid var(--border);overflow-y:auto;
                z-index:1000;box-shadow:-2px 0 12px rgba(0,0,0,.1)">
            </div>
        </div>

        <div id="fs-my-panel" style="display:none;max-height:45vh;overflow-y:auto;
            border-top:1px solid var(--border);background:var(--surface);flex-shrink:0">
        </div>
    </div>`;

    await initMap(container);
    bindFsPageEvents(container);
}

async function initMap(container) {
    const alertEl = container.querySelector('#fs-alert');
    alertEl.innerHTML = '';

    try {
        myLocation = await getGeoLocation();
    } catch {
        alertEl.innerHTML = `
        <div class="alert alert--error" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span>Włącz lokalizację żeby zobaczyć produkty w pobliżu.</span>
            <button class="btn btn--sm btn--outline" id="fs-retry">Spróbuj ponownie</button>
        </div>`;
        container.querySelector('#fs-retry')?.addEventListener('click', () => initMap(container));
        myLocation = { lat: 52.237, lng: 21.017 };
    }

    if (map) { map.remove(); map = null; }

    const mapEl = container.querySelector('#fs-map');
    map = L.map(mapEl).setView([myLocation.lat, myLocation.lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
    }).addTo(map);

    L.circleMarker([myLocation.lat, myLocation.lng], {
        radius: 9, fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 1,
    }).addTo(map).bindPopup('📍 Twoja lokalizacja');

    L.circle([myLocation.lat, myLocation.lng], {
        radius: 5000, color: '#3b82f6', fillColor: '#3b82f6',
        fillOpacity: 0.04, weight: 1, dashArray: '4 4',
    }).addTo(map);

    await loadShares(container);
}

async function loadShares(container) {
    markers.forEach(m => m.remove());
    markers = [];

    let shares = [];
    try {
        shares = await api.foodSharing.list(myLocation.lat, myLocation.lng);
    } catch { return; }

    const user = getUser();

    shares.forEach(share => {
        const isOwn        = Number(share.user_id) === Number(user?.id);
        const isReservedMe = !!share.reserved_by && Number(share.reserved_by) === Number(user?.id);
        // Slight random offset (~100m) for privacy
        const lat = share.lat + (Math.random() - 0.5) * 0.002;
        const lng = share.lng + (Math.random() - 0.5) * 0.002;

        const bgColor = share.status === 'reserved'
            ? '#d97706'
            : isOwn ? '#2563eb' : '#16a34a';
        const icon = L.divIcon({
            html: `<div style="background:${bgColor};color:#fff;border-radius:50%;width:38px;height:38px;
                display:flex;align-items:center;justify-content:center;font-size:20px;
                box-shadow:0 2px 8px rgba(0,0,0,.3);border:2px solid #fff;cursor:pointer">🤝</div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            className: '',
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.bindTooltip(share.name, { direction: 'top', offset: [0, -20] });
        marker.on('click', () => showDetail(container, share.id));
        markers.push(marker);
    });
}

async function showDetail(container, shareId) {
    const panel = container.querySelector('#fs-panel');
    panel.style.display = 'block';
    panel.innerHTML = `<div style="padding:24px;text-align:center"><div class="spinner" style="margin:auto"></div></div>`;

    const user = getUser();
    let share;
    try {
        share = await api.foodSharing.get(shareId);
    } catch {
        panel.innerHTML = `<div style="padding:20px"><div class="alert alert--error">Błąd ładowania.</div></div>`;
        return;
    }

    const isOwn      = Number(share.user_id) === Number(user?.id);
    const isReserved = !!share.is_reserved_by_me;
    const dist        = share.distance != null ? `${Number(share.distance).toFixed(1)} km` : '';

    const statusMap = {
        available: `<span style="background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600">✅ Dostępne</span>`,
        reserved:  `<span style="background:#fef3c7;color:#d97706;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600">⏳ Zarezerwowane</span>`,
        given:     `<span style="background:#f3f4f6;color:#6b7280;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600">✓ Oddano</span>`,
        cancelled: `<span style="background:#fee2e2;color:#dc2626;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:600">✗ Anulowane</span>`,
    };

    const actions = [];
    if (!isOwn && share.status === 'available') {
        actions.push(`<button class="btn btn--primary" id="fs-reserve" style="background:#16a34a;border-color:#16a34a">🙋 Rezerwuję</button>`);
    }
    if (isReserved && share.status === 'reserved') {
        actions.push(`<button class="btn btn--outline btn--sm" id="fs-cancel-reserve" style="color:var(--danger);border-color:var(--danger)">Anuluj rezerwację</button>`);
    }
    if (isOwn && share.status === 'reserved') {
        actions.push(`<button class="btn btn--primary btn--sm" id="fs-give" style="background:#16a34a;border-color:#16a34a">✅ Produkt odebrany</button>`);
        actions.push(`<button class="btn btn--outline btn--sm" id="fs-cancel-reserve" style="color:#d97706;border-color:#d97706">↩ Anuluj rezerwację</button>`);
    }
    if (isOwn && share.status === 'available') {
        actions.push(`<button class="btn btn--outline btn--sm" id="fs-cancel-own" style="color:var(--danger);border-color:var(--danger)">Anuluj ogłoszenie</button>`);
    }

    const messages   = share.messages || [];
    const chatClosed = ['given', 'cancelled'].includes(share.status);

    // ── owner: wątki pogrupowane per użytkownik ──────────
    let chatSection = '';
    if (isOwn) {
        chatSection = `
        <div style="border-top:1px solid var(--border);padding-top:14px">
            <div style="font-size:13px;font-weight:700;margin-bottom:10px">💬 Wiadomości od zainteresowanych</div>
            <div id="fs-chat">${buildOwnerThreadsHtml(messages, share.user_id, user?.id, chatClosed)}</div>
        </div>`;
    } else {
        // ── gość / zainteresowany: jego własny wątek ────
        const msgHtml = messages.length
            ? messages.map(m => {
                const mine = Number(m.user_id) === Number(user?.id);
                return `<div style="display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'};margin-bottom:10px">
                    <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">${mine ? 'Ty' : escHtml(m.user?.name)}</div>
                    <div style="max-width:88%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.4;
                        background:${mine ? '#3b82f6' : '#f1f5f9'};color:${mine ? '#fff' : 'var(--text)'}">
                        ${escHtml(m.body)}
                    </div>
                </div>`;
            }).join('')
            : '';

        chatSection = `
        <div style="border-top:1px solid var(--border);padding-top:14px">
            <div style="font-size:13px;font-weight:700;margin-bottom:6px">💬 Napisz do wystawiającego</div>
            ${!messages.length ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Masz pytanie? Napisz zanim zdecydujesz się zarezerwować.</div>` : ''}
            <div id="fs-chat" style="max-height:180px;overflow-y:auto;margin-bottom:10px">${msgHtml}</div>
            ${!chatClosed ? `
            <div style="display:flex;gap:8px">
                <input type="text" id="fs-msg-input" class="form-input" placeholder="Napisz wiadomość…" style="flex:1;font-size:13px">
                <button class="btn btn--primary btn--sm" id="fs-msg-send">Wyślij</button>
            </div>` : `<div style="font-size:12px;color:var(--text-muted)">Ogłoszenie zamknięte.</div>`}
        </div>`;
    }

    panel.innerHTML = `
    <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="font-weight:700;font-size:15px;line-height:1.3">${escHtml(share.name)}</div>
        <button class="btn btn--ghost btn--sm" id="fs-close-panel" style="flex-shrink:0">✕</button>
    </div>

    <div style="padding:14px 16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
            ${statusMap[share.status] || ''}
            ${dist ? `<span style="font-size:12px;color:var(--text-muted)">📍 ${dist}</span>` : ''}
        </div>

        ${share.description ? `<p style="font-size:13px;color:var(--text-muted);margin-bottom:10px">${escHtml(share.description)}</p>` : ''}

        <div style="font-size:13px;margin-bottom:${actions.length ? '14px' : '0'}">
            <span style="color:var(--text-muted)">Oferuje: </span><strong>${escHtml(share.user.name)}</strong>
            ${share.reservedBy ? `<br><span style="color:var(--text-muted)">Zarezerwowane przez: </span><strong>${escHtml(share.reservedBy.name)}</strong>` : ''}
        </div>

        ${actions.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${actions.join('')}</div>` : ''}

        ${chatSection}
    </div>`;

    // scroll czat na dół + uruchom polling
    const chatEl = panel.querySelector('#fs-chat');
    if (chatEl) requestAnimationFrame(() => { chatEl.scrollTop = chatEl.scrollHeight; });
    panel.querySelectorAll('.fs-thread-msgs').forEach(el => {
        requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    });

    const messages0 = share.messages || [];
    lastMessageId = messages0.length ? messages0[messages0.length - 1].id : 0;
    startPolling(container, shareId);

    // eventy
    panel.querySelector('#fs-close-panel')?.addEventListener('click', () => {
        stopPolling();
        panel.style.display = 'none';
    });

    panel.querySelector('#fs-reserve')?.addEventListener('click', async () => {
        const btn = panel.querySelector('#fs-reserve');
        btn.disabled = true; btn.textContent = '…';
        try {
            await api.foodSharing.reserve(shareId);
            await showDetail(container, shareId);
            await loadShares(container);
        } catch (err) {
            btn.disabled = false; btn.textContent = '🙋 Rezerwuję';
            panel.querySelector('#fs-detail-alert')?.remove();
            panel.insertAdjacentHTML('afterbegin', `<div id="fs-detail-alert" class="alert alert--error" style="margin:8px">${escHtml(err.message || 'Błąd')}</div>`);
        }
    });

    panel.querySelector('#fs-cancel-reserve')?.addEventListener('click', async () => {
        try {
            await api.foodSharing.cancelReserve(shareId);
            await showDetail(container, shareId);
            await loadShares(container);
        } catch {}
    });

    panel.querySelector('#fs-give')?.addEventListener('click', async () => {
        if (!confirm('Potwierdzasz że produkt został odebrany przez sąsiada?')) return;
        try {
            await api.foodSharing.give(shareId);
            stopPolling();
            panel.innerHTML = `
            <div style="padding:24px 20px;text-align:center">
                <div style="font-size:32px;margin-bottom:12px">✅</div>
                <div style="font-weight:700;font-size:16px;margin-bottom:8px">Produkt oddany!</div>
                <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">
                    Ogłoszenie i czat zostaną automatycznie usunięte po 7 dniach.
                </div>
                <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                    <button class="btn btn--outline btn--sm" id="fs-purge-now" style="color:var(--danger);border-color:var(--danger)">🗑 Usuń teraz</button>
                    <button class="btn btn--outline btn--sm" id="fs-close-after-give">Zamknij</button>
                </div>
            </div>`;
            panel.querySelector('#fs-purge-now')?.addEventListener('click', async () => {
                await api.foodSharing.purge(shareId);
                panel.style.display = 'none';
                await loadShares(container);
            });
            panel.querySelector('#fs-close-after-give')?.addEventListener('click', () => {
                panel.style.display = 'none';
            });
            await loadShares(container);
        } catch {}
    });

    panel.querySelector('#fs-cancel-own')?.addEventListener('click', async () => {
        if (!confirm('Anulować ogłoszenie?')) return;
        try {
            await api.foodSharing.cancel(shareId);
            panel.style.display = 'none';
            await loadShares(container);
        } catch {}
    });

    // ── Wyślij (gość) ───────────────────────────────────
    const msgInput = panel.querySelector('#fs-msg-input');
    const msgSend  = panel.querySelector('#fs-msg-send');

    msgSend?.addEventListener('click', async () => {
        const body = msgInput?.value.trim();
        if (!body) return;
        msgSend.disabled = true;
        try {
            await api.foodSharing.sendMessage(shareId, { body });
            msgInput.value = '';
            msgSend.disabled = false;
            lastMessageId = 0;
            await pollMessages(container, shareId, true);
        } catch { msgSend.disabled = false; }
    });

    msgInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); msgSend?.click(); }
    });

    // ── Wyślij (owner — per wątek) ───────────────────────
    bindThreadSendButtons(panel, container, shareId);
}

function buildOwnerThreadsHtml(messages, ownerUserId, viewerUserId, chatClosed) {
    const threads = {};
    messages.forEach(m => {
        const tid = String(m.thread_user_id ?? m.user_id);
        if (!threads[tid]) {
            const senderName = Number(m.user_id) !== Number(ownerUserId) ? m.user?.name : null;
            threads[tid] = { tid, name: senderName, msgs: [] };
        }
        threads[tid].msgs.push(m);
    });

    if (!Object.keys(threads).length) {
        return `<div style="font-size:12px;color:var(--text-muted)">Nikt jeszcze nie napisał.</div>`;
    }

    return Object.values(threads).map(t => `
    <div style="margin-bottom:14px;padding:10px 12px;background:#f8fafc;border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:8px">👤 ${escHtml(t.name || 'Użytkownik')}</div>
        <div class="fs-thread-msgs" style="max-height:140px;overflow-y:auto;margin-bottom:8px">
            ${t.msgs.map(m => {
                const mine = Number(m.user_id) === Number(viewerUserId);
                return `<div style="display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'};margin-bottom:6px">
                    <div style="max-width:92%;padding:6px 10px;border-radius:10px;font-size:13px;line-height:1.4;
                        background:${mine ? '#3b82f6' : '#e2e8f0'};color:${mine ? '#fff' : 'var(--text)'}">
                        ${escHtml(m.body)}
                    </div>
                </div>`;
            }).join('')}
        </div>
        ${!chatClosed ? `
        <div style="display:flex;gap:6px">
            <input type="text" class="form-input fs-thread-input" data-tid="${t.tid}"
                placeholder="Odpowiedz…" style="flex:1;font-size:12px;padding:6px 10px">
            <button class="btn btn--primary btn--sm fs-thread-send" data-tid="${t.tid}">Wyślij</button>
        </div>` : ''}
    </div>`).join('');
}

function bindThreadSendButtons(panel, container, shareId) {
    panel.querySelectorAll('.fs-thread-send').forEach(btn => {
        const tid = btn.dataset.tid;
        const input = panel.querySelector(`.fs-thread-input[data-tid="${tid}"]`);
        const doSend = async () => {
            const body = input?.value.trim();
            if (!body) return;
            btn.disabled = true;
            try {
                await api.foodSharing.sendMessage(shareId, { body, thread_user_id: tid });
                input.value = '';
                lastMessageId = 0;
                await pollMessages(container, shareId, true);
            } catch { btn.disabled = false; }
        };
        btn.addEventListener('click', doSend);
        input?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
        });
    });
}

function bindFsPageEvents(container) {
    container.querySelector('#fs-my-btn')?.addEventListener('click', () => toggleMyPanel(container));
}

async function toggleMyPanel(container) {
    const panel = container.querySelector('#fs-my-panel');
    if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }

    panel.style.display = 'block';
    panel.innerHTML = `<div style="padding:16px 20px;text-align:center"><div class="spinner" style="margin:auto"></div></div>`;

    let shares = [];
    try { shares = await api.foodSharing.my(); } catch {}

    const user = getUser();
    const myListings   = shares.filter(s => s.user_id === user?.id);
    const myReserved   = shares.filter(s => s.reserved_by === user?.id);

    if (!myListings.length && !myReserved.length) {
        panel.innerHTML = `<div style="padding:14px 20px;font-size:13px;color:var(--text-muted)">Nie masz aktywnych ogłoszeń ani rezerwacji.</div>`;
        return;
    }

    const statusLabel = { available: '✅ Dostępne', reserved: '⏳ Zarezerwowane', given: '✓ Oddano' };

    const renderRow = (s, isOwner) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);gap:8px;flex-wrap:wrap">
        <div style="cursor:pointer;flex:1" class="fs-open-share" data-id="${s.id}">
            <div style="font-size:14px;font-weight:600">${escHtml(s.name)}</div>
            <div style="font-size:12px;color:var(--text-muted)">${statusLabel[s.status] || s.status}
                ${isOwner && s.reservedBy ? ` · zarezerwował: <strong>${escHtml(s.reservedBy.name)}</strong>` : ''}
                ${!isOwner ? ` · od: <strong>${escHtml(s.user?.name || '')}</strong>` : ''}
            </div>
        </div>
        <div style="display:flex;gap:6px">
            ${isOwner && s.status === 'reserved' ? `<button class="btn btn--primary btn--sm fs-give-btn" data-id="${s.id}" style="background:#16a34a;border-color:#16a34a">✅ Oddano</button>` : ''}
            ${isOwner && ['available','reserved'].includes(s.status) ? `<button class="btn btn--outline btn--sm fs-cancel-btn" data-id="${s.id}" style="color:var(--danger);border-color:var(--danger)">Anuluj</button>` : ''}
            ${isOwner && ['given','cancelled'].includes(s.status) ? `<button class="btn btn--outline btn--sm fs-purge-btn" data-id="${s.id}" style="color:var(--danger);border-color:var(--danger)">🗑 Usuń</button>` : ''}
            ${!isOwner && s.status === 'reserved' ? `<button class="btn btn--outline btn--sm fs-cancel-reserve-btn" data-id="${s.id}" style="color:var(--danger);border-color:var(--danger)">Anuluj rezerwację</button>` : ''}
        </div>
    </div>`;

    panel.innerHTML = `
    <div style="padding:12px 20px;font-size:14px;font-weight:700;border-bottom:1px solid var(--border)">Moje ogłoszenia i rezerwacje</div>
    <div style="padding:4px 20px">
        ${myListings.length ? `
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;padding:10px 0 4px">Wystawione przeze mnie</div>
        ${myListings.map(s => renderRow(s, true)).join('')}` : ''}

        ${myReserved.length ? `
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;padding:10px 0 4px">Zarezerwowane przeze mnie</div>
        ${myReserved.map(s => renderRow(s, false)).join('')}` : ''}
    </div>`;

    panel.querySelectorAll('.fs-open-share').forEach(el => {
        el.addEventListener('click', () => {
            showDetail(container, el.dataset.id);
            panel.style.display = 'none';
        });
    });

    panel.querySelectorAll('.fs-give-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Potwierdzasz że produkt został odebrany?')) return;
            btn.disabled = true;
            try {
                await api.foodSharing.give(btn.dataset.id);
                await toggleMyPanel(container);
                await loadShares(container);
            } catch { btn.disabled = false; }
        });
    });

    panel.querySelectorAll('.fs-cancel-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Anulować ogłoszenie?')) return;
            btn.disabled = true;
            try {
                await api.foodSharing.cancel(btn.dataset.id);
                await toggleMyPanel(container);
                await loadShares(container);
            } catch { btn.disabled = false; }
        });
    });

    panel.querySelectorAll('.fs-purge-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Trwale usunąć ogłoszenie i całą rozmowę?')) return;
            btn.disabled = true;
            try {
                await api.foodSharing.purge(btn.dataset.id);
                await toggleMyPanel(container);
                await loadShares(container);
            } catch { btn.disabled = false; }
        });
    });

    panel.querySelectorAll('.fs-cancel-reserve-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Anulować rezerwację?')) return;
            btn.disabled = true;
            try {
                await api.foodSharing.cancelReserve(btn.dataset.id);
                await toggleMyPanel(container);
                await loadShares(container);
            } catch { btn.disabled = false; }
        });
    });
}

export function getGeoLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('Brak geolokalizacji')); return; }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            err => reject(err),
            { timeout: 10000, maximumAge: 300000 }
        );
    });
}

function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
