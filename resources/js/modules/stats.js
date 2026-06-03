import { api } from './api.js';
import { openPremiumModal } from './premium.js';

export async function renderStats(container, isPremium = false) {
    if (!isPremium) {
        renderPaywall(container);
        return;
    }

    container.innerHTML = `<div style="padding:48px;text-align:center"><div class="spinner" style="margin:auto"></div></div>`;

    let data;
    try {
        data = await api.stats.get();
    } catch (e) {
        container.innerHTML = `<div class="alert alert--error" style="margin:24px">${escHtml(e.message || 'Błąd ładowania statystyk')}</div>`;
        return;
    }

    container.innerHTML = `
    <div style="max-width:820px;margin:0 auto;padding:24px 16px;display:flex;flex-direction:column;gap:24px">

        ${renderScoreSection(data)}
        ${renderSummaryCards(data)}
        ${renderMonthlyChart(data.monthly)}
        ${renderBadges(data.badges)}

    </div>`;
}

// ── Score ────────────────────────────────────────────────

function renderScoreSection(data) {
    const { score, grade, grade_color, streak_days } = data;
    const circumference = 2 * Math.PI * 50; // r=50
    const offset = circumference - (score / 100) * circumference;

    const streakLabel = streak_days === 0 ? 'start' : `${streak_days} ${dayWord(streak_days)}`;

    return `
    <div class="card">
        <div class="card__body" style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:32px;padding:32px 24px">

            <div style="text-align:center">
                <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px">
                    Zero-Waste Score
                </div>
                <svg viewBox="0 0 120 120" style="width:160px;height:160px">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="10"/>
                    <circle cx="60" cy="60" r="50" fill="none"
                        stroke="${escHtml(grade_color)}" stroke-width="10"
                        stroke-dasharray="${circumference.toFixed(2)}"
                        stroke-dashoffset="${offset.toFixed(2)}"
                        transform="rotate(-90 60 60)"
                        stroke-linecap="round"
                        style="transition:stroke-dashoffset .6s ease"/>
                    <text x="60" y="56" text-anchor="middle" font-size="26" font-weight="800" fill="var(--text)" font-family="Inter,sans-serif">${score}%</text>
                    <text x="60" y="76" text-anchor="middle" font-size="18" font-weight="700" fill="${escHtml(grade_color)}" font-family="Inter,sans-serif">${escHtml(grade)}</text>
                </svg>
                <div style="font-size:13px;color:var(--text-muted);margin-top:8px">${gradeLabel(grade)}</div>
            </div>

            <div style="display:flex;flex-direction:column;gap:16px;min-width:200px">
                <div>
                    <div style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Seria bez marnowania</div>
                    <div style="font-size:28px;font-weight:800;margin-top:4px">🔥 ${streakLabel}</div>
                </div>
                <div style="width:100%;height:1px;background:var(--border)"></div>
                <div style="font-size:13px;color:var(--text-muted);line-height:1.6">
                    ${scoreDescription(score)}
                </div>
            </div>

        </div>
    </div>`;
}

// ── Summary cards ────────────────────────────────────────

