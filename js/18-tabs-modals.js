// ╔══════════════════════════════════════════════════════════════════╗
// ║  18-tabs-modals.js       Tabs e listeners de modais                  ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— TABS ———
const switchTab = (id) => {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const tabMap = {'products-tab':'tab-products','shelves-tab':'tab-shelves'};
  if (tabMap[id]) document.getElementById(tabMap[id]).classList.add('active');

}

// ——— CLOSE MODALS ON OVERLAY CLICK ———
// modal overlay click handlers — deferred so DOM is ready
const attachModalListeners = () => {
  const em = document.getElementById('expiry-modal');
  if (em) em.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('open'); });
  const dm = document.getElementById('drawer-modal');
  if (dm) dm.addEventListener('click', function(e) { if (e.target === this) closeDrawerModal(); });
  const apm = document.getElementById('add-product-modal');
  if (apm) apm.addEventListener('click', function(e) { if (e.target === this) document.getElementById('add-product-modal').classList.remove('open'); });
  const sm = document.getElementById('settings-modal');
  if (sm) sm.addEventListener('click', function(e) { if (e.target === this) closeSettingsModal(); });
  const dz = document.getElementById('csv-drop-zone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); });
  }
}
document.addEventListener('DOMContentLoaded', attachModalListeners);

