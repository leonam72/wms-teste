// ReceivingPage.js
import { API } from '../services/api.js';

export const ReceivingPage = {
    render() {
        const workspace = document.getElementById('page-content');
        workspace.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">RECEBIMENTO DE MERCADORIAS</h1>
                <p class="page-subtitle">IMPORTAÇÃO DE NOTA FISCAL ELETRÔNICA (XML)</p>
            </div>

            <div class="upload-container" id="drop-zone">
                <div class="upload-box">
                    <div class="upload-text-large">ARRASTE O XML DA NF-e AQUI</div>
                    <div class="upload-text-small">OU CLIQUE PARA SELECIONAR O ARQUIVO</div>
                    <input type="file" id="nfe-file" accept=".xml" style="display: none;">
                </div>
            </div>

            <div id="pending-sessions" class="pending-sessions-container">
                <div class="section-title">CONFERÊNCIAS EM ABERTO</div>
                <div id="sessions-list" class="sessions-list">
                    <div class="loading">CARREGANDO SESSÕES...</div>
                </div>
            </div>

            <div id="nfe-result" class="nfe-result-container"></div>
        `;

        this.initEvents();
        this.listPendingSessions();
    },

    async listPendingSessions() {
        const listDiv = document.getElementById('sessions-list');
        if (!listDiv) return;

        try {
            const sessions = await API.receiving.listSessions();
            if (sessions.length === 0) {
                listDiv.innerHTML = '<div style="padding: 20px; color: var(--text3); font-size: 11px;">NENHUMA SESSÃO PENDENTE</div>';
                return;
            }

            listDiv.innerHTML = sessions.map(s => `
                <div class="session-row" onclick="window.location.hash='#blindcount?id=${s.id}'">
                    <div class="session-info">
                        <span class="session-tag">NF-e ${s.nfe_number}</span>
                        <span class="session-issuer">${s.issuer_name.toUpperCase()}</span>
                    </div>
                    <div class="session-action">CONTINUAR CONFERÊNCIA</div>
                </div>
            `).join('');
        } catch (err) {
            listDiv.innerHTML = `<div class="error">ERRO AO LISTAR: ${err.message}</div>`;
        }
    },

    initEvents() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('nfe-file');

        if (!dropZone || !fileInput) return;

        dropZone.onclick = () => fileInput.click();

        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.classList.add('dragging');
        };

        dropZone.ondragleave = () => dropZone.classList.remove('dragging');

        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragging');
            const file = e.dataTransfer.files[0];
            if (file) this.handleUpload(file);
        };

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) this.handleUpload(file);
        };
    },

    async handleUpload(file) {
        const resultDiv = document.getElementById('nfe-result');
        if (!resultDiv) return;
        
        resultDiv.innerHTML = '<div class="loading">PROCESSANDO XML...</div>';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const data = await API.receiving.upload(formData);
            this.renderNFeDetails(data);
        } catch (err) {
            resultDiv.innerHTML = `<div class="error">ERRO: ${err.message.toUpperCase()}</div>`;
        }
    },

    async startConference(nfeData) {
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.textContent = 'INICIANDO...';
            startBtn.disabled = true;
        }

        try {
            const result = await API.receiving.createSession(nfeData);
            window.location.hash = `#blindcount?id=${result.session_id}`;
        } catch (err) {
            alert("ERRO AO INICIAR CONFERÊNCIA: " + err.message);
            if (startBtn) {
                startBtn.textContent = 'INICIAR CONFERÊNCIA CEGA';
                startBtn.disabled = false;
            }
        }
    },

    renderNFeDetails(data) {
        const resultDiv = document.getElementById('nfe-result');
        if (!resultDiv) return;

        resultDiv.innerHTML = `
            <div class="nfe-card">
                <div class="nfe-header">
                    <div class="nfe-chip">NF-e DETECTADA</div>
                    <h2 class="nfe-number">Nº ${data.numero_nf} - SÉRIE ${data.serie}</h2>
                </div>
                
                <div class="nfe-grid">
                    <div class="nfe-info-block">
                        <label>EMITENTE</label>
                        <div>${data.emitente_nome}</div>
                        <div style="font-size: 11px; color: var(--text3)">CNPJ: ${data.emitente_cnpj}</div>
                    </div>
                    <div class="nfe-info-block">
                        <label>CHAVE DE ACESSO</label>
                        <div style="font-family: 'IBM Plex Mono'; font-size: 11px;">${data.chave_acesso}</div>
                    </div>
                </div>

                <div class="section-title">ITENS DA NOTA (${data.itens.length})</div>
                <table class="wms-table">
                    <thead>
                        <tr>
                            <th>CÓDIGO</th>
                            <th>DESCRIÇÃO</th>
                            <th>QTD XML</th>
                            <th>UN</th>
                            <th>LOTE</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.itens.map(item => `
                            <tr>
                                <td style="font-family: 'IBM Plex Mono';">${item.codigo}</td>
                                <td>${item.descricao}</td>
                                <td style="font-weight: 700;">${item.quantidade}</td>
                                <td>${item.unidade}</td>
                                <td>${item.lote || '<span style="color:var(--danger)">N/A</span>'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="action-bar">
                    <button class="btn-large" id="start-btn">INICIAR CONFERÊNCIA CEGA</button>
                </div>
            </div>
        `;

        const btn = document.getElementById('start-btn');
        if (btn) btn.onclick = () => this.startConference(data);
    }
};
