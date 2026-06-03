import { api } from './api.js';

export async function renderSupport(container) {
    container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted)">
        <div class="spinner" style="margin:0 auto 12px"></div>Ładowanie…</div>`;

    let history = [];
    try { history = await api.support.list(); } catch {}

    container.innerHTML = `
    <div style="max-width:620px;margin:0 auto">

        <h2 style="font-size:22px;font-weight:700;margin-bottom:4px">Pomoc &amp; kontakt</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:24px">
            Masz pytanie lub problem? Napisz do nas — odpowiemy w ciągu 24 godzin.
        </p>

        <div id="support-alert"></div>

        <div class="card" style="margin-bottom:24px">
            <div class="card__body">
                <form id="support-form">
                    <div class="form-group">
                        <label class="form-label">Temat</label>
                        <select id="support-subject" class="form-input">
                            <option value="">— Wybierz temat —</option>
                            <option value="Błąd w aplikacji">🐛 Błąd w aplikacji</option>
                            <option value="Pytanie o Premium">⭐ Pytanie o Premium</option>
                            <option value="Prośba o funkcję">💡 Prośba o nową funkcję</option>
                            <option value="Problem z kontem">👤 Problem z kontem</option>
                            <option value="Inne">💬 Inne</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Wiadomość</label>
                        <textarea id="support-message" class="form-input" rows="5"
                            placeholder="Opisz swój problem lub pytanie…"
                            style="resize:vertical;min-height:110px"></textarea>
                    </div>
                    <button type="submit" class="btn btn--primary btn--full" id="support-btn">
                        Wyślij wiadomość
                    </button>
                </form>
            </div>
        </div>

        ${history.length > 0 ? `
        <h3 style="font-size:15px;font-weight:700;margin-bottom:12px">Twoje zgłoszenia</h3>
        <div id="support-history">
            ${history.map(m => renderTicket(m)).join('')}
        </div>
        ` : ''}

        <div style="margin-top:20px;padding:14px 18px;background:var(--bg);border-radius:10px;
            border:1px solid var(--border);font-size:13px;color:var(--text-muted);line-height:1.6">
            📧 Możesz też napisać bezpośrednio na
            <strong style="color:var(--text)">support@getfridgely.pl</strong>
        </div>
    </div>`;

    bindSupportEvents(container);
}

function renderTicket(m) {
    const date = fmtDate(m.created_at);
    const closed = !!m.closed_at;

    const allReplies = [];
    if (m.admin_reply && (!m.replies || !m.replies.find(r => r.is_admin))) {
        allReplies.push({ body: m.admin_reply, is_admin: true, created_at: m.updated_at });
    }
    if (m.replies) allReplies.push(...m.replies);
    allReplies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const statusBadge = closed
        ? `<span style="font-size:11px;background:#f3f4f6;color:#6b7280;padding:2px 9px;border-radius:99px;font-weight:600">✓ Zamknięte</span>`
        : allReplies.some(r => r.is_admin)
            ? `<span style="font-size:11px;background:#ecfdf5;color:#16a34a;padding:2px 9px;border-radius:99px;font-weight:600">💬 Odpowiedziano</span>`
            : `<span style="font-size:11px;background:#fef3c7;color:#d97706;padding:2px 9px;border-radius:99px;font-weight:600">⏳ Oczekuje</span>`;

    const thread = allReplies.map(r => `
        <div style="padding:10px 14px;margin-top:1px;
            background:${r.is_admin ? '#f0fdf4' : '#f8fafc'};
            border-left:3px solid ${r.is_admin ? '#16a34a' : '#94a3b8'}">
            <div style="font-size:11px;font-weight:600;color:${r.is_admin ? '#16a34a' : '#64748b'};margin-bottom:4px">
                ${r.is_admin ? '💬 GetFridgely Support' : '👤 Ty'} · ${fmtDate(r.created_at)}
            </div>
            <div style="font-size:13px;white-space:pre-wrap;word-break:break-word">${escHtml(r.body)}</div>
        </div>`).join('');

    const replyForm = !closed ? `
        <div style="padding:12px 14px;border-top:1px solid var(--border);background:var(--bg)">
            <div id="reply-toggle-${m.id}">
                <button class="btn btn--outline btn--sm btn-reply-toggle" data-id="${m.id}">
                    ↩ Odpowiedz
                </button>
                <button class="btn btn--sm btn-close-ticket" data-id="${m.id}"
                    style="margin-left:8px;background:none;border:1px solid var(--border);color:var(--text-muted);font-size:12px">
                    ✓ Zamknij sprawę
                </button>
            </div>
            <div id="reply-form-${m.id}" style="display:none;margin-top:10px">
                <textarea class="form-input reply-textarea" data-id="${m.id}" rows="3"
                    placeholder="Napisz kontynuację…"
                    style="resize:vertical;min-height:70px;margin-bottom:8px"></textarea>
                <div style="display:flex;gap:8px">
                    <button class="btn btn--primary btn--sm btn-reply-send" data-id="${m.id}">Wyślij</button>
                    <button class="btn btn--outline btn--sm btn-reply-cancel" data-id="${m.id}">Anuluj</button>
                </div>
            </div>
        </div>` : `
        <div style="padding:10px 14px;border-top:1px solid var(--border);background:#f9fafb;font-size:12px;color:var(--text-muted)">
            ✓ Sprawa zamknięta ${fmtDate(m.closed_at)} · zostanie automatycznie usunięta po 7 dniach
        </div>`;

    return `
    <div class="support-ticket" data-id="${m.id}" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:14px">
        <div style="padding:12px 14px;background:var(--bg);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
                <span style="font-weight:700;font-size:14px">${escHtml(m.subject)}</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:8px">${date}</span>
            </div>
            ${statusBadge}
        </div>
        <div style="padding:12px 14px;border-top:1px solid var(--border)">
            <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px">👤 Ty</div>
            <div style="font-size:13px;white-space:pre-wrap;word-break:break-word">${escHtml(m.message)}</div>
        </div>
        ${thread}
        ${replyForm}
    </div>`;
}

function bindSupportEvents(container) {
    // Nowe zgłoszenie
    container.querySelector('#support-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = container.querySelector('#support-subject').value;
        const message = container.querySelector('#support-message').value.trim();
        const alertEl = container.querySelector('#support-alert');
        const btn     = container.querySelector('#support-btn');

        alertEl.innerHTML = '';
        if (!subject) { alertEl.innerHTML = alert('error', 'Wybierz temat.'); return; }
        if (message.length < 10) { alertEl.innerHTML = alert('error', 'Wiadomość jest za krótka.'); return; }

        btn.disabled = true; btn.textContent = 'Wysyłanie…';
        try {
            const res = await api.support.send({ subject, message });
            alertEl.innerHTML = alert('success', res.message);
            container.querySelector('#support-subject').value = '';
            container.querySelector('#support-message').value = '';
            setTimeout(() => renderSupport(container), 800);
        } catch (err) {
            alertEl.innerHTML = alert('error', err.message || 'Błąd wysyłania.');
            btn.disabled = false; btn.textContent = 'Wyślij wiadomość';
        }
    });

    // Toggle formularza odpowiedzi
    container.querySelectorAll('.btn-reply-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const id   = btn.dataset.id;
            const form = container.querySelector(`#reply-form-${id}`);
            const tog  = container.querySelector(`#reply-toggle-${id}`);
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
        });
    });

    container.querySelectorAll('.btn-reply-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelector(`#reply-form-${btn.dataset.id}`).style.display = 'none';
        });
    });

    // Wyślij odpowiedź
    container.querySelectorAll('.btn-reply-send').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id      = btn.dataset.id;
            const textarea = container.querySelector(`.reply-textarea[data-id="${id}"]`);
            const body    = textarea?.value.trim();
            if (!body || body.length < 3) return;

            btn.disabled = true; btn.textContent = '…';
            try {
                await api.support.reply(id, { body });
                await renderSupport(container);
            } catch (err) {
                btn.disabled = false; btn.textContent = 'Wyślij';
                container.querySelector('#support-alert').innerHTML = alert('error', err.message || 'Błąd.');
            }
        });
    });

    // Zamknij sprawę
    container.querySelectorAll('.btn-close-ticket').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Zamknąć tę sprawę? Po 7 dniach zostanie automatycznie usunięta.')) return;
            btn.disabled = true;
            try {
                await api.support.close(btn.dataset.id);
                await renderSupport(container);
            } catch { btn.disabled = false; }
        });
    });
}

function fmtDate(str) {
    if (!str) return '';
    return new Date(str).toLocaleDateString('pl-PL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function alert(type, msg) {
    return `<div class="alert alert--${type}" style="margin-bottom:16px">${escHtml(msg)}</div>`;
}

function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
