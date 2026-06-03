import { api } from './api.js';
import { openPremiumModal } from './premium.js';

const PAGE_SIZE = 9;
let allRecipes   = [];
let visibleCount = PAGE_SIZE;

export async function renderRecipes(container) {
    container.innerHTML = loadingHTML();

    try {
        const data = await api.recipes.suggest();
        allRecipes   = data.recipes || [];
        visibleCount = PAGE_SIZE;
        buildUI(container, allRecipes, data.ingredients_count, {
            quotaExceeded:  !!data.quota_exceeded,
            dailyLimit:     !!data.daily_limit,
            refreshesUsed:  data.refreshes_used  ?? 0,
            refreshesLimit: data.refreshes_limit ?? 1,
            isPremium:      !!data.is_premium,
        });
    } catch (e) {
        if (e.message === 'not_configured') { renderNotConfigured(container); return; }
        container.innerHTML = `<div class="alert alert--error" style="margin:24px">
            ${escHtml(e.message || 'Błąd ładowania przepisów')}</div>`;
    }
}

// ── UI build ──────────────────────────────────────────────

function buildUI(container, recipes, ingredientsCount, limits = {}) {
    const { quotaExceeded, dailyLimit, refreshesUsed, refreshesLimit, isPremium } = limits;
    const limitReached  = dailyLimit || quotaExceeded;
    const remaining     = Math.max(0, refreshesLimit - refreshesUsed);
    const showCounter   = isPremium || refreshesLimit > 1;

    const refreshBtnHtml = limitReached
        ? `<button class="btn btn--outline btn--sm" disabled title="Limit odświeżeń wyczerpany">🔄 Odśwież</button>`
        : `<button class="btn btn--outline btn--sm" id="btn-recipes-refresh">🔄 Odśwież</button>`;

    const counterHtml = showCounter && !limitReached
        ? `<span style="font-size:11px;color:var(--text-muted);align-self:center">${refreshesUsed}/${refreshesLimit} dzisiaj</span>`
        : '';

    let bannerHtml = '';
    if (quotaExceeded) {
        bannerHtml = `<div class="alert alert--warning" style="margin-bottom:16px;font-size:13px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <span>⏳ <strong>Dzienny limit sugestii wyczerpany</strong> — nowe propozycje pojawią się o północy. Widoczne są Twoje własne przepisy.</span>
            <button class="btn btn--sm" id="btn-upgrade-premium" style="background:#F59E0B;color:#fff;border:none;white-space:nowrap;flex-shrink:0;font-weight:600">⭐ Przejdź na Premium</button>
        </div>`;
    } else if (dailyLimit && !isPremium) {
        bannerHtml = `<div class="alert alert--warning" style="margin-bottom:16px;font-size:13px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <span>🔒 Wykorzystano dzienny limit odświeżeń. Widoczne są Twoje własne przepisy.</span>
            <button class="btn btn--sm" id="btn-upgrade-premium" style="background:#F59E0B;color:#fff;border:none;white-space:nowrap;flex-shrink:0;font-weight:600">⭐ Przejdź na Premium</button>
        </div>`;
    } else if (dailyLimit && isPremium) {
        bannerHtml = `<div class="alert alert--warning" style="margin-bottom:16px;font-size:13px">
            🔒 Wykorzystano limit 10 odświeżeń na dziś. Widoczne są Twoje własne przepisy.
        </div>`;
    }

    container.innerHTML = `
    <div id="recipes-wrap" style="max-width:900px;margin:0 auto;padding:24px 16px">
        <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
            <div>
                <p style="color:var(--text-muted);font-size:13px;margin-top:4px">
                    Szukam przepisów na podstawie
                    <strong>${ingredientsCount}</strong> produktów z Twojej lodówki
                </p>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                ${counterHtml}
                <button class="btn btn--primary btn--sm" id="btn-add-recipe">+ Dodaj przepis</button>
                ${refreshBtnHtml}
            </div>
        </div>
        ${bannerHtml}
        <div id="recipes-grid" class="recipe-grid"></div>
    </div>`;

    renderGrid(recipes);

    document.getElementById('btn-recipes-refresh')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-recipes-refresh');
        btn.disabled = true;
        btn.textContent = '…';
        try {
            const fresh = await api.recipes.suggest();
            allRecipes   = fresh.recipes || [];
            visibleCount = PAGE_SIZE;
            buildUI(container, allRecipes, fresh.ingredients_count, {
                quotaExceeded:  !!fresh.quota_exceeded,
                dailyLimit:     !!fresh.daily_limit,
                refreshesUsed:  fresh.refreshes_used  ?? 0,
                refreshesLimit: fresh.refreshes_limit ?? 1,
                isPremium:      !!fresh.is_premium,
            });
        } catch { /* ignore */ } finally {
            const b = document.getElementById('btn-recipes-refresh');
            if (b) { b.disabled = false; b.textContent = '🔄 Odśwież'; }
        }
    });

    document.getElementById('btn-upgrade-premium')?.addEventListener('click', () => {
        openPremiumModal(isPremium);
    });

    document.getElementById('btn-add-recipe')?.addEventListener('click', () => {
        openRecipeFormModal(null);
    });
}

