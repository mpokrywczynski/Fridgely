import { api } from './api.js';
import { getUser } from './auth.js';
import { openPremiumModal } from './premium.js';

let family = null;

export async function renderFamily(container) {
    container.innerHTML = '<div style="padding:24px;text-align:center"><div class="spinner" style="margin:auto"></div></div>';

    try {
        family = await api.family.get();
    } catch {
        container.innerHTML = '<div class="alert alert--error">Błąd ładowania danych rodziny.</div>';
        return;
    }

    render(container);
}

function render(container) {
    const user    = getUser();
    const isOwner = user?.role === 'owner';

    container.innerHTML = `
        <div style="max-width:640px;display:flex;flex-direction:column;gap:20px">

            ${renderFamilyCard(isOwner)}
            ${renderPlanCard()}
            ${renderMembersCard(isOwner)}
            ${renderZonesCard(isOwner)}
            ${renderJoinCard()}

        </div>

        ${renderZoneModal()}
    `;

    bindEvents(container, isOwner);
}

/* ── Karta rodziny ──────────────────────────────────── */
function renderFamilyCard(isOwner) {
    const code = family.invite_code;
    return `
    <div class="card">
        <div class="card__header">
            <span class="card__title">👨‍👩‍👧 Twoja rodzina</span>
            ${isOwner ? `<button class="btn btn--ghost btn--sm" id="btn-edit-name">✏️ Zmień nazwę</button>` : ''}
        </div>
        <div class="card__body">

            <div id="family-name-display">
                <p style="font-size:22px;font-weight:700;margin-bottom:4px">${escHtml(family.name)}</p>
                <p style="font-size:13px;color:var(--text-muted)">${family.members?.length ?? 1} ${memberWord(family.members?.length ?? 1)}</p>
            </div>

            <form id="family-name-form" style="display:none;margin-bottom:4px">
                <div style="display:flex;gap:8px;align-items:center">
                    <input type="text" id="input-family-name" class="form-input" value="${escHtml(family.name)}" style="flex:1">
                    <button type="submit" class="btn btn--primary btn--sm">Zapisz</button>
                    <button type="button" class="btn btn--ghost btn--sm" id="btn-cancel-name">Anuluj</button>
                </div>
                <div id="name-error" style="color:var(--danger);font-size:12px;margin-top:4px"></div>
            </form>

            <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">

            <p style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">
                Kod zaproszenia
            </p>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <div id="invite-code-display" style="
                    font-size:28px;font-weight:800;letter-spacing:.25em;
                    background:var(--bg);padding:10px 20px;border-radius:10px;
                    border:2px dashed var(--border);font-family:monospace;color:var(--primary)">
                    ${escHtml(code)}
                </div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    <button class="btn btn--outline btn--sm" id="btn-copy-code">📋 Kopiuj</button>
                    ${isOwner ? `<button class="btn btn--ghost btn--sm" id="btn-regen-code">🔄 Generuj nowy</button>` : ''}
                </div>
            </div>
            <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
                Podziel się kodem z rodziną — mogą dołączyć w ustawieniach konta.
            </p>

        </div>
    </div>`;
}

