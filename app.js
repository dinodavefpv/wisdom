// Medicine Tracker State
let doseHistory = JSON.parse(localStorage.getItem('wisdomMedicineHistory')) || [];
let medicineConfig = JSON.parse(localStorage.getItem('wisdomMedicineConfig')) || [
    { id: 'norco', name: 'Norco', emoji: '💊', color: '#ef4444' },
    { id: 'acetaminophen', name: 'Acetaminophen', emoji: '🟠', color: '#f97316' },
    { id: 'ibuprofen', name: 'Ibuprofen', emoji: '🔵', color: '#3b82f6' },
    { id: 'amoxicillin', name: 'Amoxicillin', emoji: '🦠', color: '#22c55e' },
    { id: 'ondansetron', name: 'Ondansetron', emoji: '🤢', color: '#a855f7' },
    { id: 'chlorhexidine', name: 'Chlorhexidine', emoji: '💧', color: '#14b8a6' },
    { id: 'nicotine', name: 'Nicotine Patch', emoji: '🩹', color: '#6b7280' },
    { id: 'quetiapine', name: 'Quetiapine', emoji: '😴', color: '#eab308' },
    { id: 'lorazepam', name: 'Lorazepam', emoji: '🧘', color: '#6366f1' },
    { id: 'adderall', name: 'Adderall', emoji: '⚡', color: '#f97316' }
];
let isPastTimeMode = false;

// FIX: Check for "Pain Killer" accidental rename and revert to "Norco"
(function fixNorco() {
    let changed = false;
    const norco = medicineConfig.find(m => m.id === 'norco');
    if (norco && norco.name === 'Pain Killer') {
        norco.name = 'Norco';
        changed = true;
    }
    if (changed) {
        localStorage.setItem('wisdomMedicineConfig', JSON.stringify(medicineConfig));
        console.log("Fixed 'Pain Killer' back to 'Norco' in config.");
    }
})();

// DOM Elements
const historyBody = document.getElementById('history-body');
const emptyState = document.getElementById('empty-state');
const toastEl = document.getElementById('toast');
const actionButtonsContainer = document.querySelector('.action-buttons');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const editBtn = document.querySelector('.edit-list-btn');
    if (editBtn) editBtn.disabled = true;

    renderActionButtons();
    renderHistory();

    loadFromAirtable(); // Load history asynchronously

    // Load medicine config and wait for it
    await loadMedicineConfigFromAirtable();

    if (editBtn) editBtn.disabled = false;
});

