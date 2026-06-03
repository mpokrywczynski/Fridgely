import { api } from './api.js';
import { renderApp } from './app.js';

let currentUser = null;

export function getUser() { return currentUser; }
export function setUser(u) { currentUser = u; }

export function isLoggedIn() {
    return !!localStorage.getItem('fridge_token');
}

export async function tryAutoLogin() {
    if (!isLoggedIn()) return false;
    try {
        currentUser = await api.auth.me();
        return true;
    } catch {
        localStorage.removeItem('fridge_token');
        return false;
    }
}

export async function login(email, password) {
    const res = await api.auth.login({ email, password });
    localStorage.setItem('fridge_token', res.token);
    currentUser = res.user;
}

export async function register(name, email, password, passwordConfirmation) {
    const res = await api.auth.register({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
    });
    localStorage.setItem('fridge_token', res.token);
    currentUser = res.user;
}

export async function logout() {
    try { await api.auth.logout(); } catch {}
    localStorage.removeItem('fridge_token');
    currentUser = null;
    renderAuth();
}

export function renderAuth() {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('reset_token');
    const resetEmail = params.get('email');

    if (resetToken && resetEmail) {
        document.getElementById('app').innerHTML = buildResetHTML();
        bindResetEvents(resetToken, resetEmail);
        return;
    }

    document.getElementById('app').innerHTML = buildAuthHTML();
    bindAuthEvents();
}

function buildAuthHTML() {
    return `
    <div class="auth-wrapper">
        <div class="auth-box">
            <div class="auth-box__logo">🧊</div>
            <h1 class="auth-box__title">GetFridgely</h1>
            <p class="auth-box__subtitle">Twoja cyfrowa lodówka</p>

            <div id="auth-alert"></div>

            <form id="login-form">
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" name="email" class="form-input" placeholder="adres@email.pl" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Hasło</label>
                    <input type="password" name="password" class="form-input" placeholder="••••••••" required />
                </div>
                <button type="submit" class="btn btn--primary btn--full" id="login-btn">
                    Zaloguj się
                </button>
                <div style="text-align:center;margin-top:12px">
                    <a id="forgot-link" style="font-size:13px;color:var(--text-muted);cursor:pointer;text-decoration:underline">
                        Nie pamiętasz hasła?
                    </a>
                </div>
            </form>

            <form id="forgot-form" style="display:none">
                <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;line-height:1.5">
                    Podaj adres e-mail konta. Wyślemy link do ustawienia nowego hasła.
                </p>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" name="email" class="form-input" placeholder="adres@email.pl" required />
                </div>
                <button type="submit" class="btn btn--primary btn--full" id="forgot-btn">
                    Wyślij link resetujący
                </button>
                <div style="text-align:center;margin-top:12px">
                    <a id="back-to-login" style="font-size:13px;color:var(--text-muted);cursor:pointer;text-decoration:underline">
                        ← Wróć do logowania
                    </a>
                </div>
            </form>

            <form id="register-form" style="display:none">
                <div class="form-group">
                    <label class="form-label">Imię</label>
                    <input type="text" name="name" class="form-input" placeholder="Jan Kowalski" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" name="email" class="form-input" placeholder="adres@email.pl" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Hasło</label>
                    <input type="password" name="password" class="form-input" placeholder="min. 8 znaków" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Powtórz hasło</label>
                    <input type="password" name="password_confirmation" class="form-input" placeholder="••••••••" required />
                </div>
                <div style="border-top:1px solid var(--border);margin:16px 0 14px"></div>
                <div class="form-group">
                    <label class="form-label" style="display:flex;align-items:center;gap:6px">
                        Kod zaproszenia
                        <span style="font-size:11px;color:var(--text-muted);font-weight:400">(opcjonalnie — dołącz do istniejącej rodziny)</span>
                    </label>
                    <input type="text" name="invite_code" id="reg-invite-code" class="form-input"
                        placeholder="np. AB12CD34" maxlength="8"
                        style="text-transform:uppercase;letter-spacing:.1em;font-family:monospace" />
                </div>
                <button type="submit" class="btn btn--primary btn--full" id="register-btn">
                    Utwórz konto
                </button>
            </form>

            <div class="auth-box__switch" id="auth-switch">
                Nie masz konta? <a id="toggle-auth">Zarejestruj się</a>
            </div>
        </div>
    </div>`;
}

