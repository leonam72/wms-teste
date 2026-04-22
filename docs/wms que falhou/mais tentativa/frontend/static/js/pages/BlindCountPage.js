// BlindCountPage.js
import { API } from '../services/api.js';

export const BlindCountPage = {
    session: null,

    async render(sessionId) {
        const workspace = document.getElementById('page-content');
        workspace.innerHTML = `<div class="loading">CARREGANDO SESSÃO ${sessionId}...</div>`;

        try {
            this.session = await API.receiving.getSession(sessionId);
            this.drawUI(workspace);
            this.initEvents();
        } catch (err) {
            workspace.innerHTML = `<div class="error">ERRO: ${err.message.toUpperCase()}</div>`;
        }
    },

    drawUI(container) {
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">CONFERÊNCIA CEGA EM CURSO</h1>
                <p class="page-subtitle">NF-e: ${this.session.nfe_number} | EMITENTE: ${this.session.issuer_name.toUpperCase()}</p>
            </div>

            <div class="conference-input-area">
                <label class="label-large">BIPE O CÓDIGO DE BARRAS (EAN) OU CÓDIGO DO PRODUTO</label>
                <input type="text" id="barcode-input" class="input-ultra-large" placeholder="AGUARDANDO LEITURA..." autofocus>
                <div id="feedback-msg" class="feedback-msg"></div>
            </div>

            <div class="section-title">ITENS CONFERIDOS NESTA SESSÃO</div>
            <table class="wms-table">
                <thead>
                    <tr>
                        <th>PRODUTO / EAN</th>
                        <th>DESCRIÇÃO</th>
                        <th style="text-align: center;">CONTADO</th>
                        <th style="text-align: center;">UN</th>
                    </tr>
                </thead>
                <tbody id="counted-items-body">
                    ${this.renderTableRows()}
                </tbody>
            </table>

            <div class="action-bar">
                <button class="btn-large" style="background: var(--accent2)" id="finish-btn">FINALIZAR E COMPARAR COM XML</button>
            </div>
        `;
    },

    renderTableRows() {
        // Mostra apenas itens que já tiveram alguma contagem para focar no progresso
        const items = this.session.items.filter(i => i.counted_qty > 0);
        if (items.length === 0) return '<tr><td colspan="4" style="text-align:center; padding: 40px; color: var(--text3)">NENHUM ITEM BIPADO AINDA</td></tr>';
        
        return items.map(item => `
            <tr>
                <td style="font-family: 'IBM Plex Mono'; font-weight: 700;">${item.product_code}<br><span style="font-size: 11px; font-weight: 400; color: var(--text3)">${item.ean || 'SEM EAN'}</span></td>
                <td>${item.description}</td>
                <td style="text-align: center; font-size: 18px; font-weight: 700; color: var(--accent3)">${item.counted_qty}</td>
                <td style="text-align: center;">${item.unit}</td>
            </tr>
        `).join('');
    },

    initEvents() {
        const input = document.getElementById('barcode-input');
        const feedback = document.getElementById('feedback-msg');

        input.onkeypress = async (e) => {
            if (e.key === 'Enter') {
                const ean = input.value.trim();
                if (!ean) return;

                input.disabled = true;
                feedback.textContent = 'VALIDANDO...';
                feedback.className = 'feedback-msg';

                try {
                    const updatedItem = await API.receiving.registerCount(this.session.id, { ean: ean, qty: 1 });
                    
                    // Atualiza localmente o item na lista da sessão
                    const idx = this.session.items.findIndex(i => i.id === updatedItem.id);
                    if (idx !== -1) this.session.items[idx] = updatedItem;

                    feedback.textContent = `SUCESSO: ${updatedItem.description.toUpperCase()}`;
                    feedback.className = 'feedback-msg success';
                    
                    document.getElementById('counted-items-body').innerHTML = this.renderTableRows();
                    input.value = '';
                } catch (err) {
                    feedback.textContent = `ERRO: ${err.message.toUpperCase()}`;
                    feedback.className = 'feedback-msg error-bg';
                } finally {
                    input.disabled = false;
                    input.focus();
                }
            }
        };

        document.getElementById('finish-btn').onclick = () => {
            alert("A comparação detalhada e divergências serão implementadas na próxima etapa.");
        };
    }
};