function renderActionButtons() {
    if (!actionButtonsContainer) return;
    actionButtonsContainer.innerHTML = '';

    medicineConfig.filter(med => med.visibility !== false).forEach(med => {
        const btn = document.createElement('button');
        btn.className = 'dose-btn';
        btn.style.setProperty('--med-color', med.color);

        // Convert hex to rgb for rgba usage in CSS
        const rgb = hexToRgb(med.color);
        if (rgb) {
            btn.style.setProperty('--med-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        }

        btn.onclick = () => logMedicine(med.name);

        btn.innerHTML = `
            <span class="emoji">${med.emoji}</span>
            <div class="btn-text">
                <span class="med-name">${med.name}</span>
            </div>
        `;

        actionButtonsContainer.appendChild(btn);
    });
}

// Main Logging Function
function logMedicine(medicineName) {
    let now = new Date();

    if (isPastTimeMode) {
        const selectedDayEl = document.querySelector('.day-selector .day.selected');
        // Get local date string matching YYYY-MM-DD
        const nowLocal = new Date();
        const offset = nowLocal.getTimezoneOffset() * 60000;
        const nowLocalStr = (new Date(nowLocal.getTime() - offset)).toISOString().split('T')[0];
        const selectedDateStr = selectedDayEl ? selectedDayEl.dataset.date : nowLocalStr;

        const { hour, minute, ampm } = getSelectedTime();

        let targetHour = parseInt(hour, 10);
        if (ampm === 'PM' && targetHour < 12) targetHour += 12;
        if (ampm === 'AM' && targetHour === 12) targetHour = 0;

        const formattedHour = String(targetHour).padStart(2, '0');
        const formattedMinute = String(minute).padStart(2, '0');

        now = new Date(`${selectedDateStr}T${formattedHour}:${formattedMinute}:00`);
    }

    const doseEvent = {
        id: Date.now().toString(),
        name: medicineName,
        timestamp: now.toISOString(),
        dateStr: now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        timeStr: now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    };

    doseHistory.push(doseEvent);
    doseHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort newest first

    saveHistory();
    renderHistory();
    showToast(`Logged ${medicineName}`);

    // Sync to Airtable asynchronously
    syncToAirtable(doseEvent);
}

// Past Time Toggle
let timePickerInitialized = false;

function togglePastTime() {
    isPastTimeMode = !isPastTimeMode;
    const container = document.getElementById('past-time-container');
    const btn = document.getElementById('time-toggle-btn');

    if (isPastTimeMode) {
        container.classList.remove('hidden');
        btn.classList.add('active');

        if (!timePickerInitialized) {
            setupDaySelector();
            initializeTimePicker();
            timePickerInitialized = true;
        }
    } else {
        container.classList.add('hidden');
        btn.classList.remove('active');
    }
}

// Helper for Medicine Color
function getMedicineColor(name) {
    const med = medicineConfig.find(m => m.name === name);
    return med ? med.color : 'var(--text-primary)';
}

// Render Table
function renderHistory() {
    historyBody.innerHTML = '';

    renderTimeline();

    if (doseHistory.length === 0) {
        emptyState.classList.add('active');
        return;
    }

    emptyState.classList.remove('active');

    doseHistory.forEach(dose => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => openEditModal(dose.id);

        // Date cell
        const tdDate = document.createElement('td');
        tdDate.className = 'date-col';
        tdDate.textContent = dose.dateStr;

        // Time cell
        const tdTime = document.createElement('td');
        tdTime.className = 'time-col';
        tdTime.textContent = dose.timeStr;

        // Medicine name cell
        const tdMed = document.createElement('td');
        tdMed.className = 'med-col';
        const medChip = document.createElement('span');
        medChip.className = 'med-chip';

        const color = getMedicineColor(dose.name);
        const rgb = hexToRgb(color) || { r: 255, g: 255, b: 255 }; // fallback

        // Dynamic styles for chip
        medChip.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
        medChip.style.color = color;

        medChip.textContent = dose.name;
        tdMed.appendChild(medChip);

        // Action cell (delete)
        const tdAction = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-row-btn';
        deleteBtn.innerHTML = '<i data-feather="x"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteDose(dose.id);
        };
        deleteBtn.title = "Remove entry";
        tdAction.appendChild(deleteBtn);

        tr.appendChild(tdDate);
        tr.appendChild(tdTime);
        tr.appendChild(tdMed);
        tr.appendChild(tdAction);

        historyBody.appendChild(tr);
    });

    // Re-initialize feather icons for newly added elements
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

// Render Timeline View
function renderTimeline() {
    const container = document.getElementById('timeline-container');
    if (!container) return; // safeguard

    container.innerHTML = '';

    if (doseHistory.length === 0) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');

    // Group by dateStr (doseHistory is already sorted newest first)
    const grouped = {};
    // We want to display days in order, potentially oldest to newest or newest to oldest.
    // If we rely on insertion order of keys in JS for strings, it will be the order they appear in the array.
    doseHistory.forEach(dose => {
        if (!grouped[dose.dateStr]) grouped[dose.dateStr] = [];
        grouped[dose.dateStr].push(dose);
    });

    // Sort dates chronologically (Earliest -> Latest)
    const groupedArray = Object.entries(grouped);
    groupedArray.sort((a, b) => {
        // Use the timestamp of the first dose in the group for comparison
        // Note: doseHistory is Newest->Oldest, so index 0 is the newest dose of that day
        const timeA = new Date(a[1][0].timestamp);
        const timeB = new Date(b[1][0].timestamp);
        return timeA - timeB;
    });

    for (const [dateStr, doses] of groupedArray) {
        const row = document.createElement('div');
        row.className = 'timeline-row';

        const dateEl = document.createElement('div');
        dateEl.className = 'timeline-date';
        dateEl.textContent = dateStr;

        const wrapper = document.createElement('div');
        wrapper.className = 'timeline-bar-wrapper';

        const bar = document.createElement('div');
        bar.className = 'timeline-bar';

        // Sort doses chronologically for clustering
        doses.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const clusters = [];
        doses.forEach(dose => {
            if (clusters.length === 0) {
                clusters.push([dose]);
            } else {
                const currentCluster = clusters[clusters.length - 1];
                const lastDose = currentCluster[currentCluster.length - 1];
                const diffMinutes = Math.abs(new Date(dose.timestamp) - new Date(lastDose.timestamp)) / 60000;

                // Group if within 30 minutes
                if (diffMinutes <= 30) {
                    currentCluster.push(dose);
                } else {
                    clusters.push([dose]);
                }
            }
        });

        clusters.forEach(cluster => {
            // Deduplicate medicines within the cluster
            const uniqueMeds = {};
            const clusterDoses = [];
            cluster.forEach(d => {
                if (!uniqueMeds[d.name]) {
                    uniqueMeds[d.name] = true;
                    clusterDoses.push(d);
                }
            });

            // Calculate percentage based on the first dose of the cluster
            const dateObj = new Date(clusterDoses[0].timestamp);
            const hours = dateObj.getHours();
            const minutes = dateObj.getMinutes();
            const percent = ((hours * 60 + minutes) / (24 * 60)) * 100;

            const clusterEl = document.createElement('div');
            clusterEl.className = 'timeline-cluster';
            clusterEl.style.left = `${percent}%`;

            clusterDoses.forEach((dose, index) => {
                const dot = document.createElement('div');
                dot.className = 'timeline-dot';
                dot.style.backgroundColor = getMedicineColor(dose.name);
                dot.title = `${dose.name} at ${dose.timeStr}`;
                dot.style.zIndex = clusterDoses.length - index;
                clusterEl.appendChild(dot);
            });

            bar.appendChild(clusterEl);
        });

        wrapper.appendChild(bar);
        row.appendChild(dateEl);
        row.appendChild(wrapper);
        container.appendChild(row);
    }
}

// Delete Single Dose
function deleteDose(id) {
    const dose = doseHistory.find(d => d.id === id);
    if (!dose) return;

    doseHistory = doseHistory.filter(d => d.id !== id);
    saveHistory();
    renderHistory();
    // showToast('Dose removed'); // Optional feedback

    if (dose.airtableId) {
        deleteFromAirtable(dose.airtableId);
    }
}

// Clear All History
let confirmClearTimeout;
async function clearHistory() {
    if (doseHistory.length === 0) return;

    // Simple double-click logic for clearing history since native confirm is disabled
    const clearBtn = document.querySelector('.clear-btn');
    if (!clearBtn.classList.contains('confirming')) {
        clearBtn.classList.add('confirming');
        // Visual indicator that we are waiting for a second click
        clearBtn.style.color = 'var(--accent-red)';
        showToast('Click again to clear history');

        clearTimeout(confirmClearTimeout);
        confirmClearTimeout = setTimeout(() => {
            clearBtn.classList.remove('confirming');
            clearBtn.style.color = '';
        }, 3000);
        return;
    }

    clearBtn.classList.remove('confirming');
    clearBtn.style.color = '';

    const idsToDelete = doseHistory.map(d => d.airtableId).filter(id => id);
    doseHistory = [];
    saveHistory();
    renderHistory();
    showToast('History cleared');

    for (let i = 0; i < idsToDelete.length; i += 10) {
        const chunk = idsToDelete.slice(i, i + 10);
        const queryParams = chunk.map(id => `records[]=${id}`).join('&');
        try {
            await fetch(`https://api.airtable.com/v0/appPOZzZ2SieNO8lf/tblh43hkDNgA9lKi4?${queryParams}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer patguU4AQxNO1AQzp.a0a637c47eefb850813cb4e564f5238d0acca68ef1f72b357283ad8dd46236ea'
                }
            });
        } catch (err) {
            console.error("Error bulk deleting from Airtable:", err);
        }
    }
}

// Helper: Save to LocalStorage
function saveHistory() {
    localStorage.setItem('wisdomMedicineHistory', JSON.stringify(doseHistory));
}

// Helper: Show Toast Notification
let toastTimeout;
function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('show');
    }, 3000);
}

// Helper: Sync to Airtable
async function syncToAirtable(dose) {
    const url = 'https://api.airtable.com/v0/appPOZzZ2SieNO8lf/tblh43hkDNgA9lKi4';
    const payload = {
        records: [
            {
                fields: {
                    "Medicine": dose.name,
                    "Date": dose.dateStr,
                    "Time": dose.timeStr,
                    "timestamp": dose.timestamp
                }
            }
        ],
        typecast: true
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer patguU4AQxNO1AQzp.a0a637c47eefb850813cb4e564f5238d0acca68ef1f72b357283ad8dd46236ea',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error('Airtable sync failed:', await response.text());
        } else {
            const data = await response.json();
            dose.airtableId = data.records[0].id;
            saveHistory();
            console.log('Successfully synced dose to Airtable');
        }
    } catch (err) {
        console.error('Error syncing to Airtable:', err);
    }
}

// Helper: Delete from Airtable
async function deleteFromAirtable(airtableId) {
    const url = `https://api.airtable.com/v0/appPOZzZ2SieNO8lf/tblh43hkDNgA9lKi4/${airtableId}`;
    try {
        await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer patguU4AQxNO1AQzp.a0a637c47eefb850813cb4e564f5238d0acca68ef1f72b357283ad8dd46236ea'
            }
        });
    } catch (err) {
        console.error('Error deleting from Airtable:', err);
    }
}

// Helper: Load from Airtable
async function loadFromAirtable() {
    const url = 'https://api.airtable.com/v0/appPOZzZ2SieNO8lf/tblh43hkDNgA9lKi4';
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': 'Bearer patguU4AQxNO1AQzp.a0a637c47eefb850813cb4e564f5238d0acca68ef1f72b357283ad8dd46236ea'
            }
        });
        if (response.ok) {
            const data = await response.json();
            doseHistory = data.records.map(record => {
                let medName = record.fields.Medicine;
                // Fix for accidental rename if present in Airtable
                if (medName === 'Pain Killer') medName = 'Norco';

                return {
                    id: record.id,
                    airtableId: record.id,
                    name: medName,
                    timestamp: record.fields.timestamp || new Date().toISOString(),
                    dateStr: record.fields.Date,
                    timeStr: record.fields.Time
                };
            });
            doseHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            saveHistory();
            renderHistory();
        }
    } catch (err) {
        console.error('Error loading from Airtable:', err);
    }
}