function renderSummaryCards({ total_consumed, total_wasted, total_shared = 0, total_active, money_saved = 0, money_wasted = 0 }) {
    const hasMoneyData = money_saved > 0 || money_wasted > 0;
    return `
    <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px">
            ${statCard('✅', 'Zużyte', total_consumed, '#ECFDF5', 'var(--primary)')}
            ${statCard('🤝', 'Oddane', total_shared, '#F0FDF4', '#0D9488')}
            ${statCard('🗑', 'Zmarnowane', total_wasted, '#FFF1F0', 'var(--danger)')}
            ${statCard('🧊', 'W lodówce', total_active, '#EFF6FF', '#3B82F6')}
        </div>
        ${hasMoneyData ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
            ${moneyCard('💰', 'Uratowana kasa', money_saved, '#ECFDF5', 'var(--primary)')}
            ${moneyCard('💸', 'Stracone', money_wasted, '#FFF1F0', 'var(--danger)')}
        </div>` : ''}
    </div>`;
}

function moneyCard(icon, label, value, bg, color) {
    const formatted = value.toFixed(2).replace('.', ',') + ' zł';
    return `
    <div class="card" style="background:${bg}">
        <div class="card__body" style="text-align:center;padding:20px 16px">
            <div style="font-size:28px;margin-bottom:8px">${icon}</div>
            <div style="font-size:26px;font-weight:800;color:${color};line-height:1">${escHtml(formatted)}</div>
            <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:6px">${label}</div>
        </div>
    </div>`;
}

function statCard(icon, label, value, bg, color) {
    return `
    <div class="card" style="background:${bg}">
        <div class="card__body" style="text-align:center;padding:20px 16px">
            <div style="font-size:28px;margin-bottom:8px">${icon}</div>
            <div style="font-size:32px;font-weight:800;color:${color};line-height:1">${value}</div>
            <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:6px">${label}</div>
        </div>
    </div>`;
}

// ── Monthly chart ────────────────────────────────────────

function renderMonthlyChart(monthly) {
    const maxVal = Math.max(1, ...monthly.map(m => m.consumed + m.wasted));

    const bars = monthly.map(m => {
        const shared    = m.shared || 0;
        const consumedH = Math.round((m.consumed / maxVal) * 120);
        const sharedH   = Math.round((shared      / maxVal) * 120);
        const wastedH   = Math.round((m.wasted    / maxVal) * 120);
        const total     = m.consumed + shared + m.wasted;
        return `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:48px">
            <div style="display:flex;align-items:flex-end;gap:2px;height:120px">
                <div title="Zużyte: ${m.consumed}" style="
                    width:14px;height:${consumedH}px;
                    background:var(--primary);border-radius:4px 4px 0 0;
                    transition:height .4s ease;min-height:${m.consumed > 0 ? 3 : 0}px">
                </div>
                <div title="Oddane: ${shared}" style="
                    width:14px;height:${sharedH}px;
                    background:#0D9488;border-radius:4px 4px 0 0;
                    transition:height .4s ease;min-height:${shared > 0 ? 3 : 0}px">
                </div>
                <div title="Zmarnowane: ${m.wasted}" style="
                    width:14px;height:${wastedH}px;
                    background:var(--danger);border-radius:4px 4px 0 0;
                    transition:height .4s ease;min-height:${m.wasted > 0 ? 3 : 0}px">
                </div>
            </div>
            <div style="font-size:11px;color:var(--text-muted);font-weight:500">${escHtml(m.label)}</div>
            <div style="font-size:10px;color:var(--text-muted)">${total > 0 ? total : '—'}</div>
        </div>`;
    }).join('');

    return `
    <div class="card">
        <div class="card__header"><span class="card__title">📊 Aktywność (ostatnie 6 miesięcy)</span></div>
        <div class="card__body">
            <div style="display:flex;align-items:flex-end;gap:8px;padding:8px 0 0;overflow-x:auto">
                ${bars}
            </div>
            <div style="display:flex;gap:16px;margin-top:16px;font-size:12px;color:var(--text-muted);flex-wrap:wrap">
                <span style="display:flex;align-items:center;gap:5px">
                    <span style="width:12px;height:12px;background:var(--primary);border-radius:2px;display:inline-block"></span>
                    Zużyte
                </span>
                <span style="display:flex;align-items:center;gap:5px">
                    <span style="width:12px;height:12px;background:#0D9488;border-radius:2px;display:inline-block"></span>
                    Oddane
                </span>
                <span style="display:flex;align-items:center;gap:5px">
                    <span style="width:12px;height:12px;background:var(--danger);border-radius:2px;display:inline-block"></span>
                    Zmarnowane
                </span>
            </div>
        </div>
    </div>`;
}

// ── Badges ───────────────────────────────────────────────

function renderBadges(badges) {
    const items = badges.map(b => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 12px;
        border-radius:12px;border:2px solid ${b.earned ? 'var(--primary)' : 'var(--border)'};
        background:${b.earned ? '#ECFDF5' : 'var(--bg)'};text-align:center;
        opacity:${b.earned ? '1' : '0.5'};transition:opacity .2s">
        <span style="font-size:32px">${b.icon}</span>
        <span style="font-size:13px;font-weight:700;color:${b.earned ? 'var(--text)' : 'var(--text-muted)'}">${escHtml(b.name)}</span>
        <span style="font-size:11px;color:var(--text-muted);line-height:1.4">${escHtml(b.desc)}</span>
        ${b.earned ? `<span style="font-size:10px;font-weight:700;color:var(--primary);background:#D1FAE5;padding:2px 8px;border-radius:99px">Zdobyte ✓</span>` : ''}
    </div>`).join('');

    return `
    <div class="card">
        <div class="card__header"><span class="card__title">🏅 Odznaki</span></div>
        <div class="card__body">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px">
                ${items}
            </div>
        </div>
    </div>`;
}

// ── Paywall ──────────────────────────────────────────────