function renderGrid(recipes) {
    const grid = document.getElementById('recipes-grid');
    if (!grid) return;

    if (!recipes || recipes.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <div class="empty-state__icon">🍽️</div>
            <div class="empty-state__title">Brak pasujących przepisów</div>
            <div class="empty-state__text">Dodaj więcej produktów do lodówki, aby zobaczyć sugestie.</div>
        </div>`;
        return;
    }

    const page    = recipes.slice(0, visibleCount);
    const hasMore = visibleCount < recipes.length;

    grid.innerHTML = page.map(r => recipeCard(r)).join('') + (hasMore
        ? `<div style="grid-column:1/-1;text-align:center;margin-top:8px">
               <button class="btn btn--outline" id="btn-load-more">
                   Pokaż więcej przepisów (${recipes.length - visibleCount} pozostało)
               </button>
           </div>`
        : '');

    grid.querySelectorAll('.recipe-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.recipe-card__edit-btn')) return;
            const recipe = allRecipes.find(r => String(r.id) === card.dataset.id && r.source === card.dataset.source);
            openRecipeModal(parseInt(card.dataset.id), card.dataset.title, card.dataset.source, recipe?.missedIngredients || []);
        });
        card.querySelector('.recipe-card__edit-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const recipe = allRecipes.find(r => String(r.id) === card.dataset.id && r.source === card.dataset.source);
            if (recipe) openRecipeFormModal(recipe);
        });
    });

    document.getElementById('btn-load-more')?.addEventListener('click', () => {
        visibleCount += PAGE_SIZE;
        renderGrid(allRecipes);
    });
}

function recipeCard(r) {
    const pct        = r.match_pct ?? 0;
    const isCustom   = r.source === 'custom';
    const colorClass = pct >= 80 ? 'recipe-card--great'
                     : pct >= 50 ? 'recipe-card--ok'
                     :             'recipe-card--low';

    const missing = (r.missedIngredients || []).slice(0, 4);
    const missingHTML = missing.length
        ? `<div class="recipe-card__missing">
               <span style="font-size:11px;color:var(--text-muted)">Brakuje: </span>
               ${missing.map(i => `<span class="recipe-card__miss-tag">${escHtml(i.name)}</span>`).join('')}
               ${(r.missedIngredientCount > 4) ? `<span class="recipe-card__miss-tag">+${r.missedIngredientCount - 4}</span>` : ''}
           </div>`
        : `<div class="recipe-card__missing" style="color:var(--success);font-size:12px;font-weight:600">
               ✅ Masz wszystkie składniki!
           </div>`;

    const customBadge = isCustom
        ? `<div style="position:absolute;top:8px;left:8px;background:var(--primary);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;z-index:1">Twój przepis</div>`
        : '';

    const editBtn = isCustom
        ? `<button class="recipe-card__edit-btn btn btn--ghost btn--sm"
               style="position:absolute;top:6px;right:6px;z-index:2;padding:2px 8px;font-size:11px"
               title="Edytuj przepis">✏️</button>`
        : '';

    return `
    <div class="recipe-card ${colorClass}" data-id="${r.id}" data-title="${escHtml(r.title)}" data-source="${escHtml(r.source || 'spoonacular')}" style="position:relative">
        ${editBtn}
        <div class="recipe-card__img-wrap" style="position:relative">
            ${customBadge}
            ${r.image ? `<img src="${escHtml(r.image)}" alt="" loading="lazy">` : '<div class="recipe-card__img-placeholder">🍳</div>'}
            <div class="recipe-card__badge">${pct}%</div>
        </div>
        <div class="recipe-card__body">
            <h3 class="recipe-card__title">${escHtml(r.title)}</h3>
            <div class="recipe-card__meta">
                <span>✅ ${r.usedIngredientCount} składniki</span>
                ${r.missedIngredientCount > 0 ? `<span>❌ ${r.missedIngredientCount} brakuje</span>` : ''}
            </div>
            ${missingHTML}
        </div>
    </div>`;
}

// ── Recipe detail modal ───────────────────────────────────

async function openRecipeModal(id, title, source, missedIngredients) {
    if (!document.getElementById('recipe-modal-backdrop')) {
        document.body.insertAdjacentHTML('beforeend', modalShell(title));
        document.getElementById('recipe-modal-close').addEventListener('click', closeRecipeModal);
        document.getElementById('recipe-modal-backdrop').addEventListener('click', (e) => {
            if (e.target.id === 'recipe-modal-backdrop') closeRecipeModal();
        });
    }
    document.getElementById('recipe-modal-backdrop').classList.add('is-open');
    document.getElementById('recipe-modal-body').innerHTML = `
        <div style="text-align:center;padding:40px">
            <div class="spinner" style="margin:0 auto"></div>
        </div>`;

    try {
        const recipe = source === 'custom'
            ? await api.recipes.customDetail(id)
            : await api.recipes.detail(id);
        renderRecipeDetail(recipe, missedIngredients);
    } catch (e) {
        document.getElementById('recipe-modal-body').innerHTML =
            `<div class="alert alert--error">${escHtml(e.message)}</div>`;
    }
}

function closeRecipeModal() {
    document.getElementById('recipe-modal-backdrop')?.remove();
}

function modalShell(title) {
    return `
    <div class="modal-backdrop" id="recipe-modal-backdrop">
        <div class="modal" style="max-width:680px;max-height:90vh;display:flex;flex-direction:column">
            <div class="modal__header">
                <h3 id="recipe-modal-title" style="font-size:15px;line-height:1.3">${escHtml(title)}</h3>
                <button class="btn btn--ghost btn--sm" id="recipe-modal-close">✕</button>
            </div>
            <div class="modal__body" id="recipe-modal-body" style="overflow-y:auto;flex:1"></div>
        </div>
    </div>`;
}

function renderRecipeDetail(r, missedIngredients) {
    document.getElementById('recipe-modal-title').textContent = r.title;

    const minutes   = r.readyInMinutes ? `⏱ ${r.readyInMinutes} min` : '';
    const servings  = r.servings ? `👥 ${r.servings} porcji` : '';
    const sourceBtn = r.sourceUrl
        ? `<a href="${escHtml(r.sourceUrl)}" target="_blank" rel="noopener"
               class="btn btn--outline btn--sm">🔗 Pełny przepis</a>`
        : '';

    const steps = r.analyzedInstructions?.[0]?.steps ?? [];
    const stepsHTML = steps.length
        ? `<h4 style="margin:20px 0 10px;font-size:14px">Sposób przyrządzenia</h4>
           <ol class="recipe-steps">
               ${steps.map(s => `<li>${escHtml(s.step)}</li>`).join('')}
           </ol>`
        : r.instructions
            ? `<h4 style="margin:20px 0 10px;font-size:14px">Przepis</h4>
               <div style="font-size:13px;line-height:1.7;color:var(--text);white-space:pre-wrap">${escHtml(r.instructions)}</div>`
            : '';

    const ingList  = r.extendedIngredients || [];
    const ingHTML  = ingList.length
        ? `<h4 style="margin:0 0 10px;font-size:14px">Składniki</h4>
           <ul class="recipe-ingredients">
               ${ingList.map(i => `<li>
                   <span class="recipe-ing__amount">${fmtAmount(i.amount, i.unit)}</span>
                   ${escHtml(i.name)}
               </li>`).join('')}
           </ul>`
        : '';

    document.getElementById('recipe-modal-body').innerHTML = `
        ${r.image ? `<img src="${escHtml(r.image)}" alt="" style="width:100%;height:200px;object-fit:cover;border-radius:8px;margin-bottom:16px">` : ''}
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
            ${minutes ? `<span style="font-size:13px;color:var(--text-muted)">${minutes}</span>` : ''}
            ${servings ? `<span style="font-size:13px;color:var(--text-muted)">${servings}</span>` : ''}
            ${sourceBtn}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div>${ingHTML}</div>
            <div>${stepsHTML}</div>
        </div>
        <div id="recipe-add-to-list-wrap" style="margin-top:20px"></div>`;

    // Brakujące składniki z karty — dodaj do listy zakupów
    const allIngredients = ingList.map(i => ({ name: i.name, amount: i.amount, unit: i.unit }));
    renderAddToShoppingBtn(missedIngredients, allIngredients);
}

function renderAddToShoppingBtn(missedIngredients, allIngredients) {
    const wrap = document.getElementById('recipe-add-to-list-wrap');
    if (!wrap) return;

    const hasMissed = missedIngredients && missedIngredients.length > 0;
    const hasAll    = allIngredients && allIngredients.length > 0;

    if (!hasMissed && !hasAll) return;

    const names = hasMissed ? missedIngredients.map(i => escHtml(i.name)).join(', ') : '';

    wrap.innerHTML = `
        <div style="border-top:1px solid var(--border);padding-top:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
            ${hasMissed ? `
            <div style="flex:1;min-width:200px">
                <span style="font-size:13px;color:var(--text-muted)">Brakuje: </span>
                <strong style="font-size:13px">${names}</strong>
            </div>
            <button class="btn btn--warning btn--sm" id="btn-add-missed-shopping">🛒 Dodaj brakujące</button>
            ` : ''}
            ${hasAll ? `<button class="btn btn--outline btn--sm" id="btn-add-all-shopping">🛒 Dodaj wszystkie składniki</button>` : ''}
        </div>`;

    document.getElementById('btn-add-missed-shopping')?.addEventListener('click', async () => {
        await addIngredientsToList(missedIngredients, 'btn-add-missed-shopping');
    });
    document.getElementById('btn-add-all-shopping')?.addEventListener('click', async () => {
        await addIngredientsToList(allIngredients, 'btn-add-all-shopping');
    });
}

async function addIngredientsToList(ingredients, btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = '…';
    try {
        await Promise.all(ingredients.map(i => api.shopping.add({
            name:     i.name,
            quantity: i.amount  || null,
            unit:     i.unit    || 'szt.',
        })));
        btn.textContent = '✅ Dodano!';
        setTimeout(() => { btn.disabled = false; btn.textContent = '🛒 Dodaj'; }, 2000);
    } catch {
        btn.disabled = false;
        btn.textContent = '❌ Błąd';
    }
}

// ── Recipe form modal (create / edit) ────────────────────

function openRecipeFormModal(existingRecipe) {
    closeRecipeFormModal();

    const isEdit = !!existingRecipe;
    const r = existingRecipe || {};

    const ingredientsHtml = (r.ingredients || [{ name: '', amount: '', unit: '' }]).map((ing, i) =>
        ingredientRowHtml(i, ing.name, ing.amount, ing.unit)
    ).join('');

    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop is-open" id="recipe-form-backdrop">
        <div class="modal" style="max-width:600px;max-height:92vh;display:flex;flex-direction:column">
            <div class="modal__header">
                <h3 style="font-size:15px">${isEdit ? 'Edytuj przepis' : 'Nowy przepis'}</h3>
                <button class="btn btn--ghost btn--sm" id="recipe-form-close">✕</button>
            </div>
            <div class="modal__body" id="recipe-form-body" style="overflow-y:auto;flex:1;padding:20px">
                <div id="recipe-form-err" class="alert alert--error" style="display:none;margin-bottom:12px"></div>
                <div class="form-group" style="margin-bottom:12px">
                    <label class="form-label">Nazwa przepisu *</label>
                    <input type="text" id="rf-title" class="form-input" value="${escHtml(r.title || '')}" placeholder="np. Spaghetti carbonara">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
                    <div class="form-group">
                        <label class="form-label">Czas przygotowania (min)</label>
                        <input type="number" id="rf-time" class="form-input" value="${r.readyInMinutes || ''}" min="1" max="1440" placeholder="30">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Liczba porcji</label>
                        <input type="number" id="rf-servings" class="form-input" value="${r.servings || ''}" min="1" max="100" placeholder="4">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:16px">
                    <label class="form-label">Składniki</label>
                    <div id="rf-ingredients-list">${ingredientsHtml}</div>
                    <button type="button" class="btn btn--outline btn--sm" id="rf-add-ingredient" style="margin-top:6px">+ Dodaj składnik</button>
                </div>
                <div class="form-group" style="margin-bottom:16px">
                    <label class="form-label">Sposób przygotowania</label>
                    <textarea id="rf-instructions" class="form-input" rows="6"
                        placeholder="Opisz kroki przygotowania…" style="resize:vertical">${escHtml(r.instructions || '')}</textarea>
                </div>
            </div>
            <div class="modal__footer" style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
                ${isEdit ? `<button class="btn btn--danger btn--sm" id="rf-delete">Usuń przepis</button>` : '<div></div>'}
                <div style="display:flex;gap:8px">
                    <button class="btn btn--ghost btn--sm" id="recipe-form-cancel">Anuluj</button>
                    <button class="btn btn--primary" id="rf-save">${isEdit ? 'Zapisz zmiany' : 'Utwórz przepis'}</button>
                </div>
            </div>
        </div>
    </div>`);

    const existingId = r.id;

    document.getElementById('recipe-form-close').addEventListener('click', closeRecipeFormModal);
    document.getElementById('recipe-form-cancel').addEventListener('click', closeRecipeFormModal);
    document.getElementById('recipe-form-backdrop').addEventListener('click', (e) => {
        if (e.target.id === 'recipe-form-backdrop') closeRecipeFormModal();
    });

    document.getElementById('rf-add-ingredient').addEventListener('click', () => {
        const list = document.getElementById('rf-ingredients-list');
        const idx  = list.querySelectorAll('.rf-ing-row').length;
        list.insertAdjacentHTML('beforeend', ingredientRowHtml(idx, '', '', ''));
        bindIngredientRemove();
    });

    bindIngredientRemove();

    document.getElementById('rf-save').addEventListener('click', async () => {
        await saveRecipe(isEdit ? existingId : null);
    });

    if (isEdit) {
        document.getElementById('rf-delete')?.addEventListener('click', async () => {
            if (!confirm('Usunąć przepis?')) return;
            try {
                await api.recipes.customDelete(existingId);
                closeRecipeFormModal();
                await refreshRecipeList();
            } catch (e) {
                alert('Błąd: ' + e.message);
            }
        });
    }
}

