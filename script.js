/* ==========================================================================
   Daily Bake — script.js
   ใช้ร่วมกันทุกหน้า: ตรวจจาก element ที่มีอยู่ในหน้านั้นๆ ว่าต้องรัน logic ไหน
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.getElementById('ordersTable')) initAdminPage();
});


/* ==========================================================================
   1. product.html — โหลดสินค้า, กรองตาม mood, ปุ่มสั่งซื้อ
   ========================================================================== */
function initProductPage() {
  const moodLabel = {
    chocolate: 'Chocolate',
    strawberry: 'Strawberry',
    vanilla: 'Vanilla',
    matcha: 'Matcha'
  };

  let allProducts = [];

  async function loadProducts() {
    const listEl = document.getElementById('product-list');
    try {
      const res = await fetch('products.json');
      allProducts = await res.json();
      renderProducts(allProducts);
    } catch (err) {
      console.error(err);
      listEl.innerHTML = '<p class="empty-state">ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
    }
  }

  function renderProducts(products) {
    const listEl = document.getElementById('product-list');
    listEl.innerHTML = '';

    if (!products.length) {
      listEl.innerHTML = '<p class="empty-state">ไม่พบสินค้าในหมวดนี้</p>';
      return;
    }

    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.setAttribute('data-mood', p.mood);

      const itemLabel = `${p.name} ${p.size}`;
      const orderUrl = `order.html?item=${encodeURIComponent(itemLabel)}&price=${encodeURIComponent(p.price)}`;

      card.innerHTML = `
        <span class="product-tag">${moodLabel[p.mood] || p.mood}</span>
        <div class="product-image">
          <img src="${p.image}" alt="${p.name} ${p.size}" loading="lazy" />
        </div>
        <div class="product-body">
          <h3 class="product-name">${p.name}</h3>
          <span class="product-size">ไซส์ ${p.size}</span>
          <div class="product-footer">
            <span class="product-price">฿${p.price}</span>
            <a class="order-btn" href="${orderUrl}">สั่งซื้อ</a>
          </div>
        </div>
      `;
      listEl.appendChild(card);
    });
  }

  function applyFilter(mood) {
    const filtered = mood === 'all' ? allProducts : allProducts.filter(p => p.mood === mood);
    renderProducts(filtered);

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mood === mood);
    });
  }

  const filterBar = document.getElementById('filter-bar');
  if (filterBar) {
    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      applyFilter(btn.dataset.mood);
    });
  }

  (async function init() {
    await loadProducts();

    const params = new URLSearchParams(window.location.search);
    const moodParam = params.get('mood');
    if (moodParam && ['chocolate', 'strawberry', 'vanilla', 'matcha'].includes(moodParam)) {
      applyFilter(moodParam);
    }
  })();
}


/* ==========================================================================
   2. order.html — เติมข้อมูลจาก URL parameter, ส่งฟอร์มไป Apps Script
   ========================================================================== */
function initOrderPage() {
  // เติมข้อมูลจาก URL parameter ทันทีที่โหลดหน้า
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');

  if (item) {
    document.getElementById('items').value = item;
  }
  if (price) {
    document.getElementById('total').value = price;
  }

  document.getElementById('orderForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังส่งคำสั่งซื้อ...';

    fetch('https://script.google.com/macros/s/AKfycbw9fRKfS4x6EByfTGMVQkvK_kvPjVXTRBl1eGobQ8l9_O2t0BJFbip60kA-NmulIJfvwQ/exec', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(() => {
        window.location.href = 'thankyou.html';
      })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      });
  });
}


/* ==========================================================================
   3. admin.html — โหลด CSV จาก Google Sheet, parse เอง, render ตาราง
   ========================================================================== */
function initAdminPage() {
  const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcHCSg2vb3jqlpo4QyBwoH_0DUBhM6oqYh2FglLjWOfHUfW1vwVUrvvyC0KDrrKbA0cTSscOurv9To/pub?output=csv';

  // Custom CSV parser — รองรับ field ที่ครอบด้วย " และมี comma / newline อยู่ข้างใน
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (insideQuotes) {
        if (char === '"' && nextChar === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          insideQuotes = false;
        } else {
          field += char;
        }
      } else {
        if (char === '"') {
          insideQuotes = true;
        } else if (char === ',') {
          row.push(field);
          field = '';
        } else if (char === '\n') {
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
        } else if (char === '\r') {
          // ข้าม \r เดี๋ยวไป handle ตอนเจอ \n
        } else {
          field += char;
        }
      }
    }

    // field/row สุดท้ายที่ไม่มี newline ปิดท้าย
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter(r => r.some(cell => cell.trim() !== ''));
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderTable(rows) {
    const theadRow = document.getElementById('tableHeadRow');
    const tbody = document.querySelector('#ordersTable tbody');

    if (!rows.length) {
      if (theadRow) theadRow.innerHTML = '';
      tbody.innerHTML = '<tr><td class="status-msg">ยังไม่มีคำสั่งซื้อ</td></tr>';
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1).reverse(); // เรียงจากรายการล่าสุดขึ้นก่อน

    if (theadRow) {
      theadRow.innerHTML = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    }

    if (!dataRows.length) {
      tbody.innerHTML = `<tr><td colspan="${headers.length}" class="status-msg">ยังไม่มีคำสั่งซื้อ</td></tr>`;
      return;
    }

    tbody.innerHTML = dataRows.map(r => {
      const cells = headers.map((_, i) => `<td>${escapeHtml(r[i] || '')}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
  }

  async function loadOrders() {
    const tbody = document.querySelector('#ordersTable tbody');
    tbody.innerHTML = '<tr><td class="status-msg">กำลังโหลดข้อมูล...</td></tr>';

    try {
      const res = await fetch(CSV_URL);
      const text = await res.text();
      const rows = parseCSV(text);
      renderTable(rows);
    } catch (err) {
      console.error(err);
      tbody.innerHTML = '<tr><td class="status-msg">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง</td></tr>';
    }
  }

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadOrders);
  }

  loadOrders();
}
