// PickingPage.js
import { API } from '../services/api.js';

export const PickingPage = {
    async render() {
        const workspace = document.getElementById('page-content');
        workspace.innerHTML = `<div class="loading">CARREGANDO ORDENS DE SAÍDA...</div>`;

        try {
            const romaneios = await API.separation.listRomaneios();
            this.drawUI(workspace, romaneios);
            this.initEvents();
        } catch (err) {
            workspace.innerHTML = `<div class="error">ERRO: ${err.message.toUpperCase()}</div>`;
        }
    },

    drawUI(container, romaneios) {
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">SEPARAÇÃO DE PEDIDOS (OUTBOUND)</h1>
                <p class="page-subtitle">ORDENS DE SAÍDA E ONDAS DE PICKING</p>
            </div>

            <div id="picking-main-area">
                <div class="section-title">ROMANEIOS PENDENTES</div>
                <div class="romaneio-list" id="romaneio-list">
                    ${this.renderRomaneios(romaneios)}
                </div>
            </div>

            <div id="picking-list-area" class="picking-list-container" style="display:none"></div>
        `;
    },

    renderRomaneios(list) {
        if (!list.length) return '<p class="no-data">NENHUM ROMANEIO PENDENTE</p>';
        return list.map(r => `
            <div class="session-row" data-id="${r.id}" data-codigo="${r.codigo}">
                <div class="session-info">
                    <span class="session-tag">DOC ${r.codigo}</span>
                    <span class="session-issuer">STATUS: ${r.status.toUpperCase()}</span>
                </div>
                <div class="session-action">INICIAR PICKING</div>
            </div>
        `).join('');
    },

    initEvents() {
        const list = document.getElementById('romaneio-list');
        if (!list) return;

        list.querySelectorAll('.session-row').forEach(row => {
            row.onclick = () => this.startPicking(row.dataset.id, row.dataset.codigo);
        });
    },

    async startPicking(id, codigo) {
        const mainArea = document.getElementById('picking-main-area');
        const listArea = document.getElementById('picking-list-area');
        
        mainArea.style.display = 'none';
        listArea.style.display = 'block';
        listArea.innerHTML = `<div class="loading">GERANDO ROTA DE PICKING PARA ${codigo}...</div>`;

        try {
            const tasks = await API.separation.getPickingList(id);
            
            listArea.innerHTML = `
                <div class="panel-header">
                    <h2 class="panel-title">ROTA DE PICKING: ${codigo}</h2>
                    <button class="btn-close" id="back-picking-btn">VOLTAR</button>
                </div>
                
                <div class="picking-tasks">
                    ${tasks.length === 0 ? '<p class="no-data">ESTOQUE INSUFICIENTE PARA ESTE PEDIDO</p>' : tasks.map(t => `
                        <div class="picking-card">
                            <div class="picking-drawer">${t.drawer}</div>
                            <div class="picking-info">
                                <div class="picking-prod">${t.product.toUpperCase()}</div>
                                <div class="picking-qty">RETIRAR: ${t.qty_to_pick} UN</div>
                                <div class="picking-lot">LOTE: ${t.lot || 'GERAL'}</div>
                            </div>
                            <button class="btn-confirm-pick">CONFIRMAR</button>
                        </div>
                    `).join('')}
                </div>
            `;

            document.getElementById('back-picking-btn').onclick = () => this.render();
            
            listArea.querySelectorAll('.btn-confirm-pick').forEach(btn => {
                btn.onclick = () => alert('Confirmação será integrada ao estoque na Fase 10');
            });

        } catch (err) {
            listArea.innerHTML = `<div class="error">ERRO AO GERAR ROTA: ${err.message}</div>`;
        }
    }
};