function buildResetHTML() {
    return `
    <div class="auth-wrapper">
        <div class="auth-box">
            <div class="auth-box__logo">🧊</div>
            <h1 class="auth-box__title">Nowe hasło</h1>
            <p class="auth-box__subtitle">GetFridgely</p>
            <div id="auth-alert"></div>
            <form id="reset-form">
                <div class="form-group">
                    <label class="form-label">Nowe hasło</label>
                    <input type="password" name="password" class="form-input" placeholder="min. 8 znaków" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Powtórz hasło</label>
                    <input type="password" name="password_confirmation" class="form-input" placeholder="••••••••" required />
                </div>
                <button type="submit" class="btn btn--primary btn--full" id="reset-btn">
                    Ustaw nowe hasło
                </button>
            </form>
        </div>
    </div>`;
}

function bindResetEvents(token, email) {
    document.getElementById('reset-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('reset-btn');
        btn.disabled = true;
        btn.textContent = 'Zapisywanie…';
        clearAlert();
        try {
            const f = e.target;
            await api.auth.resetPassword({
                token,
                email,
                password:              f.password.value,
                password_confirmation: f.password_confirmation.value,
            });
            showAlert('Hasło zostało zmienione. Możesz się teraz zalogować.', 'success');
            setTimeout(() => {
                window.history.replaceState({}, '', window.location.pathname);
                renderAuth();
            }, 2000);
        } catch (err) {
            showAlert(err.message || 'Błąd. Wyślij nowy link resetujący.', 'error');
            btn.disabled = false;
            btn.textContent = 'Ustaw nowe hasło';
        }
    });
}

function bindAuthEvents() {
    let isRegister = false;

    document.getElementById('forgot-link')?.addEventListener('click', () => {
        document.getElementById('login-form').style.display  = 'none';
        document.getElementById('forgot-form').style.display = 'block';
        document.querySelector('.auth-box__switch').style.display = 'none';
        clearAlert();
    });

    document.getElementById('back-to-login')?.addEventListener('click', () => {
        document.getElementById('forgot-form').style.display = 'none';
        document.getElementById('login-form').style.display  = 'block';
        document.querySelector('.auth-box__switch').style.display = 'block';
        clearAlert();
    });

    document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('forgot-btn');
        btn.disabled = true;
        btn.textContent = 'Wysyłanie…';
        clearAlert();
        try {
            const f = e.target;
            const res = await api.auth.forgotPassword({ email: f.email.value });
            showAlert(res.message || 'Link wysłany! Sprawdź skrzynkę e-mail.', 'success');
            btn.textContent = 'Wysłano ✓';
        } catch (err) {
            showAlert(err.message || 'Błąd wysyłania.', 'error');
            btn.disabled = false;
            btn.textContent = 'Wyślij link resetujący';
        }
    });

    document.getElementById('toggle-auth').addEventListener('click', () => {
        isRegister = !isRegister;
        document.getElementById('login-form').style.display    = isRegister ? 'none'  : 'block';
        document.getElementById('register-form').style.display = isRegister ? 'block' : 'none';
        document.getElementById('toggle-auth').textContent     = isRegister ? 'Zaloguj się' : 'Zarejestruj się';
        document.querySelector('#auth-switch').innerHTML =
            (isRegister ? 'Masz już konto? ' : 'Nie masz konta? ') +
            `<a id="toggle-auth">${isRegister ? 'Zaloguj się' : 'Zarejestruj się'}</a>`;
        bindAuthEvents();
        clearAlert();
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('login-btn');
        btn.disabled = true;
        btn.textContent = 'Logowanie...';
        clearAlert();
        try {
            const f = e.target;
            await login(f.email.value, f.password.value);
            await renderApp();
        } catch (err) {
            showAlert(err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Zaloguj się';
        }
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('register-btn');
        btn.disabled = true;
        btn.textContent = 'Tworzenie konta...';
        clearAlert();
        try {
            const f = e.target;
            await register(f.name.value, f.email.value, f.password.value, f.password_confirmation.value);
            const code = (f.invite_code?.value ?? '').trim().toUpperCase();
            if (code.length === 8) {
                try {
                    await api.family.join({ invite_code: code });
                } catch (joinErr) {
                    showAlert('Konto utworzone, ale kod zaproszenia jest nieprawidłowy: ' + (joinErr.message || 'błąd'), 'error');
                    await renderApp();
                    return;
                }
            }
            await renderApp();
        } catch (err) {
            const msg = err.errors
                ? Object.values(err.errors).flat().join(' ')
                : err.message;
            showAlert(msg, 'error');
            btn.disabled = false;
            btn.textContent = 'Utwórz konto';
        }
    });
}

function showAlert(msg, type) {
    document.getElementById('auth-alert').innerHTML =
        `<div class="alert alert--${type}" style="margin-bottom:16px">${msg}</div>`;
}

function clearAlert() {
    document.getElementById('auth-alert').innerHTML = '';
}