// ============================================
// EDIT MODAL LOGIC
// ============================================

const editModal = document.getElementById('edit-modal');
const editMedicineInput = document.getElementById('edit-medicine');
const editDateInput = document.getElementById('edit-date');
const editTimeInput = document.getElementById('edit-time');
const editIdInput = document.getElementById('edit-id');

function openEditModal(id) {
    const dose = doseHistory.find(d => d.id === id);
    if (!dose) return;

    // Populate select options dynamically
    editMedicineInput.innerHTML = '';
    medicineConfig.forEach(med => {
        const option = document.createElement('option');
        option.value = med.name;
        option.textContent = med.name;
        editMedicineInput.appendChild(option);
    });

    // Check if current dose name is in the list, if not add it temporarily
    if (!medicineConfig.find(m => m.name === dose.name)) {
        const option = document.createElement('option');
        option.value = dose.name;
        option.textContent = dose.name + " (Archived)";
        editMedicineInput.appendChild(option);
    }

    editIdInput.value = dose.id;
    editMedicineInput.value = dose.name;

    // Parse timestamp for inputs
    const date = new Date(dose.timestamp);
    // Adjust for local time
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);

    editDateInput.value = localDate.toISOString().split('T')[0];
    editTimeInput.value = localDate.toISOString().split('T')[1].substring(0, 5);

    editModal.classList.remove('hidden');
}

