// OverviewPage.js
import { API } from '../services/api.js';

export const OverviewPage = {
    async render() {
        const workspace = document.getElementById('page-content');
        workspace.innerHTML = `<div class="loading">CARREGANDO DASHBOARD...</div>`;

        try {
            const inventory = await API.inventory.list();
            const drawers = await API.inventory.drawers();
            const logs = await API.audit.list();
            const expiries = await API.inventory.getNearExpiry();
            
            workspace.innerHTML = `
                <div class="page-header">
                    <h1 class="page-title">CENTRAL DE COMANDO WMS</h1>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-label">TOTAL SKUs EM ESTOQUE</div>
                            <div class="stat-value">${inventory.length}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">OCUPAÇÃO FÍSICA</div>
                            <div class="stat-value">${this.countOccupied(inventory)} / ${drawers.length}</div>
                        </div>
                        <div class="stat-card" style="border-left-color: var(--accent3)">
                            <div class="stat-label">SESSÕES DE RECEBIMENTO</div>
                            <div class="stat-value">ATIVAS</div>
                        </div>
                    </div>
                </div>

                ${expiries.length > 0 ? `
                    <div class="expiry-alert-zone">
                        <div class="alert-title">ALERTA: ITENS PRÓXIMOS AO VENCIMENTO</div>
                        <div class="expiry-scroll">
                            ${expiries.map(e => `
                                <div class="expiry-card">
                                    <span class="expiry-date">${new Date(e.date_value).toLocaleDateString('pt-BR')}</span>
                                    <span class="expiry-prod">${e.stock_item.product.name.toUpperCase()}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="dashboard-grid">
                    <div class="dashboard-column">
                        <div class="section-title">ÚLTIMAS ATIVIDADES (AUDIT)</div>
                        <div class="audit-summary">
                            ${this.renderRecentLogs(logs.slice(0, 8))}
                        </div>
                    </div>
                    
                    <div class="dashboard-column">
                        <div class="section-title">ESTOQUE RECENTE</div>
                        <table class="wms-table">
                            <thead>
                                <tr><th>PRODUTO</th><th>GAVETA</th><th>QTD</th></tr>
                            </thead>
                            <tbody>
                                ${inventory.slice(0, 10).map(item => `
                                    <tr>
                                        <td>${item.product.name}</td>
                                        <td style="font-family:'IBM Plex Mono'">${item.drawer.drawer_key}</td>
                                        <td style="font-weight:700">${item.quantity}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (err) {
            workspace.innerHTML = `<div class="error">ERRO AO CARREGAR DASHBOARD: ${err.message}</div>`;
        }
    },

    renderRecentLogs(logs) {
        if (!logs.length) return '<p class="no-data">SEM ATIVIDADE RECENTE</p>';
        return logs.map(log => `
            <div class="mini-log-entry">
                <span class="log-tag tag-${log.action_tag.replace(/[\[\]]/g, '').toLowerCase()}">${log.action_tag}</span>
                <span class="log-desc">${log.description}</span>
            </div>
        `).join('');
    },

    countOccupied(inventory) {
        const occupied = new Set(inventory.map(i => i.drawer_id));
        return occupied.size;
    }
};
