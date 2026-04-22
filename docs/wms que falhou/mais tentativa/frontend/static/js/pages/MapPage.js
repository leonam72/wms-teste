// MapPage.js
import { API } from '../services/api.js';

export const MapPage = {
    depots: [],
    selectedDepotId: null,
    layout: null,

    async render() {
        const workspace = document.getElementById('page-content');
        workspace.innerHTML = `<div class="loading">INICIALIZANDO MAPA...</div>`;

        try {
            this.depots = await API.inventory.listDepots();
            if (this.depots.length > 0 && !this.selectedDepotId) {
                this.selectedDepotId = this.depots[0].id;
            }
            
            if (this.selectedDepotId) {
                this.layout = await API.floorplan.getLayout(this.selectedDepotId);
            }

            this.drawUI(workspace);
        } catch (err) {
            workspace.innerHTML = `<div class="error">ERRO NO MAPA: ${err.message.toUpperCase()}</div>`;
        }
    },

    drawUI(container) {
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">MAPA TÁTICO DO ARMAZÉM</h1>
                <div class="depot-selector-container">
                    <label class="label-small">SELECIONAR CENTRO DE DISTRIBUIÇÃO:</label>
                    <select id="depot-select" class="input-select-industrial">
                        ${this.depots.map(d => `<option value="${d.id}" ${d.id === this.selectedDepotId ? 'selected' : ''}>${d.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="warehouse-grid-container">
                <div class="warehouse-canvas" id="warehouse-canvas">
                    ${this.renderLayout()}
                </div>
            </div>

            <div id="shelf-detail-panel" class="shelf-detail-panel">
                <div class="panel-placeholder">SELECIONE UMA PRATELEIRA PARA VER DETALHES</div>
            </div>
            
            <div id="drawer-detail-panel" class="drawer-detail-panel" style="display: none;"></div>
        `;

        this.initEvents();
    },

    renderLayout() {
        if (!this.layout || !this.layout.shelves.length) return '<div class="no-data">NENHUMA PRATELEIRA NESTE CD</div>';

        return this.layout.shelves.map(shelf => `
            <div class="shelf-box" data-id="${shelf.id}" style="left: ${shelf.x}px; top: ${shelf.y}px; transform: rotate(${shelf.rotation}deg)">
                <div class="shelf-label">ESTANTE ${shelf.code}</div>
                <div class="shelf-stats">${shelf.floors} NÍVEIS</div>
            </div>
        `).join('');
    },

    initEvents() {
        const select = document.getElementById('depot-select');
        if (select) {
            select.onchange = (e) => {
                this.selectedDepotId = e.target.value;
                this.render();
            };
        }

        document.querySelectorAll('.shelf-box').forEach(box => {
            box.onclick = () => this.showShelfDetail(box.dataset.id);
        });
    },

    async showShelfDetail(shelfId) {
        const panel = document.getElementById('shelf-detail-panel');
        panel.innerHTML = '<div class="loading">CARREGANDO...</div>';

        const shelf = this.layout.shelves.find(s => s.id === shelfId);
        
        panel.innerHTML = `
            <div class="panel-header">
                <h3 class="panel-title">ESTANTE ${shelf.code}</h3>
                <span class="panel-subtitle">${shelf.floors} NÍVEIS | ${shelf.drawers_per_floor} GAVETAS POR NÍVEL</span>
            </div>
            <div class="shelf-matrix">
                ${this.renderShelfMatrix(shelf)}
            </div>
        `;

        panel.querySelectorAll('.matrix-cell').forEach(cell => {
            cell.onclick = (e) => {
                e.stopPropagation();
                this.showDrawerDetail(cell.dataset.key, cell.dataset.id);
            };
        });
    },

    renderShelfMatrix(shelf) {
        let html = '';
        for (let f = shelf.floors; f >= 1; f--) {
            html += `<div class="matrix-row"><div class="row-label">NÍVEL ${f}</div>`;
            for (let d = 1; d <= shelf.drawers_per_floor; d++) {
                // Monta a chave da gaveta seguindo o padrão do mega_seed: CDXX-Sf-Gd
                // Mas no front apenas simplificamos a visualização
                const key = `${this.selectedDepotId}-${shelf.code}${f}-G${d.toString().padStart(2, '0')}`;
                html += `<div class="matrix-cell" data-key="${key}">${d}</div>`;
            }
            html += `</div>`;
        }
        return html;
    },

    async showDrawerDetail(key) {
        const panel = document.getElementById('drawer-detail-panel');
        panel.style.display = 'block';
        panel.innerHTML = `<div class="loading">CONSULTANDO GAVETA ${key}...</div>`;

        try {
            const items = await API.inventory.getDrawerItems(key);
            
            panel.innerHTML = `
                <div class="drawer-header">
                    <h4 class="drawer-title">POSIÇÃO: ${key}</h4>
                    <button class="btn-close" id="close-drawer-btn">FECHAR</button>
                </div>
                <div class="drawer-content">
                    ${items.length === 0 ? '<p class="no-data">GAVETA VAZIA</p>' : `
                        <table class="wms-table mini">
                            <thead>
                                <tr><th>PRODUTO</th><th>QTD</th><th>LOTE</th></tr>
                            </thead>
                            <tbody>
                                ${items.map(i => `<tr><td>${i.product.name}</td><td>${i.quantity}</td><td>${i.lot || '-'}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            `;
            document.getElementById('close-drawer-btn').onclick = () => panel.style.display = 'none';
        } catch (err) {
            panel.innerHTML = `<div class="error">ERRO: ${err.message.toUpperCase()}</div>`;
        }
    }
};