function closeEditModal() {
    editModal.classList.add('hidden');
}

function saveEditDose() {
    const id = editIdInput.value;
    const name = editMedicineInput.value;
    const dateVal = editDateInput.value;
    const timeVal = editTimeInput.value;

    if (!dateVal || !timeVal) {
        showToast("Please enter date and time");
        return;
    }

    const dose = doseHistory.find(d => d.id === id);
    if (!dose) return;

    // Construct new timestamp
    const newDate = new Date(`${dateVal}T${timeVal}:00`);

    // Update dose object
    dose.name = name;
    dose.timestamp = newDate.toISOString();
    dose.dateStr = newDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    dose.timeStr = newDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    // Re-sort
    doseHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    saveHistory();
    renderHistory();
    closeEditModal();
    showToast("Dose updated");

    // Sync to Airtable
    if (dose.airtableId) {
        syncUpdateToAirtable(dose);
    } else {
        syncToAirtable(dose);
    }
}

// ============================================
// EDIT MEDICINE LIST MODAL LOGIC
// ============================================

const editListModal = document.getElementById('edit-list-modal');
const medicineListContainer = document.getElementById('medicine-list-container');
let tempMedicineConfig = [];
let dragSrcEl = null;

function openEditListModal() {
    // Clone config to temp
    tempMedicineConfig = JSON.parse(JSON.stringify(medicineConfig));
    renderEditList();
    editListModal.classList.remove('hidden');
}

function closeEditListModal() {
    editListModal.classList.add('hidden');
}

function renderEditList() {
    medicineListContainer.innerHTML = '';

    tempMedicineConfig.forEach((med, index) => {
        const medItem = document.createElement('div');
        const hiddenClass = med.visibility === false ? ' hidden-med' : '';
        medItem.className = `med-item${hiddenClass}`;
        medItem.draggable = true;
        medItem.dataset.index = index;

        // Set dynamic border color
        medItem.style.setProperty('--med-item-border', med.color);

        // Drag events
        medItem.addEventListener('dragstart', handleDragStart);
        medItem.addEventListener('dragover', handleDragOver);
        medItem.addEventListener('dragenter', handleDragEnter);
        medItem.addEventListener('dragleave', handleDragLeave);
        medItem.addEventListener('drop', handleDrop);
        medItem.addEventListener('dragend', handleDragEnd);

        // Header
        const header = document.createElement('div');
        header.className = 'med-header';
        header.onclick = (e) => toggleMedDetails(medItem, e);

        const visibilityClass = med.visibility !== false ? 'icon-visibility' : 'icon-visibility-off';

        header.innerHTML = `
            <div class="drag-handle">☰</div>
            <div class="med-emoji">${med.emoji}</div>
            <div class="med-label">${med.name}</div>
            <button type="button" class="visibility-toggle" onclick="toggleMedVisibility(event, ${index})">
                <div class="icon-mask ${visibilityClass}"></div>
            </button>
            <button class="expand-btn">▼</button>
        `;

        // Details View
        const details = document.createElement('div');
        details.className = 'med-details';

        // Edit Mode Content (Visible by default)
        const editContent = document.createElement('div');
        editContent.className = 'med-edit-form';
        // Content populated when Edit is clicked to preserve state properly if needed,
        // but here we can pre-populate.
        // Replaced native input with button that triggers modal
        editContent.innerHTML = `
             <div class="form-group">
                <label>Name</label>
                <input type="text" class="med-edit-input name-input" value="${med.name}">
            </div>
             <div class="form-group">
                <label>Emoji</label>
                <input type="text" class="med-edit-input emoji-input" value="${med.emoji}" maxlength="2">
            </div>
            <div class="form-group">
                <label>Color</label>
                <button type="button" class="color-picker-trigger" style="background-color: ${med.color}" onclick="openColorPickerModal(this)">
                     <span class="color-value-text">${med.color}</span>
                </button>
                <input type="hidden" class="med-edit-input color-input" value="${med.color}">
            </div>
            <div class="med-item-actions">
                <button class="med-item-btn" onclick="collapseItem(this)">Cancel</button>
                <button class="med-item-btn primary" onclick="saveItemChanges(this, ${index})">Save</button>
            </div>
        `;

        details.appendChild(editContent);
        medItem.appendChild(header);
        medItem.appendChild(details);

        medicineListContainer.appendChild(medItem);
    });
}

function toggleMedVisibility(e, index) {
    e.stopPropagation();
    const med = tempMedicineConfig[index];
    med.visibility = med.visibility === false ? true : false;
    renderEditList();
    persistMedicineConfiguration();
}

function toggleMedDetails(item, e) {
    // Prevent toggling if clicking buttons inside header if any (though currently only expand btn)
    // or if dragging.
    if (e.target.closest('.drag-handle')) return;
    if (e.target.closest('.visibility-toggle')) return;

    // Close others? Optional. Let's keep multiple open support.
    item.classList.toggle('expanded');
}

function collapseItem(btn) {
    const item = btn.closest('.med-item');
    item.classList.remove('expanded');
}