/* ── Karta planu ────────────────────────────────────── */
function renderPlanCard() {
    const isPremium = !!family.is_premium;

    if (isPremium) {
        return `
        <div class="card">
            <div class="card__header">
                <span class="card__title">💎 Plan</span>
                <span style="font-size:12px;font-weight:600;background:#FEF3C7;color:#B45309;
                    padding:3px 10px;border-radius:99px">⭐ Premium</span>
            </div>
            <div class="card__body">
                <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
                    Twoja rodzina korzysta z planu Premium.
                </p>
                <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;margin-bottom:16px">
                    <div>✓ 10 odświeżeń przepisów dziennie</div>
                    <div>✓ Własne przepisy bez limitu</div>
                    <div>✓ Statystyki i Zero-Waste Score</div>
                    <div style="color:var(--text-muted)">
                        ✓ Aplikacja mobilna Android/iOS
                        <span style="font-size:11px;background:#FEF3C7;color:#B45309;
                            padding:1px 6px;border-radius:99px;font-weight:600;margin-left:4px">wkrótce</span>
                    </div>
                </div>
                <button class="btn btn--outline btn--sm" id="btn-plan-details">Zobacz szczegóły planu</button>
            </div>
        </div>`;
    }

    return `
    <div class="card">
        <div class="card__header">
            <span class="card__title">💎 Plan</span>
            <span style="font-size:12px;font-weight:600;background:var(--bg);color:var(--text-muted);
                padding:3px 10px;border-radius:99px;border:1px solid var(--border)">Darmowy</span>
        </div>
        <div class="card__body">
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
                Korzystasz z bezpłatnego planu. Ulepsz do Premium, aby odblokować więcej funkcji.
            </p>
            <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;margin-bottom:20px">
                <div>✓ Zarządzanie lodówką i strefami</div>
                <div>✓ Lista zakupów i skanowanie paragonów</div>
                <div>✓ Własne przepisy bez limitu</div>
                <div style="color:#9CA3AF">✕ 1 odświeżenie przepisów / dzień
                    <span style="font-size:11px;background:#ECFDF5;color:var(--primary);
                        padding:1px 6px;border-radius:99px;font-weight:600;margin-left:4px">Premium: 10×</span>
                </div>
                <div style="color:#9CA3AF">✕ Statystyki i Zero-Waste Score
                    <span style="font-size:11px;background:#F3F4F6;color:#9CA3AF;
                        padding:1px 6px;border-radius:99px;font-weight:600;margin-left:4px">wkrótce</span>
                </div>
            </div>
            <button class="btn btn--full" id="btn-upgrade-plan" style="background:#F59E0B;color:#fff;border:none;font-weight:600;margin-top:4px">⭐ Przejdź na Premium — 12,99 zł/mies.</button>
        </div>
    </div>`;
}

/* ── Karta członków ─────────────────────────────────── */
function renderMembersCard(isOwner) {
    const members = family.members ?? [];

    const rows = members.map(m => {
        const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        const isMe     = m.id === getUser()?.id;
        const canRemove = isOwner && !isMe;
        return `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="
                width:40px;height:40px;border-radius:50%;background:var(--primary);
                display:flex;align-items:center;justify-content:center;
                font-weight:700;font-size:14px;flex-shrink:0">
                ${escHtml(initials)}
            </div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:14px">${escHtml(m.name)} ${isMe ? '<span style="font-size:11px;color:var(--text-muted)">(Ty)</span>' : ''}</div>
                <div style="font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(m.email)}</div>
            </div>
            <span style="
                font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;
                background:${m.role === 'owner' ? 'var(--primary)' : 'var(--bg)'};
                color:${m.role === 'owner' ? '#000' : 'var(--text-muted)'}">
                ${m.role === 'owner' ? '👑 Właściciel' : 'Członek'}
            </span>
            ${canRemove ? `<button class="btn btn--ghost btn--sm btn-remove-member"
                data-id="${m.id}" data-name="${escHtml(m.name)}"
                style="color:var(--danger);flex-shrink:0" title="Usuń z rodziny">🗑</button>` : ''}
        </div>`;
    }).join('');

    return `
    <div class="card">
        <div class="card__header">
            <span class="card__title">👥 Członkowie (${members.length})</span>
        </div>
        <div class="card__body" style="padding-top:4px;padding-bottom:4px">
            ${rows || '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Brak członków.</p>'}
        </div>
    </div>`;
}

