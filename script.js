// Unified JS for multiple pages (updated to populate products into invoice rows).
// Keys in localStorage:
//  - wb_customers (array of {name,contact})
//  - wb_products  (array of {name,rate})
//  - wb_invoices  (array of invoice objects)

(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ---- Storage helpers ----
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  }
  function write(key, data) { localStorage.setItem(key, JSON.stringify(data || [])); }

  // ---- Masters: add + render ----
  function addCustomer(name, contact) {
    if (!name) return;
    const list = read('wb_customers');
    list.unshift({ name: name.trim(), contact: contact || '' });
    write('wb_customers', list);
    renderMasters(); loadBuyersIntoSelect();
  }
  function addProduct(name, rate) {
    if (!name) return;
    const list = read('wb_products');
    list.unshift({ name: name.trim(), rate: Number(rate || 0) });
    write('wb_products', list);
    renderMasters(); refreshProductOptions();
  }

  function renderMasters() {
    const customers = read('wb_customers');
    const prods = read('wb_products');
    const custListEl = $('#custList');
    if (custListEl) {
      custListEl.innerHTML = customers.length
        ? customers.map(c => `<li class="list-group-item d-flex justify-content-between">${escapeHtml(c.name)}<small>${escapeHtml(c.contact||'')}</small></li>`).join('')
        : '<li class="list-group-item text-muted">No customers</li>';
    }
    const prodListEl = $('#prodList');
    if (prodListEl) {
      prodListEl.innerHTML = prods.length
        ? prods.map(p => `<li class="list-group-item d-flex justify-content-between">${escapeHtml(p.name)} <strong>₹${Number(p.rate).toFixed(2)}</strong></li>`).join('')
        : '<li class="list-group-item text-muted">No products</li>';
    }
  }

  // Put buyers into invoice select
  function loadBuyersIntoSelect() {
    const sel = $('#buyerName'); if (!sel) return;
    const customers = read('wb_customers');
    sel.innerHTML = '<option value="">-- Select / Type --</option>' + customers.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  }

  // ---- Product options for invoice rows ----
  function productOptionsHTML() {
    const products = read('wb_products');
    // first option blank allows custom item name
    return '<option value="">-- Product / Custom --</option>' + products.map(p => `<option value="${escapeHtml(p.name)}" data-rate="${Number(p.rate)}">${escapeHtml(p.name)} — ₹${Number(p.rate).toFixed(2)}</option>`).join('');
  }

  // Update all existing item-select elements (when product list changes)
  function refreshProductOptions() {
    $$('.item-select').forEach(sel => {
      const current = sel.value || '';
      sel.innerHTML = productOptionsHTML();
      sel.value = current;
    });
  }

  // ---- Invoice rows ----
  function createEmptyRow() {
    // create a row that includes a product select + free text input for item name
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-start">
        <select class="form-select item-select"></select>
        <input class="form-control item-name mt-1" placeholder="Item (or choose product)">
      </td>
      <td><input class="form-control item-hsn" placeholder="HSN"></td>
      <td><input class="form-control item-gst" type="number" value="18" min="0"></td>
      <td><input class="form-control item-qty" type="number" value="1" min="0"></td>
      <td><input class="form-control item-rate" type="number" value="0" min="0"></td>
      <td class="text-end amt">0.00</td>
      <td class="text-end cgst">0.00</td>
      <td class="text-end sgst">0.00</td>
      <td class="text-end total">0.00</td>
      <td><button class="btn btn-sm btn-outline-danger remove">✖</button></td>
    `;
    // populate product options
    tr.querySelector('.item-select').innerHTML = productOptionsHTML();

    // when product selected, fill item name and rate
    tr.querySelector('.item-select').addEventListener('change', (ev) => {
      const sel = ev.currentTarget;
      const chosen = sel.selectedOptions[0];
      const nameInput = tr.querySelector('.item-name');
      const rateInput = tr.querySelector('.item-rate');
      if (chosen && chosen.value) {
        nameInput.value = chosen.value;
        const r = chosen.getAttribute('data-rate');
        rateInput.value = r != null ? Number(r) : rateInput.value;
      } else {
        // cleared selection: do not overwrite custom name/rate
      }
      recalcAll();
    });

    // when name/rate/qty/gst change recalc
    ['item-name','item-gst','item-qty','item-rate','item-hsn'].forEach(cls => {
      tr.querySelectorAll('.' + cls).forEach(el => el.addEventListener('input', recalcAll));
    });

    // remove row
    tr.querySelector('.remove').addEventListener('click', () => { tr.remove(); recalcAll(); });

    return tr;
  }

  function recalcRow(tr) {
    const qty = Number(tr.querySelector('.item-qty').value || 0);
    const rate = Number(tr.querySelector('.item-rate').value || 0);
    const gst = Number(tr.querySelector('.item-gst').value || 0);
    const amount = qty * rate;
    const gstAmt = amount * gst / 100;
    const cgst = gstAmt / 2;
    const sgst = gstAmt / 2;
    const total = amount + gstAmt;
    tr.querySelector('.amt').textContent = amount.toFixed(2);
    tr.querySelector('.cgst').textContent = cgst.toFixed(2);
    tr.querySelector('.sgst').textContent = sgst.toFixed(2);
    tr.querySelector('.total').textContent = total.toFixed(2);
    return { amount, cgst, sgst, total };
  }

  function recalcAll() {
    const tbody = $('#items'); if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    let subtotal = 0, totCgst = 0, totSgst = 0, grand = 0;
    rows.forEach(r => {
      const vals = recalcRow(r);
      subtotal += vals.amount;
      totCgst += vals.cgst;
      totSgst += vals.sgst;
      grand += vals.total;
    });
    const setIf = (sel, val) => { const el = $(sel); if (el) el.textContent = val.toFixed(2); };
    setIf('#amt', subtotal);
    setIf('#cgst', totCgst);
    setIf('#sgst', totSgst);
    setIf('#grand', grand);
  }

  // ---- Save / Preview / Export ----
  function saveInvoice() {
    const invNo = ($('#invoiceNo') && $('#invoiceNo').value) || `INV-${Date.now()}`;
    const date = ($('#invoiceDate') && $('#invoiceDate').value) || new Date().toISOString().slice(0,10);
    const seller = { name: ($('#sellerName') && $('#sellerName').value) || '', gst: ($('#sellerGST') && $('#sellerGST').value) || '' };
    const buyer = { name: ($('#buyerName') && $('#buyerName').value) || '', gst: ($('#buyerGST') && $('#buyerGST').value) || '' };
    const rowEls = Array.from(document.querySelectorAll('#items tr'));
    const rows = rowEls.map(tr => ({
      item: tr.querySelector('.item-name').value || '',
      hsn: tr.querySelector('.item-hsn').value || '',
      gst: Number(tr.querySelector('.item-gst').value || 0),
      qty: Number(tr.querySelector('.item-qty').value || 0),
      rate: Number(tr.querySelector('.item-rate').value || 0),
      amount: Number(tr.querySelector('.amt').textContent || 0),
      cgst: Number(tr.querySelector('.cgst').textContent || 0),
      sgst: Number(tr.querySelector('.sgst').textContent || 0),
      total: Number(tr.querySelector('.total').textContent || 0),
    }));
    if (!rows.length) return alert('Add at least one item');
    const invoice = { invNo, date, seller, buyer, rows, summary: {
      subtotal: Number($('#amt') ? $('#amt').textContent : 0),
      cgst: Number($('#cgst') ? $('#cgst').textContent : 0),
      sgst: Number($('#sgst') ? $('#sgst').textContent : 0),
      grand: Number($('#grand') ? $('#grand').textContent : 0)
    } };
    const all = read('wb_invoices'); all.unshift(invoice); write('wb_invoices', all);
    alert('Invoice saved');
    renderDashboard(); renderHistory();
  }

  function previewInvoice() {
    const inv = read('wb_invoices')[0];
    if (!inv) return alert('Save an invoice first to preview');
    const html = `<html><head><title>${escapeHtml(inv.invNo)}</title>
      <style>body{font-family:Arial;padding:16px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px}</style>
      </head><body>
      <h3>Invoice ${escapeHtml(inv.invNo)}</h3>
      <p><strong>Date:</strong> ${escapeHtml(inv.date)}</p>
      <p><strong>Seller:</strong> ${escapeHtml(inv.seller.name)}</p>
      <p><strong>Buyer:</strong> ${escapeHtml(inv.buyer.name)}</p>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>
        ${inv.rows.map(r => `<tr><td>${escapeHtml(r.item)}</td><td>${r.qty}</td><td>₹${r.rate.toFixed(2)}</td><td>₹${r.total.toFixed(2)}</td></tr>`).join('')}
      </tbody></table>
      <h4>Grand Total: ₹${inv.summary.grand.toFixed(2)}</h4>
      </body></html>`;
    const w = window.open('', '_blank'); w.document.write(html); w.document.close();
  }

  function exportAllCSV() {
    const data = read('wb_invoices'); if (!data.length) return alert('No invoices to export');
    let csv = 'InvoiceNo,Date,Customer,Subtotal,CGST,SGST,Grand\n';
    data.forEach(i => {
      csv += `${escapeCsv(i.invNo)},${escapeCsv(i.date)},${escapeCsv(i.buyer.name)},${i.summary.subtotal},${i.summary.cgst},${i.summary.sgst},${i.summary.grand}\n`;
    });
    downloadBlob(csv, 'invoices.csv', 'text/csv');
  }

  // ---- Dashboard & Reports render ----
  function renderDashboard() {
    const inv = read('wb_invoices');
    if (!$('#dashInv')) return;
    $('#dashInv').textContent = inv.length;
    const totalSales = inv.reduce((s,i)=> s + Number(i.summary.subtotal || 0), 0);
    const totalGst = inv.reduce((s,i)=> s + Number(i.summary.cgst + i.summary.sgst || 0), 0);
    $('#dashSales').textContent = totalSales.toFixed(2);
    $('#dashGST').textContent = totalGst.toFixed(2);
    $('#dashAvg').textContent = (inv.length ? (totalSales / inv.length).toFixed(2) : '0.00');
    const recentEl = $('#recentInvoices');
    if (recentEl) recentEl.innerHTML = inv.length ? inv.slice(0,5).map((i,idx)=> `<tr><td>${idx+1}</td><td>${escapeHtml(i.date)}</td><td>${escapeHtml(i.buyer.name)}</td><td>₹${i.summary.grand.toFixed(2)}</td></tr>`).join('') : `<tr><td colspan="4" class="text-muted">No invoices yet</td></tr>`;
  }

  function renderHistory() {
    const inv = read('wb_invoices');
    const el = $('#invoiceHistory'); if (!el) return;
    if (!inv.length) { el.innerHTML = '<tr><td colspan="8" class="text-muted">No Data</td></tr>'; return; }
    el.innerHTML = inv.map((i,idx) => `
      <tr>
        <td>${idx+1}</td>
        <td>${escapeHtml(i.date)}</td>
        <td>${escapeHtml(i.buyer.name)}</td>
        <td>₹${i.summary.subtotal.toFixed(2)}</td>
        <td>₹${i.summary.cgst.toFixed(2)}</td>
        <td>₹${i.summary.sgst.toFixed(2)}</td>
        <td>₹${i.summary.grand.toFixed(2)}</td>
        <td><button class="btn btn-sm btn-primary view" data-idx="${idx}">View</button></td>
      </tr>`).join('');
    el.querySelectorAll('.view').forEach(b => b.addEventListener('click', (ev) => {
      const idx = Number(ev.currentTarget.dataset.idx);
      const invData = read('wb_invoices')[idx];
      if (!invData) return;
      const html = `<html><head><title>${escapeHtml(invData.invNo)}</title></head><body><pre>${escapeHtml(JSON.stringify(invData,null,2))}</pre></body></html>`;
      const w = window.open('', '_blank'); w.document.write(html); w.document.close();
    }));
  }

  // ---- Utilities ----
  function downloadBlob(text, filename, type) {
    const blob = new Blob([text], { type: type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function escapeCsv(s) { if (s == null) return ''; s = String(s); if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`; return s; }

  // ---- Setup UI bindings depending on page ----
  function setupEventHandlers() {
    // Masters page
    const addCustomerBtn = $('#addCustomerBtn');
    if (addCustomerBtn) addCustomerBtn.addEventListener('click', () => addCustomer($('#custName').value, $('#custContact') ? $('#custContact').value : ''));

    const addProductBtn = $('#addProductBtn');
    if (addProductBtn) addProductBtn.addEventListener('click', () => {
      addProduct($('#newProd').value, $('#newRate') ? $('#newRate').value : 0);
      // clear inputs
      if ($('#newProd')) $('#newProd').value = '';
      if ($('#newRate')) $('#newRate').value = '';
    });

    // Invoice page
    const addLineBtn = $('#addLine');
    if (addLineBtn) addLineBtn.addEventListener('click', () => {
      const tbody = $('#items');
      if (!tbody) return;
      tbody.appendChild(createEmptyRow());
      recalcAll();
      refreshProductOptions();
    });

    const saveInvBtn = $('#saveInvoice');
    if (saveInvBtn) saveInvBtn.addEventListener('click', saveInvoice);

    const previewBtn = $('#previewBtn');
    if (previewBtn) previewBtn.addEventListener('click', previewInvoice);

    const exportCSVBtn = $('#exportCSVBtn');
    if (exportCSVBtn) exportCSVBtn.addEventListener('click', exportAllCSV);

    // ensure invoice page has at least one row
    if ($('#items') && !$('#items').children.length) {
      $('#items').appendChild(createEmptyRow());
    }
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', function () {
    renderMasters();
    loadBuyersIntoSelect();
    renderDashboard();
    renderHistory();
    setupEventHandlers();
    refreshProductOptions();
    // mark active nav link (visual)
    $$('.nav-link').forEach(a => {
      try { if (a.href && a.href.split('/').pop() === location.pathname.split('/').pop()) a.classList.add('active'); } catch(e){}
    });
  });

  // expose helpers for dev console
  window._wb = { read, write, addCustomer, addProduct, recalcAll, saveInvoice, exportAllCSV, refreshProductOptions };
})();