function saveItemChanges(btn, index) {
    const detailsDiv = btn.closest('.med-details');
    const name = detailsDiv.querySelector('.name-input').value;
    const emoji = detailsDiv.querySelector('.emoji-input').value;
    const color = detailsDiv.querySelector('.color-input').value; // Get from hidden input

    if (!name.trim()) {
        showToast("Please enter a medicine name");
        detailsDiv.querySelector('.name-input').style.borderColor = 'var(--accent-red)';
        return;
    }

    tempMedicineConfig[index].name = name;
    tempMedicineConfig[index].emoji = emoji;
    tempMedicineConfig[index].color = color;

    // Re-render to show updated view
    // We try to keep the expanded state if possible, but full re-render is safer for consistency
    renderEditList();
    persistMedicineConfiguration();
}


// Drag and Drop Handlers
function handleDragStart(e) {
    this.style.opacity = '0.4';
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('over');
}

function handleDragLeave(e) {
    this.classList.remove('over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (dragSrcEl !== this) {
        const srcIndex = parseInt(dragSrcEl.dataset.index);
        const targetIndex = parseInt(this.dataset.index);

        // Swap in array
        // We need to move the item from src to target
        const itemToMove = tempMedicineConfig[srcIndex];
        tempMedicineConfig.splice(srcIndex, 1);
        tempMedicineConfig.splice(targetIndex, 0, itemToMove);

        renderEditList();
        persistMedicineConfiguration();
    }
    return false;
}

function addNewMedicine() {
    // Generate a temporary ID or let Airtable assign one (for now we use a temp string until sync)
    const newMed = {
        id: 'new-' + Date.now(),
        name: '',
        emoji: '💊',
        color: '#3b82f6', // Default blue
        visibility: true
    };

    tempMedicineConfig.push(newMed);
    renderEditList();

    // Auto-expand the new item to prompt editing
    setTimeout(() => {
        const items = medicineListContainer.querySelectorAll('.med-item');
        const newItemIndex = tempMedicineConfig.length - 1;
        if (items[newItemIndex]) {
            items[newItemIndex].classList.add('expanded');
            items[newItemIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 50);
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    this.classList.remove('dragging');

    const items = document.querySelectorAll('.med-item');
    items.forEach(function (item) {
        item.classList.remove('over');
    });
}

// ============================================
// CUSTOM COLOR PICKER MODAL LOGIC
// ============================================

let activeColorTriggerBtn = null;

// Predefined palette + commonly used colors
const defaultColors = [
    '#ef4444', '#f97316', '#3b82f6', '#22c55e',
    '#a855f7', '#14b8a6', '#6b7280', '#eab308',
    '#6366f1', '#ec4899', '#06b6d4', '#8b5cf6',
    '#f43f5e', '#d946ef', '#84cc16', '#10b981',
    '#5b21b6', '#9d174d', '#155e75'
];

function openColorPickerModal(triggerBtn) {
    activeColorTriggerBtn = triggerBtn;

    const modal = document.getElementById('color-picker-modal');
    const grid = document.getElementById('color-grid');
    grid.innerHTML = '';

    // Collect all colors currently in use to ensure they are available
    const usedColors = new Set(medicineConfig.map(m => m.color));
    const allColors = new Set([...defaultColors, ...usedColors]);

    allColors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;

        // Mark selected if matches current
        const currentColor = triggerBtn.querySelector('.color-value-text').textContent;
        if (color.toLowerCase() === currentColor.toLowerCase()) {
            swatch.classList.add('selected');
        }

        swatch.onclick = () => selectColor(color);
        grid.appendChild(swatch);
    });

    modal.classList.remove('hidden');
}

function closeColorPickerModal() {
    document.getElementById('color-picker-modal').classList.add('hidden');
    activeColorTriggerBtn = null;
}

function selectColor(color) {
    if (!activeColorTriggerBtn) return;

    // Update trigger button visuals
    activeColorTriggerBtn.style.backgroundColor = color;
    activeColorTriggerBtn.querySelector('.color-value-text').textContent = color;

    // Update hidden input
    const container = activeColorTriggerBtn.parentElement;
    container.querySelector('.color-input').value = color;

    closeColorPickerModal();
}

async function persistMedicineConfiguration() {
    // Identify renames
    const renames = [];
    tempMedicineConfig.forEach((newMed, i) => {
        const original = medicineConfig.find(m => m.id === newMed.id);
        if (original && original.name !== newMed.name) {
            renames.push({
                from: original.name,
                to: newMed.name
            });
        }
    });

    // Update config
    medicineConfig = JSON.parse(JSON.stringify(tempMedicineConfig)).filter(m => m.name && m.name.trim().length > 0);
    localStorage.setItem('wisdomMedicineConfig', JSON.stringify(medicineConfig));

    // Process renames in history
    let historyChanged = false;
    const dosesToUpdate = [];

    renames.forEach(rename => {
        doseHistory.forEach(dose => {
            if (dose.name === rename.from) {
                dose.name = rename.to;
                historyChanged = true;

                // Collect for Airtable update
                if (dose.airtableId) {
                    dosesToUpdate.push(dose);
                }
            }
        });
    });

    if (historyChanged) {
        saveHistory();
        renderHistory();

        if (dosesToUpdate.length > 0) {
            batchUpdateAirtable(dosesToUpdate);
        }
    }

    renderActionButtons();
    showToast("Medicine list updated");

    // Sync config to Airtable
    syncMedicineConfigToAirtable();
}

async function batchUpdateAirtable(doses) {
    const url = 'https://api.airtable.com/v0/appPOZzZ2SieNO8lf/tblh43hkDNgA9lKi4';

    // Process in chunks of 10
    for (let i = 0; i < doses.length; i += 10) {
        const chunk = doses.slice(i, i + 10);
        const payload = {
            records: chunk.map(dose => ({
                id: dose.airtableId,
                fields: {
                    "Medicine": dose.name,
                    "Date": dose.dateStr,
                    "Time": dose.timeStr,
                    "timestamp": dose.timestamp
                }
            })),
            typecast: true
        };

        try {
            await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Authorization': 'Bearer patguU4AQxNO1AQzp.a0a637c47eefb850813cb4e564f5238d0acca68ef1f72b357283ad8dd46236ea',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            // Simple delay to respect rate limits (5 req/sec)
            await new Promise(r => setTimeout(r, 250));
        } catch (err) {
            console.error("Error batch updating Airtable:", err);
        }
    }
    console.log(`Updated ${doses.length} records in Airtable`);
}

// Helper: Load Medicine Config from Airtable
async function loadMedicineConfigFromAirtable() {
    const url = 'https://api.airtable.com/v0/appPOZzZ2SieNO8lf/tblNGXmzXYWmRSx9h?sort%5B0%5D%5Bfield%5D=Load%20Order&sort%5B0%5D%5Bdirection%5D=asc';

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': 'Bearer patguU4AQxNO1AQzp.a0a637c47eefb850813cb4e564f5238d0acca68ef1f72b357283ad8dd46236ea'
            }
        });

        if (response.ok) {
            const data = await response.json();

            // If Airtable is empty, perform initial sync from local config
            if (data.records.length === 0) {
                console.log("Airtable config empty. Performing initial sync...");
                await initialSyncMedicineConfigToAirtable();
                return;
            }

            // Otherwise, load from Airtable
            medicineConfig = data.records
                .filter(record => record.fields['Medicine Name'] && record.fields['Medicine Name'].trim().length > 0)
                .map(record => ({
                    id: record.id, // Use Airtable ID as stable ID
                    name: record.fields['Medicine Name'],
                    emoji: record.fields['Emoji'],
                    color: record.fields['Color'],
                    visibility: !!record.fields['Visibility']
                }));

            localStorage.setItem('wisdomMedicineConfig', JSON.stringify(medicineConfig));
            renderActionButtons();
            // Re-render history to reflect any color/name updates
            renderHistory();
            console.log("Medicine config loaded from Airtable");
        }
    } catch (err) {
        console.error('Error loading medicine config from Airtable:', err);
    }
}