/* ── Karta stref ────────────────────────────────────── */
function renderZonesCard(isOwner) {
    const zones = family.storage_zones ?? [];

    const rows = zones.map(z => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:22px;width:32px;text-align:center">${escHtml(z.icon)}</span>
            <span style="flex:1;font-weight:500;font-size:14px">${escHtml(z.name)}</span>
            <span style="font-size:12px;color:var(--text-muted);background:var(--bg);padding:2px 8px;border-radius:99px">
                ${z.active_products_count ?? 0} prod.
            </span>
            ${isOwner ? `
            <button class="btn btn--ghost btn--sm btn-edit-zone" data-zone='${JSON.stringify(z)}'>✏️</button>
            <button class="btn btn--ghost btn--sm btn-delete-zone" data-id="${z.id}" data-name="${escHtml(z.name)}" style="color:var(--danger)">🗑</button>
            ` : ''}
        </div>`).join('');

    return `
    <div class="card">
        <div class="card__header">
            <span class="card__title">📦 Strefy przechowywania</span>
            ${isOwner ? `<button class="btn btn--primary btn--sm" id="btn-add-zone">+ Dodaj strefę</button>` : ''}
        </div>
        <div class="card__body" style="padding-top:4px;padding-bottom:4px">
            ${rows || '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Brak stref.</p>'}
        </div>
    </div>`;
}

/* ── Karta dołącz do rodziny ────────────────────────── */
function renderJoinCard() {
    return `
    <div class="card">
        <div class="card__header">
            <span class="card__title">🔗 Dołącz do innej rodziny</span>
        </div>
        <div class="card__body">
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
                Wpisz kod zaproszenia otrzymany od właściciela rodziny. Twoje konto zostanie przeniesione do tej rodziny.
            </p>
            <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
                <input type="text" id="input-join-code" class="form-input"
                    placeholder="Kod (8 znaków)" maxlength="8"
                    style="flex:1;min-width:140px;text-transform:uppercase;letter-spacing:.15em;font-family:monospace;font-size:16px;font-weight:700">
                <button class="btn btn--primary" id="btn-join-family">Dołącz</button>
            </div>
            <div id="join-error" style="display:none;color:var(--danger);font-size:12px;margin-top:8px"></div>
            <div id="join-success" style="display:none;color:var(--primary);font-size:12px;margin-top:8px;font-weight:600"></div>
        </div>
    </div>`;
}

/* ── Modal strefy ───────────────────────────────────── */
function renderZoneModal() {
    const icons = ['🧊','❄️','🥡','🥫','🍷','🧺','🍞','🥦','🍎','🥩','🧴','📦'];
    const types = [
        { val: 'fridge',  label: 'Lodówka' },
        { val: 'freezer', label: 'Zamrażalnik' },
        { val: 'pantry',  label: 'Spiżarnia' },
        { val: 'cellar',  label: 'Piwniczka' },
        { val: 'custom',  label: 'Inna' },
    ];

    return `
    <div class="modal-backdrop" id="modal-zone">
        <div class="modal" style="max-width:400px">
            <div class="modal__header">
                <h3 id="zone-modal-title">Dodaj strefę</h3>
                <button class="btn btn--ghost btn--sm" id="zone-modal-close">✕</button>
            </div>
            <div class="modal__body">
                <div id="zone-modal-alert"></div>
                <input type="hidden" id="zone-modal-id">
                <div class="form-group">
                    <label class="form-label">Nazwa strefy *</label>
                    <input type="text" id="zone-modal-name" class="form-input" placeholder="np. Lodówka w garażu">
                </div>
                <div class="form-group">
                    <label class="form-label">Typ</label>
                    <select id="zone-modal-type" class="form-input">
                        ${types.map(t => `<option value="${t.val}">${t.label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Ikona</label>
                    <div style="display:flex;flex-wrap:wrap;gap:6px" id="zone-icon-picker">
                        ${icons.map(ic => `
                        <button type="button" class="zone-icon-btn" data-icon="${ic}"
                            style="font-size:22px;width:40px;height:40px;border-radius:8px;border:2px solid transparent;
                            background:var(--bg);cursor:pointer;transition:border-color .15s">
                            ${ic}
                        </button>`).join('')}
                    </div>
                    <input type="hidden" id="zone-modal-icon" value="📦">
                </div>
            </div>
            <div class="modal__footer">
                <button class="btn btn--outline" id="zone-modal-cancel">Anuluj</button>
                <button class="btn btn--primary" id="zone-modal-save">Zapisz</button>
            </div>
        </div>
    </div>`;
}

/* ── Zdarzenia ──────────────────────────────────────── */
function bindEvents(container, isOwner) {
    const user = getUser();

    /* Plan Premium */
    const isPremium = !!family.is_premium;
    container.querySelector('#btn-upgrade-plan')
        ?.addEventListener('click', () => openPremiumModal(isPremium));
    container.querySelector('#btn-plan-details')
        ?.addEventListener('click', () => openPremiumModal(isPremium));

    /* Zmiana nazwy rodziny */
    if (isOwner) {
        container.querySelector('#btn-edit-name')?.addEventListener('click', () => {
            container.querySelector('#family-name-display').style.display = 'none';
            container.querySelector('#family-name-form').style.display    = 'block';
            container.querySelector('#input-family-name').focus();
        });

        container.querySelector('#btn-cancel-name')?.addEventListener('click', () => {
            container.querySelector('#family-name-display').style.display = 'block';
            container.querySelector('#family-name-form').style.display    = 'none';
        });

        container.querySelector('#family-name-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = container.querySelector('#input-family-name').value.trim();
            if (!name) return;
            try {
                await api.family.update({ name });
                family.name = name;
                container.querySelector('#family-name-display').querySelector('p').textContent = name;
                container.querySelector('#family-name-display').style.display = 'block';
                container.querySelector('#family-name-form').style.display    = 'none';
            } catch (err) {
                container.querySelector('#name-error').textContent = err.message;
            }
        });

        /* Generuj nowy kod */
        container.querySelector('#btn-regen-code')?.addEventListener('click', async () => {
            if (!confirm('Stary kod przestanie działać. Kontynuować?')) return;
            try {
                const res = await api.family.regenerateCode();
                family.invite_code = res.invite_code;
                container.querySelector('#invite-code-display').textContent = res.invite_code;
            } catch {}
        });
    }

    /* Kopiuj kod */
    container.querySelector('#btn-copy-code')?.addEventListener('click', () => {
        navigator.clipboard.writeText(family.invite_code).then(() => {
            const btn = container.querySelector('#btn-copy-code');
            btn.textContent = '✅ Skopiowano!';
            setTimeout(() => { btn.textContent = '📋 Kopiuj'; }, 2000);
        });
    });

    /* Strefy — dodaj/edytuj/usuń */
    if (isOwner) {
        container.querySelector('#btn-add-zone')?.addEventListener('click', () => openZoneModal());

        container.querySelectorAll('.btn-edit-zone').forEach(btn => {
            btn.addEventListener('click', () => {
                const zone = JSON.parse(btn.dataset.zone);
                openZoneModal(zone);
            });
        });

        container.querySelectorAll('.btn-delete-zone').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm(`Usunąć strefę "${btn.dataset.name}"? Wszystkie produkty zostaną usunięte.`)) return;
                try {
                    await api.zones.delete(parseInt(btn.dataset.id));
                    family = await api.family.get();
                    render(container);
                } catch (err) {
                    alert(err.message || 'Błąd usuwania strefy.');
                }
            });
        });
    }

    /* Usuń członka */
    if (isOwner) {
        container.querySelectorAll('.btn-remove-member').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id   = parseInt(btn.dataset.id);
                const name = btn.dataset.name;
                if (!confirm(`Usunąć „${name}" z rodziny? Osoba straci dostęp do wspólnych danych.`)) return;
                btn.disabled = true;
                try {
                    await api.family.removeMember(id);
                    family = await api.family.get();
                    render(container);
                } catch (err) {
                    alert(err.message || 'Błąd usuwania członka.');
                    btn.disabled = false;
                }
            });
        });
    }

    /* Dołącz do rodziny */
    container.querySelector('#btn-join-family')?.addEventListener('click', async () => {
        const input   = container.querySelector('#input-join-code');
        const errEl   = container.querySelector('#join-error');
        const okEl    = container.querySelector('#join-success');
        const code    = (input?.value ?? '').trim().toUpperCase();

        errEl.style.display = 'none';
        okEl.style.display  = 'none';

        if (code.length !== 8) {
            errEl.textContent  = 'Kod musi mieć dokładnie 8 znaków.';
            errEl.style.display = 'block';
            return;
        }

        const btn = container.querySelector('#btn-join-family');
        btn.disabled = true;
        btn.textContent = '…';

        try {
            await api.family.join({ invite_code: code });
            okEl.textContent   = '✅ Dołączono! Przeładowuję…';
            okEl.style.display  = 'block';
            setTimeout(() => renderFamily(container), 1200);
        } catch (err) {
            errEl.textContent  = err.message || 'Nieprawidłowy kod lub błąd serwera.';
            errEl.style.display = 'block';
            btn.disabled     = false;
            btn.textContent  = 'Dołącz';
        }
    });

    /* Modal strefy */
    bindZoneModalEvents(container);
}

