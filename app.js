// Medicine Tracker State
let doseHistory = JSON.parse(localStorage.getItem('wisdomMedicineHistory')) || [];
let isPastTimeMode = false;

// DOM Elements
const historyBody = document.getElementById('history-body');
const emptyState = document.getElementById('empty-state');
const toastEl = document.getElementById('toast');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderHistory();
    loadFromAirtable();
});

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

// Helper for Colored Chips
function getMedicineColorClass(name) {
    const map = {
        'Norco': 'chip-norco',
        'Hydrocodone': 'chip-norco',
        'Acetaminophen': 'chip-acetaminophen',
        'Ibuprofen': 'chip-ibuprofen',
        'Amoxicillin': 'chip-amoxicillin',
        'Ondansetron': 'chip-ondansetron',
        'Chlorhexidine': 'chip-chlorhexidine',
        'Nicotine Patch': 'chip-nicotine',
        'Quetiapine': 'chip-quetiapine',
        'Lorazepam': 'chip-lorazepam',
        'Adderall': 'chip-adderall',
        'Medicated Mouth Rinse': 'chip-chlorhexidine' // fallback for old data
    };
    return map[name] || 'chip-default';
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
        medChip.className = `med-chip ${getMedicineColorClass(dose.name)}`;
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
function getMedicineDotClass(name) {
    const classStr = getMedicineColorClass(name);
    return classStr.replace('chip-', 'dot-');
}

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
                dot.className = `timeline-dot ${getMedicineDotClass(dose.name)}`;
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
        ]
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
            doseHistory = data.records.map(record => ({
                id: record.id,
                airtableId: record.id,
                name: record.fields.Medicine,
                timestamp: record.fields.timestamp || new Date().toISOString(),
                dateStr: record.fields.Date,
                timeStr: record.fields.Time
            }));
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

async function syncUpdateToAirtable(dose) {
    const url = `https://api.airtable.com/v0/appPOZzZ2SieNO8lf/tblh43hkDNgA9lKi4/${dose.airtableId}`;
    const payload = {
        fields: {
            "Medicine": dose.name,
            "Date": dose.dateStr,
            "Time": dose.timeStr,
            "timestamp": dose.timestamp
        }
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