// Helper: Initial Sync (Local -> Airtable)
async function initialSyncMedicineConfigToAirtable() {
    const url = 'https://api.airtable.com/v0/appPOZzZ2SieNO8lf/tblNGXmzXYWmRSx9h';

    // Create all local items in Airtable
    // Airtable allows creating up to 10 records per request
    const recordsToCreate = medicineConfig.map((med, index) => ({
        fields: {
            "Medicine Name": med.name,
            "Emoji": med.emoji,
            "Color": med.color,
            "Load Order": index,
            "Visibility": med.visibility !== false
        }
    }));

    // Chunking logic (even though medicineConfig is likely <= 10, good practice)
    for (let i = 0; i < recordsToCreate.length; i += 10) {
        const chunk = recordsToCreate.slice(i, i + 10);
        const payload = { records: chunk, typecast: true };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer patguU4AQxNO1AQzp.a0a637c47eefb850813cb4e564f5238d0acca68ef1f72b357283ad8dd46236ea',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();

                // Update local IDs with new Airtable IDs
                // Assuming order is preserved in response (Airtable usually does)
                data.records.forEach((record, idx) => {
                    const localIndex = i + idx;
                    if (medicineConfig[localIndex]) {
                        medicineConfig[localIndex].id = record.id;
                    }
                });
            } else {
                 console.error('Initial sync failed:', await response.text());
            }
            await new Promise(r => setTimeout(r, 250));
        } catch (err) {
            console.error('Error during initial sync:', err);
        }
    }

    localStorage.setItem('wisdomMedicineConfig', JSON.stringify(medicineConfig));
    console.log("Initial sync complete. IDs updated.");
}