function renderPaywall(container) {
    container.innerHTML = `
    <div style="position:relative;max-width:820px;margin:0 auto;padding:24px 16px">

        <!-- Rozmyte tło — fałszywy podgląd -->
        <div style="filter:blur(6px);pointer-events:none;user-select:none;display:flex;flex-direction:column;gap:24px" aria-hidden="true">

            <div class="card">
                <div class="card__body" style="display:flex;align-items:center;justify-content:center;gap:32px;flex-wrap:wrap;padding:32px 24px">
                    <div style="text-align:center">
                        <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:16px">Zero-Waste Score</div>
                        <svg viewBox="0 0 120 120" style="width:160px;height:160px">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="10"/>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--primary)" stroke-width="10"
                                stroke-dasharray="314" stroke-dashoffset="47"
                                transform="rotate(-90 60 60)" stroke-linecap="round"/>
                            <text x="60" y="56" text-anchor="middle" font-size="26" font-weight="800" fill="var(--text)" font-family="Inter,sans-serif">85%</text>
                            <text x="60" y="76" text-anchor="middle" font-size="18" font-weight="700" fill="var(--primary)" font-family="Inter,sans-serif">B</text>
                        </svg>
                        <div style="font-size:13px;color:var(--text-muted);margin-top:8px">Bardzo dobrze!</div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:16px;min-width:200px">
                        <div>
                            <div style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase">Seria bez marnowania</div>
                            <div style="font-size:28px;font-weight:800;margin-top:4px">🔥 14 dni</div>
                        </div>
                    </div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
                <div class="card" style="background:#ECFDF5"><div class="card__body" style="text-align:center;padding:20px"><div style="font-size:28px">✅</div><div style="font-size:32px;font-weight:800;color:var(--primary)">42</div><div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-top:6px">Zużyte</div></div></div>
                <div class="card" style="background:#FFF1F0"><div class="card__body" style="text-align:center;padding:20px"><div style="font-size:28px">🗑</div><div style="font-size:32px;font-weight:800;color:var(--danger)">7</div><div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-top:6px">Zmarnowane</div></div></div>
                <div class="card" style="background:#EFF6FF"><div class="card__body" style="text-align:center;padding:20px"><div style="font-size:28px">🧊</div><div style="font-size:32px;font-weight:800;color:#3B82F6">15</div><div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-top:6px">W lodówce</div></div></div>
            </div>

            <div class="card">
                <div class="card__header"><span class="card__title">📊 Aktywność (ostatnie 6 miesięcy)</span></div>
                <div class="card__body" style="height:180px;background:repeating-linear-gradient(90deg,var(--bg) 0,var(--bg) 40px,var(--border) 40px,var(--border) 41px)"></div>
            </div>

        </div>

        <!-- Overlay z kłódką -->
        <div style="
            position:absolute;inset:0;
            display:flex;align-items:center;justify-content:center;
            background:rgba(248,250,249,.55);
            border-radius:12px;
            padding:16px">
            <div style="
                background:#fff;border-radius:20px;
                box-shadow:0 8px 40px rgba(0,0,0,.18);
                padding:40px 36px;max-width:380px;width:100%;text-align:center">
                <div style="font-size:52px;margin-bottom:16px">🔒</div>
                <div style="font-size:20px;font-weight:800;margin-bottom:8px">Funkcja Premium</div>
                <p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin-bottom:24px">
                    Statystyki i Zero-Waste Score są dostępne w planie Premium.<br>
                    Śledź swoje nawyki, zdobywaj odznaki i ogranicz marnowanie jedzenia.
                </p>
                <ul style="text-align:left;font-size:13px;color:var(--text-muted);margin-bottom:28px;line-height:2;list-style:none;padding:0">
                    <li>✅ Zero-Waste Score z oceną A–F</li>
                    <li>✅ Wykres aktywności (6 miesięcy)</li>
                    <li>✅ Seria dni bez marnowania</li>
                    <li>✅ 13 odznak do zdobycia</li>
                    <li>✅ 10 odświeżeń przepisów dziennie</li>
                </ul>
                <button class="btn btn--full" id="btn-paywall-premium" style="font-size:15px;padding:14px;background:#F59E0B;color:#fff;border:none;font-weight:700">
                    ⭐ Przejdź na Premium — 12,99 zł/mies.
                </button>
                <p style="font-size:11px;color:var(--text-muted);margin-top:12px">Bez zobowiązań. Anuluj kiedy chcesz.</p>
            </div>
        </div>

    </div>`;

    document.getElementById('btn-paywall-premium')
        ?.addEventListener('click', () => openPremiumModal(false));
}

// ── Helpers ──────────────────────────────────────────────

function gradeLabel(grade) {
    return {
        A: 'Doskonale! Prawie nic nie marnujesz.',
        B: 'Bardzo dobrze! Niewiele się marnuje.',
        C: 'Nieźle. Jest jeszcze pole do poprawy.',
        D: 'Sporo marnowania — czas działać!',
        F: 'Bardzo dużo marnowania. Zacznij śledzić!',
    }[grade] ?? '';
}

function scoreDescription(score) {
    if (score === 100) return 'Jeszcze brak danych lub <strong>idealny wynik</strong>! Żadnego marnowania.';
    return `Na każde 100 produktów <strong>${100 - score} ląduje w koszu</strong>. Produkty zjedzone i oddane sąsiadom liczą się tak samo — dąż do oceny A!`;
}

function dayWord(n) {
    if (n === 1) return 'dzień';
    if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) return 'dni';
    return 'dni';
}

function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
