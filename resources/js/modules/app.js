import { getUser, logout } from './auth.js';
import { renderFridge } from './fridge.js';
import { renderFamily } from './family.js';
import { renderShopping, destroyShopping } from './shopping.js';
import { renderRecipes } from './recipes.js';
import { renderStats } from './stats.js';
import { renderSupport } from './support.js';
import { injectPremiumModal, openPremiumModal } from './premium.js';
import { api } from './api.js';

let currentPage = 'fridge';
let appIsPremium = false;

export async function renderApp() {
    const user = getUser();

    try {
        const family = await api.family.get();
        appIsPremium = !!family.is_premium;
    } catch { appIsPremium = false; }

    const premiumBadge = appIsPremium
        ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;
                color:#B45309;background:#FEF3C7;border-radius:99px;padding:4px 12px;
                margin-bottom:8px;justify-content:center">
                ⭐ Plan Premium
            </div>`
        : `<button class="btn btn--sm btn--full" id="btn-sidebar-premium"
                style="margin-bottom:8px;background:#F59E0B;border:none;
                color:#fff;font-size:12px;font-weight:600">
                ⭐ Przejdź na Premium
            </button>`;

    document.getElementById('app').innerHTML = `
    <div class="app">
        <aside class="sidebar" id="sidebar">
            <div class="sidebar__logo">
                <span>🧊 GetFridgely</span>
            </div>
            <nav class="sidebar__nav">
                <div class="nav-item is-active" data-page="fridge">
                    <span class="nav-item__icon">🧊</span>
                    <span>Lodówka</span>
                </div>
                <div class="nav-item" data-page="recipes">
                    <span class="nav-item__icon">🍳</span>
                    <span>Przepisy</span>
                </div>
                <div class="nav-item" data-page="shopping">
                    <span class="nav-item__icon">🛒</span>
                    <span>Lista zakupów</span>
                </div>
                <div class="nav-item" data-page="family">
                    <span class="nav-item__icon">👨‍👩‍👧</span>
                    <span>Rodzina</span>
                </div>
                <div class="nav-item" data-page="stats">
                    <span class="nav-item__icon">📊</span>
                    <span>Statystyki</span>
                </div>
                <div class="nav-item" data-page="support">
                    <span class="nav-item__icon">💬</span>
                    <span>Pomoc</span>
                </div>
            </nav>
            <div class="sidebar__footer">
                <div style="font-size:13px;color:#6B7280;margin-bottom:8px">
                    👤 ${user?.name || 'Użytkownik'}
                </div>
                ${premiumBadge}
                <button class="btn btn--outline btn--sm btn--full" id="btn-logout">Wyloguj</button>
            </div>
        </aside>

        <div class="main">
            <header class="topbar">
                <button class="topbar__hamburger" id="btn-hamburger">☰</button>
                <h1 class="topbar__title" id="page-title">Lodówka</h1>
            </header>
            <main class="page" id="page-content"></main>
        </div>
    </div>`;

    injectPremiumModal();
    bindAppEvents();
    await navigateTo('fridge');
}

function bindAppEvents() {
    document.getElementById('btn-logout')?.addEventListener('click', () => logout());

    document.getElementById('btn-sidebar-premium')?.addEventListener('click', () => {
        openPremiumModal(appIsPremium);
    });

    document.getElementById('btn-hamburger')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('is-open');
    });

    document.querySelectorAll('[data-page]').forEach(el => {
        el.addEventListener('click', async () => {
            await navigateTo(el.dataset.page);
        });
    });
}

async function navigateTo(page) {
    currentPage = page;
    const content = document.getElementById('page-content');
    const title   = document.getElementById('page-title');

    document.querySelectorAll('[data-page]').forEach(el => {
        el.classList.toggle('is-active', el.dataset.page === page);
    });

    document.getElementById('sidebar')?.classList.remove('is-open');

    if (page === 'fridge') {
        destroyShopping();
        title.textContent = 'Lodówka';
        await renderFridge(content, appIsPremium);
    } else if (page === 'recipes') {
        destroyShopping();
        title.textContent = 'Przepisy';
        await renderRecipes(content);
    } else if (page === 'shopping') {
        title.textContent = 'Lista zakupów';
        await renderShopping(content, appIsPremium);
    } else if (page === 'family') {
        destroyShopping();
        title.textContent = 'Rodzina';
        await renderFamily(content);
    } else if (page === 'stats') {
        destroyShopping();
        title.textContent = 'Statystyki';
        await renderStats(content, appIsPremium);
    } else if (page === 'support') {
        destroyShopping();
        title.textContent = 'Pomoc';
        renderSupport(content);
    }
}