// Helper: Sync Config Updates (Local -> Airtable)
async function syncMedicineConfigToAirtable() {
    const url = 'https://api.airtable.com/v0/appPOZzZ2SieNO8lf/tblNGXmzXYWmRSx9h';

    // Separate into Updates and Creates
    const updates = [];
    const creates = [];

    medicineConfig.forEach((med, index) => {
        const fields = {
            "Medicine Name": med.name,
            "Emoji": med.emoji,
            "Color": med.color,
            "Load Order": index,
            "Visibility": med.visibility !== false
        };

        if (med.id && med.id.startsWith('rec')) {
            updates.push({ id: med.id, fields: fields });
        } else {
            creates.push({ fields: fields });
        }
    });

    // Process Updates
    for (let i = 0; i < updates.length; i += 10) {
        const chunk = updates.slice(i, i + 10);
        try {
            await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Authorization': 'Bearer patguU4AQxNO1AQzp.a0a637c47eefb850813cb4e564f5238d0acca68ef1f72b357283ad8dd46236ea',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ records: chunk, typecast: true })
            });
            await new Promise(r => setTimeout(r, 250));
        } catch (err) {
            console.error('Error updating config in Airtable:', err);
        }
    }

    // Process Creates
    if (creates.length > 0) {
        for (let i = 0; i < creates.length; i += 10) {
            const chunk = creates.slice(i, i + 10);
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer patguU4AQxNO1AQzp.a0a637c47eefb850813cb4e564f5238d0acca68ef1f72b357283ad8dd46236ea',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ records: chunk, typecast: true })
                });

                if (response.ok) {
                     const data = await response.json();
                     // We need to map these back to medicineConfig.
                     // But creates only happen if we added new items locally without IDs.
                     // The current UI doesn't support adding, so this block might rarely run unless manual manipulation.
                     // But if it runs, we should update IDs.
                     // However, mapping back is tricky if we don't know which 'create' corresponds to which local item reliably if order shifted.
                     // Assuming order in 'creates' matches order of non-ID items in medicineConfig.
                     let createIdx = 0;
                     for (let j = 0; j < medicineConfig.length; j++) {
                         if (!medicineConfig[j].id || !medicineConfig[j].id.startsWith('rec')) {
                             if (data.records[createIdx]) {
                                 medicineConfig[j].id = data.records[createIdx].id;
                                 createIdx++;
                             }
                         }
                     }
                     localStorage.setItem('wisdomMedicineConfig', JSON.stringify(medicineConfig));
                }
                await new Promise(r => setTimeout(r, 250));
            } catch (err) {
                console.error('Error creating config in Airtable:', err);
            }
        }
    }

    console.log(`Synced config to Airtable: ${updates.length} updates, ${creates.length} creates`);
}

async function syncUpdateToAirtable(dose) {
    const url = `https://api.airtable.com/v0/appPOZzZ2SieNO8lf/tblh43hkDNgA9lKi4/${dose.airtableId}`;
    const payload = {
        fields: {
            "Medicine": dose.name,
            "Date": dose.dateStr,
            "Time": dose.timeStr,
            "timestamp": dose.timestamp
        },
        typecast: true
    };

    try {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': 'Bearer patguU4AQxNO1AQzp.a0a637c47eefb850813cb4e564f5238d0acca68ef1f72b357283ad8dd46236ea',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error('Airtable update failed:', await response.text());
        } else {
            console.log('Successfully updated dose in Airtable');
        }
    } catch (err) {
        console.error('Error updating Airtable:', err);
    }
}

// ============================================
// CUSTOM TIME PICKER LOGIC
// ============================================

function setupDaySelector() {
    const daySelector = document.getElementById('day-selector');
    daySelector.innerHTML = '';
    const today = new Date();

    // We want to work with local datestrings to prevent timezone shift issues
    const getLocalDateStr = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return (new Date(d.getTime() - offset)).toISOString().split('T')[0];
    };

    const todayStr = getLocalDateStr(today);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Show last 7 days including today (which is on the far right)
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);

        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.dataset.date = getLocalDateStr(date);

        const dayName = dayNames[date.getDay()];
        const dayNum = date.getDate();

        dayDiv.innerHTML = `
            <span class="day-name">${dayName}</span>
            <span class="day-num">${dayNum}</span>
        `;

        if (dayDiv.dataset.date === todayStr) {
            dayDiv.classList.add('selected');
        }

        dayDiv.addEventListener('click', () => {
            document.querySelectorAll('.day-selector .day').forEach(d => d.classList.remove('selected'));
            dayDiv.classList.add('selected');
        });

        daySelector.appendChild(dayDiv);
    }

    // Auto-scroll to end (today)
    daySelector.scrollLeft = daySelector.scrollWidth;
}

function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function initializeTimePicker() {
    const hourPicker = document.getElementById('hour-picker');
    const minutePicker = document.getElementById('minute-picker');
    const ampmPicker = document.getElementById('ampm-picker');

    hourPicker.innerHTML = '';
    minutePicker.innerHTML = '';
    ampmPicker.innerHTML = '';

    const paddingCount = 1;

    // Hours (1-12)
    hourPicker.innerHTML += `<div class="time-item time-item-padding"></div>`;
    for (let r = 0; r < 5; r++) { // Repeats for infinite scroll illusion
        for (let i = 1; i <= 12; i++) {
            hourPicker.innerHTML += `<div class="time-item" data-value="${i}">${i}</div>`;
        }
    }
    hourPicker.innerHTML += `<div class="time-item time-item-padding"></div>`;

    // Minutes (0-59)
    minutePicker.innerHTML += `<div class="time-item time-item-padding"></div>`;
    for (let r = 0; r < 5; r++) {
        for (let i = 0; i < 60; i++) {
            minutePicker.innerHTML += `<div class="time-item" data-value="${i}">${String(i).padStart(2, '0')}</div>`;
        }
    }
    minutePicker.innerHTML += `<div class="time-item time-item-padding"></div>`;

    // AM/PM
    ampmPicker.innerHTML += `<div class="time-item time-item-padding"></div>`;
    ampmPicker.innerHTML += `<div class="time-item" data-value="AM">AM</div>`;
    ampmPicker.innerHTML += `<div class="time-item" data-value="PM">PM</div>`;
    ampmPicker.innerHTML += `<div class="time-item time-item-padding"></div>`;

    setupTimePickerColumn(hourPicker, 12, true);
    setupTimePickerColumn(minutePicker, 60, true);
    setupTimePickerColumn(ampmPicker, 2, false);

    // Set to current time initially
    const now = new Date();
    let h = now.getHours();
    let m = now.getMinutes();
    let ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;

    setTimeout(() => {
        setTimePickerValues(h, m, ap);
    }, 100);
}

