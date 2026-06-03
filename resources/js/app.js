import { tryAutoLogin, renderAuth } from './modules/auth.js';
import { renderApp } from './modules/app.js';

async function boot() {
    const loggedIn = await tryAutoLogin();
    if (loggedIn) {
        await renderApp();
    } else {
        renderAuth();
    }
}

boot();
