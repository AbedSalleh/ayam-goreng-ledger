// ============================================================
// 📦 AyamInventory — Inventory data fetching & UI management
// Handles stock CRUD, search filters, and quick adjustments
// ============================================================

const AyamInventory = (() => {
  let inventoryItems = [];
  let isSaving = false;

  /**
   * Helper: safely get an element by ID.
   */
  function $(id) {
    return document.getElementById(id);
  }

  /**
   * Format the last-updated date into a nice short format.
   * @param {string} dateStr
   * @returns {string} e.g. "30 May, 12:45 PM"
   */
  function formatTimestampShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    
    return `${d.getDate()} ${months[d.getMonth()]}, ${hours}:${minutes} ${ampm}`;
  }

  return {
    /**
     * Load inventory items from Google Sheets and render them.
     */
    async load() {
      const loading = $('inventory-loading');
      const list = $('inventory-list');

      if (loading) loading.classList.remove('hidden');
      
      try {
        const rows = await AyamSheets.getInventoryData();
        
        inventoryItems = rows.map(row => ({
          name: row[0] || '',
          quantity: parseFloat(row[1]) || 0,
          unit: row[2] || '',
          minAlert: parseFloat(row[3]) || 0,
          notes: row[4] || '',
          timestamp: row[5] || ''
        }));

        this.renderItems();
      } catch (e) {
        console.error('Load inventory error:', e);
        if (typeof AyamApp !== 'undefined') {
          AyamApp.showToast('Failed to load inventory.', 'error');
        }
      } finally {
        if (loading) loading.classList.add('hidden');
      }
    },

    /**
     * Render inventory items list.
     */
    renderItems() {
      const list = $('inventory-list');
      if (!list) return;

      list.innerHTML = '';

      const query = (($('inventory-search') || {}).value || '').trim().toLowerCase();
      const filtered = inventoryItems.filter(item => 
        item.name.toLowerCase().includes(query) || 
        item.notes.toLowerCase().includes(query)
      );

      if (filtered.length === 0) {
        list.innerHTML = `
          <div class="empty-state text-sm py-8 text-center text-gray-400 flex flex-col items-center">
            <svg class="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
            </svg>
            <span>${query ? 'No matching items found.' : 'No items in stock. Add your first item!'}</span>
          </div>
        `;
        return;
      }

      // Sort alphabetically by name
      filtered.sort((a, b) => a.name.localeCompare(b.name));

      filtered.forEach((item, index) => {
        const isLow = item.quantity <= item.minAlert;
        
        const row = document.createElement('div');
        row.className = 'flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50/50 border border-slate-200/85 rounded-2xl gap-3 animate-fadeIn';
        row.style.animationDelay = `${index * 50}ms`;

        // Left section: Details
        const details = document.createElement('div');
        details.className = 'flex-1 min-w-0';

        const titleRow = document.createElement('div');
        titleRow.className = 'flex items-center gap-2 flex-wrap mb-1';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'font-bold text-gray-800 text-base';
        nameSpan.textContent = item.name;
        titleRow.appendChild(nameSpan);

        if (isLow) {
          const alertBadge = document.createElement('span');
          alertBadge.className = 'px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-full animate-pulse flex items-center gap-1';
          alertBadge.innerHTML = 'Low Stock';
          titleRow.appendChild(alertBadge);
        }

        const notesDiv = document.createElement('div');
        notesDiv.className = 'text-xs text-gray-500 line-clamp-1 mb-1';
        notesDiv.textContent = item.notes || 'No description';

        const dateDiv = document.createElement('div');
        dateDiv.className = 'text-[10px] text-gray-400';
        dateDiv.textContent = item.timestamp ? `Updated: ${formatTimestampShort(item.timestamp)}` : 'Never updated';

        details.appendChild(titleRow);
        details.appendChild(notesDiv);
        details.appendChild(dateDiv);

        // Right section: Controls
        const controls = document.createElement('div');
        controls.className = 'flex items-center justify-between sm:justify-end gap-3';

        // Quick adjustment controls
        const adjContainer = document.createElement('div');
        adjContainer.className = 'flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm';

        // Minus button
        const btnMinus = document.createElement('button');
        btnMinus.className = 'w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-brand-600 hover:bg-brand-50 active:scale-90 transition-all font-bold';
        btnMinus.textContent = '−';
        btnMinus.onclick = () => this.adjustQuantity(item.name, -1);

        // Qty Display
        const qtySpan = document.createElement('span');
        qtySpan.className = 'text-sm font-bold text-gray-700 px-3 min-w-[64px] text-center tabular-nums';
        qtySpan.textContent = `${item.quantity} ${item.unit}`;

        // Plus button
        const btnPlus = document.createElement('button');
        btnPlus.className = 'w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-brand-600 hover:bg-brand-50 active:scale-90 transition-all font-bold';
        btnPlus.textContent = '+';
        btnPlus.onclick = () => this.adjustQuantity(item.name, 1);

        adjContainer.appendChild(btnMinus);
        adjContainer.appendChild(qtySpan);
        adjContainer.appendChild(btnPlus);

        // Actions: Edit & Delete
        const actions = document.createElement('div');
        actions.className = 'flex items-center gap-1.5';

        // Edit Button
        const btnEdit = document.createElement('button');
        btnEdit.className = 'p-2 rounded-xl text-gray-400 hover:text-brand-600 hover:bg-brand-50 active:scale-90 transition-all';
        btnEdit.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        `;
        btnEdit.title = 'Edit item';
        btnEdit.onclick = () => this.openModal(item);

        // Delete Button
        const btnDelete = document.createElement('button');
        btnDelete.className = 'p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 active:scale-90 transition-all';
        btnDelete.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        `;
        btnDelete.title = 'Delete item';
        btnDelete.onclick = () => this.deleteItem(item.name);

        actions.appendChild(btnEdit);
        actions.appendChild(btnDelete);

        controls.appendChild(adjContainer);
        controls.appendChild(actions);

        row.appendChild(details);
        row.appendChild(controls);
        list.appendChild(row);
      });
    },

    /**
     * Handle live filtering of items.
     */
    filterItems() {
      this.renderItems();
    },

    /**
     * Open the Add / Edit inventory item modal.
     * @param {object|null} item - Item to edit, or null for new item.
     */
    openModal(item = null) {
      const modal = $('inventory-modal');
      const title = $('inventory-modal-title');
      const oldName = $('inventory-old-name');
      const nameInput = $('inventory-name');
      const qtyInput = $('inventory-qty');
      const unitInput = $('inventory-unit');
      const alertInput = $('inventory-alert');
      const notesInput = $('inventory-notes');

      if (!modal) return;

      if (item) {
        // Edit mode
        title.innerHTML = `
          <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          Edit Stock Item
        `;
        oldName.value = item.name;
        nameInput.value = item.name;
        qtyInput.value = item.quantity;
        unitInput.value = item.unit;
        alertInput.value = item.minAlert;
        notesInput.value = item.notes;
      } else {
        // Add mode
        title.innerHTML = `
          <svg class="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
          </svg>
          Add Stock Item
        `;
        oldName.value = '';
        nameInput.value = '';
        qtyInput.value = '';
        unitInput.value = 'kg'; // sensible default
        alertInput.value = '0';
        notesInput.value = '';
      }

      modal.classList.remove('hidden');
      modal.classList.add('flex');
    },

    /**
     * Close the modal.
     */
    closeModal() {
      const modal = $('inventory-modal');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    },

    /**
     * Submit handler for Add / Edit form.
     */
    async saveItem() {
      if (isSaving) return;

      const oldName = $('inventory-old-name').value;
      const name = $('inventory-name').value.trim();
      const qty = parseFloat($('inventory-qty').value);
      const unit = $('inventory-unit').value.trim();
      const minAlert = parseFloat($('inventory-alert').value) || 0;
      const notes = $('inventory-notes').value.trim();

      if (!name) {
        AyamApp.showToast('Please enter an item name', 'error');
        return;
      }
      if (isNaN(qty) || qty < 0) {
        AyamApp.showToast('Please enter a valid stock quantity', 'error');
        return;
      }
      if (!unit) {
        AyamApp.showToast('Please enter a unit of measurement', 'error');
        return;
      }

      const btn = $('btn-save-inventory');
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Saving...';
      isSaving = true;

      try {
        await AyamSheets.saveInventoryItem({
          originalName: oldName || undefined,
          name,
          quantity: qty,
          unit,
          minAlert,
          notes
        });

        AyamApp.showToast(oldName ? 'Item updated successfully.' : 'Item added successfully.', 'success');
        this.closeModal();
        await this.load();
        
        // Reload dashboard to sync stock alert banners
        if (typeof AyamDashboard !== 'undefined') {
          AyamDashboard.load();
        }
      } catch (e) {
        console.error('Save inventory item error:', e);
        AyamApp.showToast(e.message || 'Failed to save item', 'error');
      } finally {
        isSaving = false;
        btn.disabled = false;
        btn.textContent = originalText;
      }
    },

    /**
     * Increment or decrement quantity of an item optimistically.
     * @param {string} name
     * @param {number} delta
     */
    async adjustQuantity(name, delta) {
      const idx = inventoryItems.findIndex(item => item.name === name);
      if (idx === -1) return;

      const item = inventoryItems[idx];
      const oldQty = item.quantity;
      const newQty = Math.max(0, oldQty + delta);

      if (newQty === oldQty) return;

      // Optimistic update
      item.quantity = newQty;
      item.timestamp = new Date().toISOString();
      this.renderItems();

      try {
        await AyamSheets.updateInventoryQuantity(name, newQty);
        // Refresh dashboard stock alerts
        if (typeof AyamDashboard !== 'undefined') {
          AyamDashboard.load();
        }
      } catch (e) {
        console.error('Adjust stock quantity error:', e);
        AyamApp.showToast('Failed to save stock change.', 'error');
        
        // Rollback on error
        item.quantity = oldQty;
        this.renderItems();
      }
    },

    /**
     * Delete an inventory item.
     * @param {string} name
     */
    async deleteItem(name) {
      if (!confirm(`Are you sure you want to delete "${name}" from stock?`)) {
        return;
      }

      try {
        await AyamSheets.deleteInventoryItem(name);
        AyamApp.showToast('Item deleted successfully', 'success');
        await this.load();
        
        if (typeof AyamDashboard !== 'undefined') {
          AyamDashboard.load();
        }
      } catch (e) {
        console.error('Delete inventory item error:', e);
        AyamApp.showToast('Failed to delete item.', 'error');
      }
    }
  };
})();