function setupTimePickerColumn(picker, itemCount, infiniteScroll) {
    const itemHeight = 45;
    const paddingCount = 1;
    const repeats = infiniteScroll ? 5 : 1;

    let scrollTimeout;
    let isAdjusting = false;

    picker.addEventListener('scroll', () => {
        if (isAdjusting) return;
        updateTimePickerHighlight(picker);

        if (infiniteScroll) {
            const scrollTop = picker.scrollTop;
            const itemsPerRepeat = itemCount;
            const scrollRange = (itemsPerRepeat * repeats) * itemHeight;

            if (scrollTop < itemHeight * (paddingCount + itemsPerRepeat)) {
                isAdjusting = true;
                picker.scrollTop = scrollTop + (itemsPerRepeat * itemHeight * 2);
                setTimeout(() => { isAdjusting = false; }, 10);
            } else if (scrollTop > scrollRange - itemHeight * (paddingCount + itemsPerRepeat)) {
                isAdjusting = true;
                picker.scrollTop = scrollTop - (itemsPerRepeat * itemHeight * 2);
                setTimeout(() => { isAdjusting = false; }, 10);
            }
        }

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => { snapToCenter(picker); }, 150);
    });

    // Mouse drag
    let startY = 0, startScrollTop = 0, isDragging = false;
    picker.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startScrollTop = picker.scrollTop;
        picker.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        picker.scrollTop = startScrollTop + (startY - e.clientY);
    });
    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        picker.style.cursor = 'grab';
        snapToCenter(picker);
    });

    picker.style.cursor = 'grab';
}

function updateTimePickerHighlight(picker) {
    const children = Array.from(picker.children);
    const scrollTop = picker.scrollTop;
    const itemHeight = 45;
    const pickerHeight = picker.clientHeight;

    const visibleCenter = scrollTop + (pickerHeight / 2);
    const centerIndex = Math.round((visibleCenter - (itemHeight / 2)) / itemHeight);

    children.forEach((child, index) => {
        if (child.classList.contains('time-item-padding')) return;

        if (index === centerIndex) {
            child.classList.add('active');
            child.style.opacity = '1';
        } else {
            child.classList.remove('active');
            const distance = Math.abs(index - centerIndex);
            child.style.opacity = Math.max(0.2, 1 - (distance * 0.4)).toString();
        }
    });
}

function snapToCenter(picker) {
    const itemHeight = 45;
    const pickerHeight = picker.clientHeight;
    const scrollTop = picker.scrollTop;

    const visibleCenter = scrollTop + (pickerHeight / 2);
    const nearestIndex = Math.round((visibleCenter - (itemHeight / 2)) / itemHeight);

    const targetScroll = (nearestIndex * itemHeight + (itemHeight / 2)) - (pickerHeight / 2);
    picker.scrollTo({ top: targetScroll, behavior: 'smooth' });
}

function getSelectedTime() {
    const hourPicker = document.getElementById('hour-picker');
    const minutePicker = document.getElementById('minute-picker');
    const ampmPicker = document.getElementById('ampm-picker');
    const itemHeight = 45;

    function getCenteredValue(picker) {
        const pickerHeight = picker.clientHeight;
        const visibleCenter = picker.scrollTop + (pickerHeight / 2);
        const centerIndex = Math.round((visibleCenter - (itemHeight / 2)) / itemHeight);
        const child = picker.children[centerIndex];
        return child ? child.dataset.value : null;
    }

    return {
        hour: getCenteredValue(hourPicker) || 12,
        minute: getCenteredValue(minutePicker) || 0,
        ampm: getCenteredValue(ampmPicker) || 'AM'
    };
}

function setTimePickerValues(hour, minute, ampm) {
    const itemHeight = 45;
    const hourPicker = document.getElementById('hour-picker');
    const minutePicker = document.getElementById('minute-picker');
    const ampmPicker = document.getElementById('ampm-picker');

    // Index calculation depends on repeats and padding
    const hourIndex = 1 + (2 * 12) + (hour - 1); // 1 padding + 2 repeats to center + (val-1)
    const minuteIndex = 1 + (2 * 60) + minute;
    const ampmIndex = 1 + (ampm === 'PM' ? 1 : 0);

    hourPicker.scrollTop = (hourIndex * itemHeight + (itemHeight / 2)) - (hourPicker.clientHeight / 2);
    minutePicker.scrollTop = (minuteIndex * itemHeight + (itemHeight / 2)) - (minutePicker.clientHeight / 2);
    ampmPicker.scrollTop = (ampmIndex * itemHeight + (itemHeight / 2)) - (ampmPicker.clientHeight / 2);

    updateTimePickerHighlight(hourPicker);
    updateTimePickerHighlight(minutePicker);
    updateTimePickerHighlight(ampmPicker);
}