function ingredientRowHtml(idx, name, amount, unit) {
    return `
    <div class="rf-ing-row" style="display:flex;gap:6px;align-items:center;margin-bottom:6px" data-idx="${idx}">
        <input type="text" class="form-input rf-ing-name" value="${escHtml(name)}"
            placeholder="Składnik" style="flex:3;padding:6px 10px">
        <input type="number" class="form-input rf-ing-amount" value="${amount || ''}"
            placeholder="Ilość" min="0" step="0.01" style="flex:1;padding:6px 10px">
        <input type="text" class="form-input rf-ing-unit" value="${escHtml(unit || '')}"
            placeholder="j.m." style="flex:1.5;padding:6px 10px">
        <button type="button" class="btn btn--ghost btn--sm rf-ing-remove" style="padding:4px 8px;color:var(--danger)">✕</button>
    </div>`;
}

function bindIngredientRemove() {
    document.querySelectorAll('.rf-ing-remove').forEach(btn => {
        btn.onclick = () => {
            const list = document.getElementById('rf-ingredients-list');
            if (list.querySelectorAll('.rf-ing-row').length > 1) {
                btn.closest('.rf-ing-row').remove();
            }
        };
    });
}

async function saveRecipe(id) {
    const title        = document.getElementById('rf-title').value.trim();
    const instructions = document.getElementById('rf-instructions').value.trim();
    const time         = parseInt(document.getElementById('rf-time').value) || null;
    const servings     = parseInt(document.getElementById('rf-servings').value) || null;

    if (!title) {
        const err = document.getElementById('recipe-form-err');
        err.textContent = 'Podaj nazwę przepisu.';
        err.style.display = '';
        return;
    }

    const ingredients = [];
    document.querySelectorAll('#rf-ingredients-list .rf-ing-row').forEach(row => {
        const name = row.querySelector('.rf-ing-name').value.trim();
        if (!name) return;
        ingredients.push({
            name,
            amount: parseFloat(row.querySelector('.rf-ing-amount').value) || null,
            unit:   row.querySelector('.rf-ing-unit').value.trim() || null,
        });
    });

    const payload = { title, instructions: instructions || null, ready_in_minutes: time, servings, ingredients };

    const saveBtn = document.getElementById('rf-save');
    saveBtn.disabled = true;
    saveBtn.textContent = '…';

    try {
        if (id) {
            await api.recipes.customUpdate(id, payload);
        } else {
            await api.recipes.customCreate(payload);
        }
        closeRecipeFormModal();
        await refreshRecipeList();
    } catch (e) {
        const err = document.getElementById('recipe-form-err');
        err.textContent = e.message || 'Błąd zapisywania.';
        err.style.display = '';
        saveBtn.disabled = false;
        saveBtn.textContent = id ? 'Zapisz zmiany' : 'Utwórz przepis';
    }
}