function openZoneModal(zone = null) {
    const modal = document.getElementById('modal-zone');
    document.getElementById('zone-modal-title').textContent = zone ? 'Edytuj strefę' : 'Dodaj strefę';
    document.getElementById('zone-modal-id').value          = zone?.id ?? '';
    document.getElementById('zone-modal-name').value        = zone?.name ?? '';
    document.getElementById('zone-modal-type').value        = zone?.type ?? 'custom';
    document.getElementById('zone-modal-icon').value        = zone?.icon ?? '📦';
    document.getElementById('zone-modal-alert').innerHTML   = '';

    document.querySelectorAll('.zone-icon-btn').forEach(btn => {
        btn.style.borderColor = btn.dataset.icon === (zone?.icon ?? '📦') ? 'var(--primary)' : 'transparent';
    });

    modal.classList.add('is-open');
    document.getElementById('zone-modal-name').focus();
}

function bindZoneModalEvents(container) {
    const modal     = document.getElementById('modal-zone');
    const closeModal = () => modal.classList.remove('is-open');

    document.getElementById('zone-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('zone-modal-cancel')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    document.getElementById('zone-icon-picker')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.zone-icon-btn');
        if (!btn) return;
        document.querySelectorAll('.zone-icon-btn').forEach(b => b.style.borderColor = 'transparent');
        btn.style.borderColor = 'var(--primary)';
        document.getElementById('zone-modal-icon').value = btn.dataset.icon;
    });

    document.getElementById('zone-modal-save')?.addEventListener('click', async () => {
        const id   = document.getElementById('zone-modal-id').value;
        const name = document.getElementById('zone-modal-name').value.trim();
        const type = document.getElementById('zone-modal-type').value;
        const icon = document.getElementById('zone-modal-icon').value;
        const alertEl = document.getElementById('zone-modal-alert');

        if (!name) { alertEl.innerHTML = '<div class="alert alert--error">Nazwa jest wymagana.</div>'; return; }

        const btn = document.getElementById('zone-modal-save');
        btn.disabled = true;

        try {
            if (id) {
                await api.zones.update(parseInt(id), { name, type, icon });
            } else {
                await api.zones.create({ name, type, icon });
            }
            closeModal();
            family = await api.family.get();
            const pageContainer = document.getElementById('page-content');
            render(pageContainer);
        } catch (err) {
            alertEl.innerHTML = `<div class="alert alert--error">${escHtml(err.message)}</div>`;
            btn.disabled = false;
        }
    });
}

/* ── Helpers ────────────────────────────────────────── */
function memberWord(n) {
    if (n === 1) return 'członek';
    if (n >= 2 && n <= 4) return 'członków';
    return 'członków';
}

function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
