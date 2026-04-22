// main.js - Orquestrador do Sistema
import { NavRail } from './components/NavRail.js';
import { Sidebar } from './components/Sidebar.js';
import { API } from './services/api.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { ReceivingPage } from './pages/ReceivingPage.js';
import { BlindCountPage } from './pages/BlindCountPage.js';
import { MapPage } from './pages/MapPage.js';
import { ProductsPage } from './pages/ProductsPage.js';
import { AuditPage } from './pages/AuditPage.js';
import { PickingPage } from './pages/PickingPage.js';
import { ShelvesPage } from './pages/ShelvesPage.js';

class App {
    constructor() {
        this.user = null;
        this.currentPage = 'overview';
        this.init();
    }

    async init() {
        console.log("WMS Inicializando");

        try {
            this.user = await API.auth.me();
            document.getElementById('user-display').textContent = this.user.full_name.toUpperCase();
            document.getElementById('logout-btn').onclick = () => API.auth.logout();

            window.addEventListener('hashchange', () => this.handleHashChange());

            NavRail.render();
            
            if (window.location.hash) {
                this.handleHashChange();
            } else {
                this.handlePageChange('overview');
            }
        } catch (err) {
            console.warn("Sessão inválida, redirecionando para login.");
            window.location.href = '/login';
        }
    }

    handleHashChange() {
        const hash = window.location.hash.substring(1); // Remove #
        const [pageId, query] = hash.split('?');
        const params = new URLSearchParams(query);
        
        console.log(`Navegando via Hash: ${pageId}`);
        
        NavRail.setActive(pageId);
        Sidebar.render(pageId);
        this.loadPage(pageId, params);
    }

    handlePageChange(pageId) {
        window.location.hash = pageId;
    }

    loadPage(pageId, params = null) {
        const workspace = document.getElementById('page-content');
        if (!workspace) return;
        
        try {
            console.log(`Renderizando página: ${pageId}`);
            if (pageId === 'overview') {
                OverviewPage.render();
            } else if (pageId === 'receiving') {
                ReceivingPage.render();
            } else if (pageId === 'blindcount') {
                BlindCountPage.render(params ? params.get('id') : null);
            } else if (pageId === 'map') {
                MapPage.render();
            } else if (pageId === 'products') {
                ProductsPage.render();
            } else if (pageId === 'audit') {
                AuditPage.render();
            } else if (pageId === 'picking') {
                PickingPage.render();
            } else if (pageId === 'config') {
                ShelvesPage.render();
            } else {
                workspace.innerHTML = `<h2 style="font-family: 'IBM Plex Mono'; color: var(--accent);">PÁGINA: ${pageId.toUpperCase()}</h2>
                                       <p style="color: var(--text3); font-size: 12px; margin-top: 10px;">Módulo em construção...</p>`;
            }
        } catch (err) {
            console.error(`Erro ao carregar página ${pageId}:`, err);
            workspace.innerHTML = `<div class="error">FALHA CRÍTICA NA RENDERIZAÇÃO: ${err.message.toUpperCase()}</div>`;
        }
    }
}

const app = new App();
export default app;