async function refreshRecipeList() {
    try {
        const fresh = await api.recipes.suggest();
        allRecipes   = fresh.recipes || [];
        visibleCount = PAGE_SIZE;
        renderGrid(allRecipes);
    } catch { /* ignore */ }
}

function closeRecipeFormModal() {
    document.getElementById('recipe-form-backdrop')?.remove();
}

// ── Not configured ────────────────────────────────────────

function renderNotConfigured(container) {
    container.innerHTML = `
    <div style="max-width:520px;margin:60px auto;padding:0 16px;text-align:center">
        <div style="font-size:52px;margin-bottom:16px">🍳</div>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Silnik przepisów</h2>
        <p style="color:var(--text-muted);font-size:14px;margin-bottom:24px">
            Aby korzystać z sugestii przepisów, potrzebujesz bezpłatnego klucza API Spoonacular.
        </p>
        <div class="card" style="text-align:left">
            <div class="card__body">
                <ol style="font-size:13px;line-height:2;padding-left:20px;color:var(--text)">
                    <li>Zarejestruj się na <strong>spoonacular.com/food-api</strong></li>
                    <li>Skopiuj swój klucz API (darmowy plan: 150 req/dzień)</li>
                    <li>Dodaj do pliku <code style="background:var(--bg);padding:1px 6px;border-radius:4px">.env</code>:<br>
                        <code style="background:var(--bg);padding:4px 10px;border-radius:4px;display:inline-block;margin-top:4px">SPOONACULAR_KEY=twój_klucz</code>
                    </li>
                    <li>Uruchom: <code style="background:var(--bg);padding:4px 10px;border-radius:4px;display:inline-block;margin-top:4px">php artisan config:clear</code></li>
                </ol>
            </div>
        </div>
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────

function loadingHTML() {
    return `<div style="padding:60px;text-align:center;color:var(--text-muted)">
        <div class="spinner" style="margin:0 auto 16px;width:32px;height:32px;border-width:3px"></div>
        Szukam przepisów…
    </div>`;
}

function fmtAmount(amount, unit) {
    if (!amount) return unit || '';
    const n = amount % 1 === 0 ? amount : parseFloat(amount.toFixed(2));
    return `${n} ${unit || ''}`.trim();
}

function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}
