// ShelvesPage.js
import { API } from '../services/api.js';

export const ShelvesPage = {
    depots: [],
    selectedDepotId: null,

    async render() {
        const workspace = document.getElementById('page-content');
        workspace.innerHTML = `<div class="loading">CARREGANDO INFRAESTRUTURA...</div>`;

        try {
            this.depots = await API.inventory.listDepots();
            if (this.depots.length > 0 && !this.selectedDepotId) {
                this.selectedDepotId = this.depots[0].id;
            }
            
            let shelves = [];
            if (this.selectedDepotId) {
                shelves = await API.inventory.listShelves(this.selectedDepotId);
            }

            this.drawUI(workspace, shelves);
        } catch (err) {
            workspace.innerHTML = `<div class="error">ERRO: ${err.message.toUpperCase()}</div>`;
        }
    },

    drawUI(container, shelves) {
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">GESTÃO DE INFRAESTRUTURA FÍSICA</h1>
                <div class="depot-selector-container">
                    <label class="label-small">FILTRAR CD:</label>
                    <select id="shelf-depot-select" class="input-select-industrial">
                        ${this.depots.map(d => `<option value="${d.id}" ${d.id === this.selectedDepotId ? 'selected' : ''}>${d.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="action-bar-top">
                <div class="section-title">ESTANTES CADASTRADAS (${shelves.length})</div>
                <button class="btn-medium" id="add-shelf-btn">NOVA ESTANTE</button>
            </div>

            <table class="wms-table">
                <thead>
                    <tr>
                        <th>CÓDIGO</th>
                        <th>NÍVEIS</th>
                        <th>GAVETAS/NÍVEL</th>
                        <th>TOTAL GAVETAS</th>
                    </tr>
                </thead>
                <tbody>
                    ${shelves.map(s => `
                        <tr>
                            <td style="font-family: 'IBM Plex Mono'; font-weight: 700; color: var(--accent)">ESTANTE ${s.code}</td>
                            <td>${s.floors}</td>
                            <td>${s.drawers_per_floor}</td>
                            <td style="font-weight: 700;">${s.floors * s.drawers_per_floor}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        this.initEvents();
    },

    initEvents() {
        const select = document.getElementById('shelf-depot-select');
        if (select) {
            select.onchange = (e) => {
                this.selectedDepotId = e.target.value;
                this.render();
            };
        }

        document.getElementById('add-shelf-btn').onclick = () => {
            alert("O formulário de criação de estante com auto-geração de gavetas será finalizado na próxima etapa.");
        };
    }
};
