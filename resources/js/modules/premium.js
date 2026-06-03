export function injectPremiumModal() {
    if (document.getElementById('modal-premium')) return;
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="modal-backdrop" id="modal-premium">
        <div class="modal" style="max-width:580px">
            <div class="modal__header">
                <h3 style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:22px">⭐</span> GetFridgely Premium
                </h3>
                <button class="btn btn--ghost btn--sm" id="premium-modal-close">✕</button>
            </div>
            <div class="modal__body" id="premium-modal-body"></div>
        </div>
    </div>`;
    document.body.appendChild(div.firstElementChild);

    document.getElementById('premium-modal-close')
        ?.addEventListener('click', closePremiumModal);
    document.getElementById('modal-premium')
        ?.addEventListener('click', e => { if (e.target.id === 'modal-premium') closePremiumModal(); });
}

export function openPremiumModal(isPremium = false) {
    const modal = document.getElementById('modal-premium');
    if (!modal) return;

    document.getElementById('premium-modal-body').innerHTML =
        isPremium ? renderPremiumContent() : renderFreeContent();

    document.getElementById('btn-buy-premium')?.addEventListener('click', () => {
        document.getElementById('btn-buy-premium').style.display = 'none';
        document.getElementById('premium-buy-msg').style.display = 'block';
    });

    modal.classList.add('is-open');
}

function closePremiumModal() {
    document.getElementById('modal-premium')?.classList.remove('is-open');
}

function renderFreeContent() {
    return `
    <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:var(--bg);border:1px solid var(--border);border-radius:99px;padding:4px 16px;font-size:13px;color:var(--text-muted)">
            Twój plan: <strong style="color:var(--text)">Darmowy</strong>
        </div>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:8px">

        <div style="flex:1;min-width:200px;border:2px solid var(--border);border-radius:12px;padding:20px">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px">Darmowy</div>
            <div style="font-size:24px;font-weight:800;margin-bottom:16px;color:var(--text-muted)">0 zł</div>
            ${feat('Zarządzanie lodówką i strefami')}
            ${feat('Lista zakupów')}
            ${feat('Skanowanie paragonów')}
            ${feat('Własne przepisy (bez limitu)')}
            ${feat('1 odświeżenie przepisów / dzień')}
            ${featNo('10 odświeżeń przepisów / dzień')}
            ${featNo('Wyszukiwanie produktów w lodówce')}
            ${featNo('Aktualizacje listy zakupów na żywo')}
            ${featNo('Smart sortowanie listy (alejki)')}
            ${featNo('Statystyki i Zero-Waste Score')}
            ${featNo('Licznik uratowanej kasy (zł)')}
            ${featNo('Aplikacja mobilna Android/iOS', true)}
            <button class="btn btn--outline btn--full" disabled style="margin-top:20px;opacity:.6">Aktualny plan</button>
        </div>

        <div style="flex:1;min-width:200px;border:2px solid var(--primary);border-radius:12px;padding:20px;position:relative">
            <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);
                background:var(--primary);color:#fff;font-size:10px;font-weight:700;
                padding:3px 12px;border-radius:99px;white-space:nowrap;letter-spacing:.04em">
                NAJLEPSZY WYBÓR
            </div>
            <div style="font-weight:700;font-size:15px;margin-bottom:4px">⭐ Premium</div>
            <div style="margin-bottom:16px">
                <span style="font-size:24px;font-weight:800">12,99 zł</span>
                <span style="font-size:13px;color:var(--text-muted)">&thinsp;/&thinsp;mies.</span>
            </div>
            ${feat('Zarządzanie lodówką i strefami')}
            ${feat('Lista zakupów')}
            ${feat('Skanowanie paragonów')}
            ${feat('Własne przepisy (bez limitu)')}
            ${feat('10 odświeżeń przepisów / dzień')}
            ${feat('Wyszukiwanie produktów w lodówce')}
            ${feat('Aktualizacje listy zakupów na żywo')}
            ${feat('Smart sortowanie listy (alejki)')}
            ${feat('Statystyki i Zero-Waste Score')}
            ${feat('Licznik uratowanej kasy (zł)')}
            ${feat('Aplikacja mobilna Android/iOS', true)}
            <button class="btn btn--primary btn--full" id="btn-buy-premium" style="margin-top:20px">Kup Premium →</button>
            <div id="premium-buy-msg" style="display:none;margin-top:12px;padding:12px;
                background:#F0FFF4;border-radius:8px;font-size:12px;color:var(--primary);text-align:center;line-height:1.5">
                🚀 <strong>Integracja płatności w przygotowaniu!</strong><br>
                Wkrótce będzie można kupić Premium bezpośrednio w aplikacji.
            </div>
        </div>

    </div>`;
}

function renderPremiumContent() {
    return `
    <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:#ECFDF5;border:1px solid var(--primary);
            border-radius:99px;padding:4px 16px;font-size:13px;color:var(--primary)">
            ⭐ Twój plan: <strong>Premium</strong>
        </div>
    </div>

    <div style="border:2px solid var(--primary);border-radius:12px;padding:20px;margin-bottom:16px">
        <div style="font-size:14px;font-weight:700;margin-bottom:12px">Masz dostęp do:</div>
        ${feat('Zarządzanie lodówką i strefami')}
        ${feat('Lista zakupów')}
        ${feat('Skanowanie paragonów')}
        ${feat('Własne przepisy (bez limitu)')}
        ${feat('10 odświeżeń przepisów / dzień')}
        ${feat('Wyszukiwanie produktów w lodówce')}
        ${feat('Aktualizacje listy zakupów na żywo')}
        ${feat('Smart sortowanie listy (alejki)')}
        ${feat('Statystyki i Zero-Waste Score')}
        ${feat('Licznik uratowanej kasy (zł)')}
        ${feat('Aplikacja mobilna Android/iOS', true)}
    </div>
    <p style="font-size:12px;color:var(--text-muted);text-align:center;margin:0">
        Zarządzanie subskrypcją będzie dostępne wkrótce.
    </p>`;
}

function feat(label, comingSoon = false) {
    const tag = comingSoon
        ? ` <span style="font-size:10px;background:#FEF3C7;color:#B45309;
            padding:1px 7px;border-radius:99px;font-weight:600;margin-left:4px">wkrótce</span>`
        : '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px">
        <span style="width:16px;text-align:center;color:var(--success);flex-shrink:0">✓</span>
        <span>${escHtml(label)}${tag}</span>
    </div>`;
}

function featNo(label, comingSoon = false) {
    const tag = comingSoon
        ? ` <span style="font-size:10px;background:#F3F4F6;color:#9CA3AF;
            padding:1px 7px;border-radius:99px;font-weight:600;margin-left:4px">wkrótce</span>`
        : '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;color:#9CA3AF">
        <span style="width:16px;text-align:center;flex-shrink:0">✕</span>
        <span>${escHtml(label)}${tag}</span>
    </div>`;
}

function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
