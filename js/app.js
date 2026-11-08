// ==========================================================================
// NOTULENSI DIGITAL - APPLICATION CONTROLLER
// Pair Programming & Enterprise Meeting Management System
// ==========================================================================

import { initFirebaseService, saveNotulensiListToFirebase } from './firebase-config.js';

// Application State
const state = {
    notulensiList: [],
    filteredList: [],
    currentFilter: {
        searchQuery: '',
        category: 'ALL',
        period: 'ALL',
        startDate: '',
        endDate: '',
        sortOrder: 'NEWEST'
    },
    pagination: {
        currentPage: 1,
        itemsPerPage: 8
    },
    participantsDraft: [],
    editParticipantsDraft: [],
    currentDetailItem: null,
    itemToDeleteId: null
};

// ==========================================================================
// HELPER: INDONESIAN DATE & TIME UTILITIES (WIB)
// ==========================================================================

// Mendapatkan tanggal saat ini format DD/MM/YYYY (WIB)
function getTodayDateIndo() {
    const now = new Date();
    // UTC+7 (WIB)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    
    const day = String(wib.getDate()).padStart(2, '0');
    const month = String(wib.getMonth() + 1).padStart(2, '0');
    const year = wib.getFullYear();
    return `${day}/${month}/${year}`;
}

// Mendapatkan format YYYY-MM-DD untuk input type="date"
function getTodayDateISO() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    
    const day = String(wib.getDate()).padStart(2, '0');
    const month = String(wib.getMonth() + 1).padStart(2, '0');
    const year = wib.getFullYear();
    return `${year}-${month}-${day}`;
}

// Format timestamp ke string waktu lokal Indonesia (DD/MM/YYYY HH:mm WIB)
function formatTimestampWIB(timestamp) {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes} WIB`;
}

// Konversi DD/MM/YYYY ke objek Date
function parseIndoDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
    } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
    }
    return new Date(dateStr);
}

// Konversi YYYY-MM-DD ke DD/MM/YYYY
function isoToIndoDate(isoStr) {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
}

// Konversi DD/MM/YYYY ke YYYY-MM-DD
function indoToIsoDate(indoStr) {
    if (!indoStr) return '';
    const parts = indoStr.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return indoStr;
}

// Format hari & tanggal lengkap untuk Banner Dashboard
function getIndonesianLongDate() {
    const now = new Date();
    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const dayName = hari[now.getDay()];
    const day = now.getDate();
    const monthName = bulan[now.getMonth()];
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${dayName}, ${day} ${monthName} ${year} | ${hours}:${minutes} WIB`;
}

// ==========================================================================
// TOAST NOTIFICATION SYSTEM
// ==========================================================================
function showToast(message, type = 'success', title = '') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-circle-check';
    let defaultTitle = 'Sukses';
    if (type === 'error') {
        iconClass = 'fa-circle-xmark';
        defaultTitle = 'Gagal';
    } else if (type === 'warning') {
        iconClass = 'fa-triangle-exclamation';
        defaultTitle = 'Perhatian';
    } else if (type === 'info') {
        iconClass = 'fa-circle-info';
        defaultTitle = 'Informasi';
    }

    toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <div class="toast-message">
            <div class="toast-title">${title || defaultTitle}</div>
            <div class="toast-text">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================================================
// SPA NAVIGATION
// ==========================================================================
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    const targetSection = document.getElementById(viewId);
    if (targetSection) {
        targetSection.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const activeLink = document.querySelector(`.nav-link[data-view="${viewId}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Close mobile menu if open
    document.getElementById('navMenu')?.classList.remove('open');

    // Update view-specific content
    if (viewId === 'dashboardView') {
        updateDashboardKPIs();
        renderRecentTable();
    } else if (viewId === 'historyView') {
        applySearchAndFilters();
    }
}

// ==========================================================================
// PARTICIPANTS TAGGING SYSTEM
// ==========================================================================
function renderParticipantsChips(containerId, list, isEdit = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = `<span class="chip-empty-placeholder">Belum ada peserta yang dimasukkan.</span>`;
        return;
    }

    container.innerHTML = list.map((name, index) => `
        <span class="participant-chip">
            <i class="fa-solid fa-user-check" style="font-size: 0.8rem;"></i>
            <span>${escapeHtml(name)}</span>
            <button type="button" class="chip-delete" data-index="${index}" data-is-edit="${isEdit}" title="Hapus ${escapeHtml(name)}">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </span>
    `).join('');

    // Attach delete handlers
    container.querySelectorAll('.chip-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
            const forEdit = e.currentTarget.getAttribute('data-is-edit') === 'true';
            if (forEdit) {
                state.editParticipantsDraft.splice(idx, 1);
                renderParticipantsChips('editParticipantsChipsContainer', state.editParticipantsDraft, true);
            } else {
                state.participantsDraft.splice(idx, 1);
                renderParticipantsChips('participantsChipsContainer', state.participantsDraft, false);
            }
        });
    });
}

function handleAddParticipant(inputId, list, containerId, isEdit = false) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;

    // Check duplicate
    if (list.some(p => p.toLowerCase() === name.toLowerCase())) {
        showToast(`Peserta "${name}" sudah ada dalam daftar.`, 'warning');
        return;
    }

    list.push(name);
    input.value = '';
    renderParticipantsChips(containerId, list, isEdit);
    input.focus();
}

// ==========================================================================
// TEXTAREA FORMATTING TOOLBAR
// ==========================================================================
function setupTextareaToolbar(toolbarSelector, textareaId) {
    const toolbar = document.querySelector(toolbarSelector);
    const textarea = document.getElementById(textareaId);
    if (!toolbar || !textarea) return;

    toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.tool-btn');
        if (!btn) return;

        const action = btn.getAttribute('data-action');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end);
        let replacement = '';

        switch (action) {
            case 'bold':
                replacement = `**${selected || 'Teks Tebal'}**`;
                break;
            case 'italic':
                replacement = `*${selected || 'Teks Miring'}*`;
                break;
            case 'bullet':
                if (selected.includes('\n')) {
                    replacement = selected.split('\n').map(line => `â€¢ ${line}`).join('\n');
                } else {
                    replacement = `\nâ€¢ ${selected || 'Poin bahasan'}\n`;
                }
                break;
            case 'number':
                if (selected.includes('\n')) {
                    replacement = selected.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n');
                } else {
                    replacement = `\n1. ${selected || 'Poin pembahasan ke-1'}\n2. Poin pembahasan ke-2\n`;
                }
                break;
            case 'heading':
                replacement = `\n### ${selected || 'Sub Judul Pembahasan'}\n`;
                break;
            case 'clear':
                if (confirm('Bersihkan isi teks pembahasan?')) {
                    textarea.value = '';
                    textarea.focus();
                    return;
                }
                return;
            default:
                return;
        }

        textarea.setRangeText(replacement, start, end, 'end');
        textarea.focus();
    });
}

// ==========================================================================
// FORM MANAGEMENT (CREATE & RESET)
// ==========================================================================
function resetCreateForm() {
    const form = document.getElementById('notulensiForm');
    if (form) form.reset();

    // Reset tanggal ke hari ini WIB
    const formattedDate = getTodayDateIndo();
    const isoDate = getTodayDateISO();
    const dateInput = document.getElementById('tanggalNotulensiFormatted');
    const hiddenPicker = document.getElementById('tanggalPickerHidden');
    if (dateInput) dateInput.value = formattedDate;
    if (hiddenPicker) hiddenPicker.value = isoDate;

    // Reset participants
    state.participantsDraft = [];
    renderParticipantsChips('participantsChipsContainer', state.participantsDraft, false);

    // Remove error classes
    document.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
}

function getFormData() {
    const jenis = document.getElementById('jenisNotulensi').value.trim();
    const tanggal = document.getElementById('tanggalNotulensiFormatted').value.trim();
    const nama = document.getElementById('namaNotulensi').value.trim();
    const pembuat = document.getElementById('pembuatNotulensi').value.trim();
    const detail = document.getElementById('detailNotulensi').value.trim();
    const poin = document.getElementById('poinPembahasan').value.trim();
    const hasil = document.getElementById('hasilDiskusi').value.trim();
    const keputusan = document.getElementById('keputusanMeeting').value.trim();
    const actionPlan = document.getElementById('actionPlan').value.trim();
    const pic = document.getElementById('picTindakLanjut').value.trim();
    const deadline = document.getElementById('deadlineTindakLanjut').value.trim();

    return {
        jenisNotulensi: jenis,
        tanggalNotulensi: tanggal,
        namaNotulensi: nama,
        pembuatNotulensi: pembuat,
        peserta: [...state.participantsDraft],
        detailNotulensi: detail,
        poinPembahasan: poin,
        hasilDiskusi: hasil,
        keputusanMeeting: keputusan,
        actionPlan: actionPlan,
        picTindakLanjut: pic,
        deadlineTindakLanjut: deadline
    };
}

function validateFormData(data) {
    const errors = [];

    if (!data.jenisNotulensi) {
        errors.push({ fieldId: 'jenisNotulensi', message: 'Jenis Notulensi (Evaluasi / Kalibrasi) wajib dipilih.' });
    }
    if (!data.tanggalNotulensi) {
        errors.push({ fieldId: 'tanggalNotulensiFormatted', message: 'Tanggal Notulensi wajib diisi.' });
    }
    if (!data.pembuatNotulensi) {
        errors.push({ fieldId: 'pembuatNotulensi', message: 'Nama Pembuat / Notulis wajib diisi.' });
    }
    if (!data.namaNotulensi) {
        errors.push({ fieldId: 'namaNotulensi', message: 'Nama / Judul Notulensi wajib diisi.' });
    }
    if (!data.peserta || data.peserta.length === 0) {
        errors.push({ fieldId: 'participantInput', message: 'Minimal 1 nama peserta rapat wajib ditambahkan.' });
    }
    if (!data.detailNotulensi) {
        errors.push({ fieldId: 'detailNotulensi', message: 'Detail pembahasan meeting wajib diisi.' });
    }
    if (!data.poinPembahasan) {
        errors.push({ fieldId: 'poinPembahasan', message: 'Poin pembahasan meeting wajib diisi.' });
    }
    if (!data.hasilDiskusi) {
        errors.push({ fieldId: 'hasilDiskusi', message: 'Hasil diskusi meeting wajib diisi.' });
    }
    if (!data.keputusanMeeting) {
        errors.push({ fieldId: 'keputusanMeeting', message: 'Keputusan meeting wajib diisi.' });
    }
    if (!data.actionPlan) {
        errors.push({ fieldId: 'actionPlan', message: 'Action plan / tindak lanjut wajib diisi.' });
    }
    if (!data.picTindakLanjut) {
        errors.push({ fieldId: 'picTindakLanjut', message: 'PIC tindak lanjut wajib diisi.' });
    }
    if (!data.deadlineTindakLanjut) {
        errors.push({ fieldId: 'deadlineTindakLanjut', message: 'Deadline tindak lanjut wajib diisi.' });
    }

    return errors;
}

// ==========================================================================
// CRUD: SAVE NOTULENSI (SIMPAN KE FIRESTORE)
// ==========================================================================
async function handleSaveNotulensi() {
    const data = getFormData();
    const errors = validateFormData(data);

    // Clear previous errors
    document.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));

    if (errors.length > 0) {
        // Highlight first error
        const firstErr = errors[0];
        const el = document.getElementById(firstErr.fieldId);
        if (el) {
            el.classList.add('error');
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showToast(firstErr.message, 'error', 'Validasi Gagal');
        return;
    }

    const saveBtn = document.getElementById('saveNotulensiBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan ke Firestore...</span>`;

    const now = Date.now();
    const newRecord = {
        id: 'notulensi_' + now + '_' + Math.random().toString(36).substring(2, 7),
        jenisNotulensi: data.jenisNotulensi,
        tanggal: data.tanggalNotulensi,
        namaNotulensi: data.namaNotulensi,
        pembuatNotulensi: data.pembuatNotulensi,
        peserta: data.peserta,
        detailNotulensi: data.detailNotulensi,
        poinPembahasan: data.poinPembahasan,
        hasilDiskusi: data.hasilDiskusi,
        keputusanMeeting: data.keputusanMeeting,
        actionPlan: data.actionPlan,
        picTindakLanjut: data.picTindakLanjut,
        deadlineTindakLanjut: data.deadlineTindakLanjut,
        timestamp: now,
        createdAt: formatTimestampWIB(now),
        updatedAt: formatTimestampWIB(now)
    };

    try {
        // Masukkan data baru di posisi paling atas (Descending)
        const updatedList = [newRecord, ...state.notulensiList];
        await saveNotulensiListToFirebase(updatedList);

        state.notulensiList = updatedList;
        showToast('Notulensi berhasil disimpan dan tersinkronisasi ke Firebase Firestore!', 'success', 'Berhasil Disimpan');
        
        // Reset formulir
        resetCreateForm();

        // Pindah ke halaman riwayat
        window.location.hash = '#history';
        switchView('historyView');
    } catch (err) {
        console.error("Save error:", err);
        showToast('Terjadi kesalahan saat menyimpan ke Firestore: ' + err.message, 'error', 'Penyimpanan Gagal');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// ==========================================================================
// SEARCH & FILTER ENGINE (SECTION 10 & 11)
// ==========================================================================
function applySearchAndFilters() {
    const { searchQuery, category, period, startDate, endDate, sortOrder } = state.currentFilter;
    const q = searchQuery.toLowerCase().replace(/\s+/g, ' ').trim();

    const now = new Date();
    const todayIndo = getTodayDateIndo();

    let result = state.notulensiList.filter(item => {
        // 1. Filter Kategori (Semua / Evaluasi / Kalibrasi)
        if (category !== 'ALL') {
            if ((item.jenisNotulensi || '').toLowerCase() !== category.toLowerCase()) {
                return false;
            }
        }

        // 2. Filter Periode Waktu
        if (period !== 'ALL') {
            const itemDate = parseIndoDate(item.tanggal);
            if (!itemDate || isNaN(itemDate.getTime())) return false;

            if (period === 'TODAY') {
                if (item.tanggal !== todayIndo) return false;
            } else if (period === 'THIS_WEEK') {
                const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
                if (diffDays < 0 || diffDays > 7) return false;
            } else if (period === 'THIS_MONTH') {
                if (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) {
                    return false;
                }
            } else if (period === 'CUSTOM') {
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (itemDate < start) return false;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (itemDate > end) return false;
                }
            }
        }

        // 3. Interactive Search Query (Full-Text Multi-Field Search)
        if (q) {
            const pesertaStr = (item.peserta || []).join(' ').toLowerCase();
            const fullContent = [
                item.namaNotulensi || '',
                item.jenisNotulensi || '',
                item.tanggal || '',
                item.pembuatNotulensi || '',
                item.detailNotulensi || '',
                item.poinPembahasan || '',
                item.hasilDiskusi || '',
                item.keputusanMeeting || '',
                item.actionPlan || '',
                item.picTindakLanjut || '',
                pesertaStr
            ].join(' ').toLowerCase();

            // Mendukung multi-kata pencarian (semua kata harus cocok)
            const queryWords = q.split(' ');
            const matchesAll = queryWords.every(word => fullContent.includes(word));
            if (!matchesAll) return false;
        }

        return true;
    });

    // 4. Sorting
    if (sortOrder === 'NEWEST') {
        result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } else if (sortOrder === 'OLDEST') {
        result.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    } else if (sortOrder === 'TITLE_AZ') {
        result.sort((a, b) => (a.namaNotulensi || '').localeCompare(b.namaNotulensi || ''));
    }

    state.filteredList = result;
    state.pagination.currentPage = 1;
    renderHistoryTable();
}

// ==========================================================================
// RENDER: RIWAYAT NOTULENSI TABLE & PAGINATION
// ==========================================================================
function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    const emptyState = document.getElementById('historyEmptyState');
    const paginationWrapper = document.getElementById('paginationWrapper');
    const visibleCountEl = document.getElementById('visibleCount');
    const totalCountEl = document.getElementById('totalCount');

    if (!tbody) return;

    const total = state.notulensiList.length;
    const filtered = state.filteredList.length;

    if (visibleCountEl) visibleCountEl.textContent = filtered;
    if (totalCountEl) totalCountEl.textContent = total;

    if (filtered === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'flex';
        if (paginationWrapper) paginationWrapper.style.display = 'none';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (paginationWrapper) paginationWrapper.style.display = 'flex';

    // Pagination slice
    const { currentPage, itemsPerPage } = state.pagination;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filtered);
    const pagedItems = state.filteredList.slice(startIndex, endIndex);

    tbody.innerHTML = pagedItems.map((item, idx) => {
        const rowNumber = startIndex + idx + 1;
        const badgeClass = item.jenisNotulensi === 'Evaluasi' ? 'badge-evaluasi' : 'badge-kalibrasi';
        const pesertaCount = (item.peserta || []).length;
        const formattedSavedTime = item.createdAt || formatTimestampWIB(item.timestamp);

        return `
            <tr>
                <td style="font-weight: 600; color: var(--text-muted);">${rowNumber}</td>
                <td>
                    <div style="font-weight: 600;">${escapeHtml(item.tanggal || '-')}</div>
                </td>
                <td>
                    <span class="badge ${badgeClass}">
                        <i class="fa-solid ${item.jenisNotulensi === 'Evaluasi' ? 'fa-check' : 'fa-sliders'}"></i>
                        ${escapeHtml(item.jenisNotulensi)}
                    </span>
                </td>
                <td>
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">
                        ${escapeHtml(item.namaNotulensi || '-')}
                    </div>
                </td>
                <td>
                    <div style="font-weight: 500; color: var(--text-secondary);">
                        <i class="fa-regular fa-user" style="font-size: 0.8rem; margin-right: 4px; color: var(--text-muted);"></i>
                        ${escapeHtml(item.pembuatNotulensi || '-')}
                    </div>
                </td>
                <td>
                    <div style="font-size: 0.82rem; color: var(--text-muted);">
                        ${escapeHtml(formattedSavedTime)}
                    </div>
                </td>
                <td>
                    <span class="badge-participants" title="${(item.peserta || []).join(', ')}">
                        <i class="fa-solid fa-users"></i>
                        <span>${pesertaCount} Peserta</span>
                    </span>
                </td>
                <td style="text-align: center;">
                    <div class="action-buttons" style="justify-content: center;">
                        <button type="button" class="btn-icon" data-action="detail" data-id="${item.id}" title="Detail Notulensi">
                            <i class="fa-regular fa-file-lines"></i>
                        </button>
                        <button type="button" class="btn-icon" data-action="pdf" data-id="${item.id}" title="Download PDF">
                            <i class="fa-solid fa-file-pdf"></i>
                        </button>
                        <button type="button" class="btn-icon" data-action="edit" data-id="${item.id}" title="Edit Notulensi">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn-icon btn-icon-danger" data-action="delete" data-id="${item.id}" title="Hapus Notulensi">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Attach row action event listeners
    tbody.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            const item = state.notulensiList.find(x => x.id === id);
            if (!item) return;

            if (action === 'detail') {
                openDetailModal(item);
            } else if (action === 'pdf') {
                generateNotulensiPdf(item);
            } else if (action === 'edit') {
                openEditModal(item);
            } else if (action === 'delete') {
                openDeleteModal(item);
            }
        });
    });

    renderPaginationControls();
}

function renderPaginationControls() {
    const controls = document.getElementById('paginationControls');
    const info = document.getElementById('paginationInfo');
    if (!controls) return;

    const { currentPage, itemsPerPage } = state.pagination;
    const totalItems = state.filteredList.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (info) {
        info.textContent = `Halaman ${currentPage} dari ${totalPages} (Total ${totalItems} data)`;
    }

    let html = '';
    // Previous Button
    html += `<button type="button" class="page-btn" id="prevPageBtn" ${currentPage === 1 ? 'disabled' : ''} title="Halaman Sebelumnya"><i class="fa-solid fa-chevron-left"></i></button>`;

    // Page numbers
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
            html += `<button type="button" class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
        } else if (p === currentPage - 2 || p === currentPage + 2) {
            html += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
        }
    }

    // Next Button
    html += `<button type="button" class="page-btn" id="nextPageBtn" ${currentPage === totalPages ? 'disabled' : ''} title="Halaman Selanjutnya"><i class="fa-solid fa-chevron-right"></i></button>`;

    controls.innerHTML = html;

    // Events
    controls.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            state.pagination.currentPage = parseInt(e.currentTarget.getAttribute('data-page'), 10);
            renderHistoryTable();
            window.scrollTo({ top: 200, behavior: 'smooth' });
        });
    });

    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (state.pagination.currentPage > 1) {
                state.pagination.currentPage--;
                renderHistoryTable();
                window.scrollTo({ top: 200, behavior: 'smooth' });
            }
        });
    }

    const nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (state.pagination.currentPage < totalPages) {
                state.pagination.currentPage++;
                renderHistoryTable();
                window.scrollTo({ top: 200, behavior: 'smooth' });
            }
        });
    }
}

// ==========================================================================
// RENDER: DASHBOARD VIEW & KPIS
// ==========================================================================
function updateDashboardKPIs() {
    const list = state.notulensiList;
    const total = list.length;
    const evaluasi = list.filter(x => x.jenisNotulensi === 'Evaluasi').length;
    const kalibrasi = list.filter(x => x.jenisNotulensi === 'Kalibrasi').length;
    
    // Count unique or total participants
    let totalPeserta = 0;
    list.forEach(item => {
        if (Array.isArray(item.peserta)) {
            totalPeserta += item.peserta.length;
        }
    });

    const totalEl = document.getElementById('kpiTotal');
    const evalEl = document.getElementById('kpiEvaluasi');
    const kalEl = document.getElementById('kpiKalibrasi');
    const pesEl = document.getElementById('kpiPeserta');

    if (totalEl) totalEl.textContent = total;
    if (evalEl) evalEl.textContent = evaluasi;
    if (kalEl) kalEl.textContent = kalibrasi;
    if (pesEl) pesEl.textContent = totalPeserta;
}

function renderRecentTable() {
    const tbody = document.getElementById('recentNotulensiTableBody');
    if (!tbody) return;

    const recentItems = state.notulensiList.slice(0, 5);

    if (recentItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    <i class="fa-solid fa-folder-open" style="font-size: 1.5rem; display: block; margin-bottom: 8px;"></i>
                    Belum ada notulensi yang disimpan. Klik tombol "Buat Notulensi Baru" untuk memulai.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = recentItems.map(item => {
        const badgeClass = item.jenisNotulensi === 'Evaluasi' ? 'badge-evaluasi' : 'badge-kalibrasi';
        const pesertaCount = (item.peserta || []).length;
        return `
            <tr>
                <td style="font-weight: 600;">${escapeHtml(item.tanggal || '-')}</td>
                <td>
                    <span class="badge ${badgeClass}">${escapeHtml(item.jenisNotulensi)}</span>
                </td>
                <td style="font-weight: 700;">${escapeHtml(item.namaNotulensi || '-')}</td>
                <td>${escapeHtml(item.pembuatNotulensi || '-')}</td>
                <td>
                    <span class="badge-participants">
                        <i class="fa-solid fa-users"></i> ${pesertaCount}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="btn btn-sm btn-outline" data-recent-action="detail" data-id="${item.id}">
                            <i class="fa-regular fa-file-lines"></i> Detail
                        </button>
                        <button type="button" class="btn btn-sm btn-primary" data-recent-action="pdf" data-id="${item.id}">
                            <i class="fa-solid fa-file-pdf"></i> PDF
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('button[data-recent-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.getAttribute('data-recent-action');
            const id = btn.getAttribute('data-id');
            const item = state.notulensiList.find(x => x.id === id);
            if (!item) return;

            if (action === 'detail') openDetailModal(item);
            else if (action === 'pdf') generateNotulensiPdf(item);
        });
    });
}

// ==========================================================================
// MODAL: DETAIL NOTULENSI
// ==========================================================================
function openDetailModal(item) {
    state.currentDetailItem = item;
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailModalBody');
    if (!modal || !body) return;

    const badgeClass = item.jenisNotulensi === 'Evaluasi' ? 'badge-evaluasi' : 'badge-kalibrasi';
    const pesertaChips = (item.peserta || []).map(p => `
        <span class="participant-chip" style="font-size: 0.8rem; padding: 4px 10px;">
            <i class="fa-solid fa-user-check" style="font-size: 0.75rem;"></i> ${escapeHtml(p)}
        </span>
    `).join('');

    body.innerHTML = `
        <div class="detail-memo">
            <div class="detail-header-block">
                <div>
                    <span class="badge ${badgeClass}" style="margin-bottom: 8px;">
                        <i class="fa-solid ${item.jenisNotulensi === 'Evaluasi' ? 'fa-check' : 'fa-sliders'}"></i>
                        ${escapeHtml(item.jenisNotulensi)}
                    </span>
                    <h2 class="detail-title-large">${escapeHtml(item.namaNotulensi || '-')}</h2>
                </div>
            </div>

            <!-- Meta Data Grid -->
            <div class="detail-meta-grid">
                <div>
                    <div class="meta-item-label">Tanggal Pelaksanaan</div>
                    <div class="meta-item-value">${escapeHtml(item.tanggal || '-')}</div>
                </div>
                <div>
                    <div class="meta-item-label">Pembuat / Notulis</div>
                    <div class="meta-item-value">${escapeHtml(item.pembuatNotulensi || '-')}</div>
                </div>
                <div>
                    <div class="meta-item-label">Waktu Penyimpanan</div>
                    <div class="meta-item-value">${escapeHtml(item.createdAt || formatTimestampWIB(item.timestamp))}</div>
                </div>
                <div>
                    <div class="meta-item-label">Jumlah Peserta</div>
                    <div class="meta-item-value">${(item.peserta || []).length} Peserta</div>
                </div>
            </div>

            <!-- Daftar Peserta -->
            <div class="detail-section-block">
                <div class="detail-block-title">
                    <i class="fa-solid fa-users"></i>
                    <span>Daftar Peserta Hadir</span>
                </div>
                <div class="chips-container" style="background: #F8FAFC; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    ${pesertaChips || '<em>Tidak ada peserta terdaftar</em>'}
                </div>
            </div>

            <!-- Detail Pembahasan -->
            <div class="detail-section-block">
                <div class="detail-block-title">
                    <i class="fa-solid fa-align-left"></i>
                    <span>Detail Pembahasan Meeting</span>
                </div>
                <div class="detail-block-content">${escapeHtml(item.detailNotulensi || '-')}</div>
            </div>

            <!-- Poin Pembahasan & Hasil Diskusi -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 22px;">
                <div>
                    <div class="detail-block-title">
                        <i class="fa-solid fa-list-check"></i>
                        <span>Poin Pembahasan</span>
                    </div>
                    <div class="detail-block-content">${escapeHtml(item.poinPembahasan || '-')}</div>
                </div>
                <div>
                    <div class="detail-block-title">
                        <i class="fa-solid fa-comments"></i>
                        <span>Hasil Diskusi</span>
                    </div>
                    <div class="detail-block-content">${escapeHtml(item.hasilDiskusi || '-')}</div>
                </div>
            </div>

            <!-- Keputusan Meeting -->
            <div class="detail-section-block">
                <div class="detail-block-title">
                    <i class="fa-solid fa-gavel"></i>
                    <span>Keputusan Meeting</span>
                </div>
                <div class="detail-block-content" style="background-color: #F0FDF4; border-color: #BBF7D0; color: #166534; font-weight: 500;">
                    ${escapeHtml(item.keputusanMeeting || '-')}
                </div>
            </div>

            <!-- Action Plan Table -->
            <div class="detail-section-block">
                <div class="detail-block-title">
                    <i class="fa-solid fa-forward-step"></i>
                    <span>Tindak Lanjut & Action Plan</span>
                </div>
                <table class="action-plan-table">
                    <thead>
                        <tr>
                            <th>Action Plan / Tindak Lanjut</th>
                            <th style="width: 25%;">PIC</th>
                            <th style="width: 25%;">Deadline</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${escapeHtml(item.actionPlan || '-')}</td>
                            <td><strong>${escapeHtml(item.picTindakLanjut || '-')}</strong></td>
                            <td><span style="color: var(--danger); font-weight: 600;">${escapeHtml(isoToIndoDate(item.deadlineTindakLanjut) || '-')}</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

// ==========================================================================
// MODAL: PREVIEW NOTULENSI (SEBELUM SIMPAN)
// ==========================================================================
function openPreviewModal() {
    const data = getFormData();
    const errors = validateFormData(data);

    if (errors.length > 0) {
        const firstErr = errors[0];
        const el = document.getElementById(firstErr.fieldId);
        if (el) {
            el.classList.add('error');
            el.focus();
        }
        showToast(firstErr.message, 'warning', 'Lengkapi Formulir');
        return;
    }

    const modal = document.getElementById('previewModal');
    const body = document.getElementById('previewModalBody');
    if (!modal || !body) return;

    const badgeClass = data.jenisNotulensi === 'Evaluasi' ? 'badge-evaluasi' : 'badge-kalibrasi';
    const pesertaChips = data.peserta.map(p => `
        <span class="participant-chip" style="font-size: 0.8rem; padding: 4px 10px;">
            <i class="fa-solid fa-user-check"></i> ${escapeHtml(p)}
        </span>
    `).join('');

    body.innerHTML = `
        <div class="detail-memo">
            <div style="background-color: #FEF3C7; border: 1px solid #FCD34D; color: #92400E; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 0.88rem; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-circle-info"></i>
                <span>Ini adalah pratinjau notulensi sebelum disimpan ke database Firebase. Pastikan seluruh poin sudah benar.</span>
            </div>

            <div class="detail-header-block">
                <div>
                    <span class="badge ${badgeClass}" style="margin-bottom: 8px;">${escapeHtml(data.jenisNotulensi)}</span>
                    <h2 class="detail-title-large">${escapeHtml(data.namaNotulensi)}</h2>
                </div>
            </div>

            <div class="detail-meta-grid">
                <div>
                    <div class="meta-item-label">Tanggal Rapat</div>
                    <div class="meta-item-value">${escapeHtml(data.tanggalNotulensi)}</div>
                </div>
                <div>
                    <div class="meta-item-label">Pembuat Notulensi</div>
                    <div class="meta-item-value">${escapeHtml(data.pembuatNotulensi)}</div>
                </div>
                <div>
                    <div class="meta-item-label">Peserta Terdaftar</div>
                    <div class="meta-item-value">${data.peserta.length} Orang</div>
                </div>
                <div>
                    <div class="meta-item-label">Status Penyimpanan</div>
                    <div class="meta-item-value" style="color: var(--primary);">Pratinjau (Draft)</div>
                </div>
            </div>

            <div class="detail-section-block">
                <div class="detail-block-title">Daftar Peserta Hadir</div>
                <div class="chips-container" style="background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                    ${pesertaChips}
                </div>
            </div>

            <div class="detail-section-block">
                <div class="detail-block-title">Detail Pembahasan</div>
                <div class="detail-block-content">${escapeHtml(data.detailNotulensi)}</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div>
                    <div class="detail-block-title">Poin Pembahasan</div>
                    <div class="detail-block-content">${escapeHtml(data.poinPembahasan)}</div>
                </div>
                <div>
                    <div class="detail-block-title">Hasil Diskusi</div>
                    <div class="detail-block-content">${escapeHtml(data.hasilDiskusi)}</div>
                </div>
            </div>

            <div class="detail-section-block">
                <div class="detail-block-title">Keputusan Meeting</div>
                <div class="detail-block-content" style="background-color: #F0FDF4; border-color: #BBF7D0; color: #166534; font-weight: 500;">
                    ${escapeHtml(data.keputusanMeeting)}
                </div>
            </div>

            <div class="detail-section-block">
                <div class="detail-block-title">Tindak Lanjut & Action Plan</div>
                <table class="action-plan-table">
                    <thead>
                        <tr>
                            <th>Action Plan</th>
                            <th style="width: 25%;">PIC</th>
                            <th style="width: 25%;">Deadline</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${escapeHtml(data.actionPlan)}</td>
                            <td><strong>${escapeHtml(data.picTindakLanjut)}</strong></td>
                            <td><span style="color: var(--danger); font-weight: 600;">${escapeHtml(isoToIndoDate(data.deadlineTindakLanjut))}</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

// ==========================================================================
// MODAL: EDIT NOTULENSI
// ==========================================================================
function openEditModal(item) {
    const modal = document.getElementById('editModal');
    if (!modal) return;

    document.getElementById('editNotulensiId').value = item.id;
    document.getElementById('editJenisNotulensi').value = item.jenisNotulensi || 'Evaluasi';
    document.getElementById('editTanggalFormatted').value = item.tanggal || '';
    document.getElementById('editPembuatNotulensi').value = item.pembuatNotulensi || '';
    document.getElementById('editNamaNotulensi').value = item.namaNotulensi || '';
    document.getElementById('editDetailNotulensi').value = item.detailNotulensi || '';
    document.getElementById('editPoinPembahasan').value = item.poinPembahasan || '';
    document.getElementById('editHasilDiskusi').value = item.hasilDiskusi || '';
    document.getElementById('editKeputusanMeeting').value = item.keputusanMeeting || '';
    document.getElementById('editActionPlan').value = item.actionPlan || '';
    document.getElementById('editPicTindakLanjut').value = item.picTindakLanjut || '';
    document.getElementById('editDeadlineTindakLanjut').value = item.deadlineTindakLanjut || '';

    state.editParticipantsDraft = [...(item.peserta || [])];
    renderParticipantsChips('editParticipantsChipsContainer', state.editParticipantsDraft, true);

    modal.classList.add('active');
}

async function handleSaveEdit() {
    const id = document.getElementById('editNotulensiId').value;
    const itemIndex = state.notulensiList.findIndex(x => x.id === id);
    if (itemIndex === -1) return;

    const jenis = document.getElementById('editJenisNotulensi').value;
    const tanggal = document.getElementById('editTanggalFormatted').value.trim();
    const pembuat = document.getElementById('editPembuatNotulensi').value.trim();
    const nama = document.getElementById('editNamaNotulensi').value.trim();
    const detail = document.getElementById('editDetailNotulensi').value.trim();
    const poin = document.getElementById('editPoinPembahasan').value.trim();
    const hasil = document.getElementById('editHasilDiskusi').value.trim();
    const keputusan = document.getElementById('editKeputusanMeeting').value.trim();
    const actionPlan = document.getElementById('editActionPlan').value.trim();
    const pic = document.getElementById('editPicTindakLanjut').value.trim();
    const deadline = document.getElementById('editDeadlineTindakLanjut').value.trim();

    if (!nama || !pembuat || !detail || state.editParticipantsDraft.length === 0) {
        showToast('Pastikan seluruh kolom wajib dan minimal 1 peserta terisi.', 'warning', 'Validasi Gagal');
        return;
    }

    const saveBtn = document.getElementById('saveEditBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    const existing = state.notulensiList[itemIndex];
    const updatedRecord = {
        ...existing,
        jenisNotulensi: jenis,
        tanggal: tanggal,
        pembuatNotulensi: pembuat,
        namaNotulensi: nama,
        peserta: [...state.editParticipantsDraft],
        detailNotulensi: detail,
        poinPembahasan: poin,
        hasilDiskusi: hasil,
        keputusanMeeting: keputusan,
        actionPlan: actionPlan,
        picTindakLanjut: pic,
        deadlineTindakLanjut: deadline,
        updatedAt: formatTimestampWIB(Date.now())
    };

    try {
        const updatedList = [...state.notulensiList];
        updatedList[itemIndex] = updatedRecord;

        await saveNotulensiListToFirebase(updatedList);
        state.notulensiList = updatedList;

        document.getElementById('editModal').classList.remove('active');
        showToast('Notulensi berhasil diperbarui!', 'success', 'Perubahan Disimpan');

        applySearchAndFilters();
        updateDashboardKPIs();
        renderRecentTable();

        // Jika detail modal sedang terbuka, perbarui isinya
        if (state.currentDetailItem && state.currentDetailItem.id === id) {
            openDetailModal(updatedRecord);
        }
    } catch (err) {
        console.error("Edit save error:", err);
        showToast('Gagal memperbarui: ' + err.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Simpan Perubahan</span>`;
    }
}

// ==========================================================================
// MODAL: DELETE CONFIRMATION
// ==========================================================================
function openDeleteModal(item) {
    state.itemToDeleteId = item.id;
    const modal = document.getElementById('deleteModal');
    const titleEl = document.getElementById('deleteItemTitle');
    if (!modal) return;

    if (titleEl) titleEl.textContent = `"${item.namaNotulensi || 'Notulensi'}"`;
    modal.classList.add('active');
}

async function handleConfirmDelete() {
    const id = state.itemToDeleteId;
    if (!id) return;

    const confirmBtn = document.getElementById('confirmDeleteBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menghapus...`;

    try {
        const updatedList = state.notulensiList.filter(x => x.id !== id);
        await saveNotulensiListToFirebase(updatedList);
        state.notulensiList = updatedList;

        document.getElementById('deleteModal').classList.remove('active');
        showToast('Notulensi berhasil dihapus dari sistem.', 'info', 'Dihapus');

        applySearchAndFilters();
        updateDashboardKPIs();
        renderRecentTable();

        // Close detail modal if the deleted item was currently viewed
        if (state.currentDetailItem && state.currentDetailItem.id === id) {
            document.getElementById('detailModal')?.classList.remove('active');
        }
    } catch (err) {
        console.error("Delete error:", err);
        showToast('Gagal menghapus notulensi: ' + err.message, 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> <span>Ya, Hapus Notulensi</span>`;
        state.itemToDeleteId = null;
    }
}

// ==========================================================================
// PDF GENERATION (HTML2PDF.JS)
// ==========================================================================
const ICONNET_LOGO_B64 = "data:image/webp;base64,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";

function generateNotulensiPdf(item) {
    showToast('Sedang membuat file PDF resmi...', 'info', 'Menyiapkan Dokumen');

    const renderArea = document.getElementById('pdfRenderArea');
    if (!renderArea) return;

    const pesertaRows = (item.peserta || []).map((p, idx) => `
        <tr>
            <td style="width: 40px; text-align: center;">${idx + 1}</td>
            <td>${escapeHtml(p)}</td>
            <td style="width: 120px; text-align: center; color: #0A66FF; font-weight: 600;">Hadir</td>
        </tr>
    `).join('');

    renderArea.innerHTML = `
        <div style="padding: 20px; color: #0F172A; font-family: 'Inter', sans-serif;">
            <!-- Header Dokumen Perusahaan -->
            <div style="border-bottom: 3px double #0A66FF; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 22px; font-weight: 800; color: #0A66FF; letter-spacing: -0.5px;">NOTULENSI DIGITAL</div>
                    <div style="font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: 600; letter-spacing: 1px; margin-top: 2px;">
                        Dokumentasi Resmi Rapat Internal Perusahaan
                    </div>
                </div>
                <div style="text-align: right; font-size: 11px; color: #64748B;">
                    <div>No. Dokumen: <strong>TL/${new Date().getFullYear()}/${item.id.substring(item.id.length - 6).toUpperCase()}</strong></div>
                    <div>Klasifikasi: <strong>${escapeHtml(item.jenisNotulensi)}</strong></div>
                </div>
            </div>

            <!-- Judul Notulensi -->
            <div style="margin-bottom: 20px; background-color: #F8FAFC; border-left: 4px solid #0A66FF; padding: 12px 16px; border-radius: 4px;">
                <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Nama / Topik Rapat</div>
                <div style="font-size: 16px; font-weight: 800; color: #0F172A; margin-top: 4px;">${escapeHtml(item.namaNotulensi || '-')}</div>
            </div>

            <!-- Tabel Identitas Rapat -->
            <table class="pdf-table" style="margin-bottom: 18px;">
                <tr>
                    <th style="width: 25%;">Jenis Notulensi</th>
                    <td style="width: 25%;"><strong>${escapeHtml(item.jenisNotulensi || '-')}</strong></td>
                    <th style="width: 25%;">Tanggal Pelaksanaan</th>
                    <td style="width: 25%;"><strong>${escapeHtml(item.tanggal || '-')}</strong></td>
                </tr>
                <tr>
                    <th>Pembuat / Notulis</th>
                    <td>${escapeHtml(item.pembuatNotulensi || '-')}</td>
                    <th>Waktu Dokumen Dibuat</th>
                    <td>${escapeHtml(item.createdAt || formatTimestampWIB(item.timestamp))}</td>
                </tr>
            </table>

            <!-- Tabel Peserta Rapat -->
            <div class="pdf-section-title">1. Daftar Peserta Rapat (${(item.peserta || []).length} Orang)</div>
            <table class="pdf-table" style="margin-bottom: 18px;">
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;">No.</th>
                        <th>Nama Lengkap Peserta</th>
                        <th style="width: 120px; text-align: center;">Status Kehadiran</th>
                    </tr>
                </thead>
                <tbody>
                    ${pesertaRows || '<tr><td colspan="3" style="text-align: center;">Tidak ada data peserta</td></tr>'}
                </tbody>
            </table>

            <!-- Detail Pembahasan -->
            <div class="pdf-section-title">2. Detail Pembahasan Rapat</div>
            <div class="pdf-content-box">${escapeHtml(item.detailNotulensi || '-')}</div>

            <!-- Poin Pembahasan & Hasil Diskusi -->
            <div class="pdf-section-title">3. Poin Inti & Hasil Diskusi</div>
            <table class="pdf-table" style="margin-bottom: 18px;">
                <tr>
                    <th style="width: 50%;">Poin Pembahasan</th>
                    <th style="width: 50%;">Hasil Diskusi</th>
                </tr>
                <tr>
                    <td style="vertical-align: top; line-height: 1.5;">${escapeHtml(item.poinPembahasan || '-')}</td>
                    <td style="vertical-align: top; line-height: 1.5;">${escapeHtml(item.hasilDiskusi || '-')}</td>
                </tr>
            </table>

            <!-- Keputusan Meeting -->
            <div class="pdf-section-title">4. Keputusan Meeting</div>
            <div class="pdf-content-box" style="background-color: #F0FDF4; border: 1px solid #86EFAC; color: #166534; font-weight: 600;">
                ${escapeHtml(item.keputusanMeeting || '-')}
            </div>

            <!-- Action Plan Table -->
            <div class="pdf-section-title">5. Tindak Lanjut & Action Plan</div>
            <table class="pdf-table" style="margin-bottom: 24px;">
                <thead>
                    <tr>
                        <th>Uraian Tindak Lanjut</th>
                        <th style="width: 28%;">PIC (Penanggung Jawab)</th>
                        <th style="width: 22%;">Tenggat Waktu (Deadline)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${escapeHtml(item.actionPlan || '-')}</td>
                        <td><strong>${escapeHtml(item.picTindakLanjut || '-')}</strong></td>
                        <td style="color: #DC2626; font-weight: 600;">${escapeHtml(isoToIndoDate(item.deadlineTindakLanjut) || '-')}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Kolom Tanda Tangan -->
            <div class="pdf-signature-row">
                <div class="pdf-sign-box">
                    <div>Dicatat oleh (Notulis),</div>
                    <div class="pdf-sign-space"></div>
                    <div class="pdf-sign-name">${escapeHtml(item.pembuatNotulensi || 'Notulis')}</div>
                    <div style="font-size: 10px; color: #64748B;">Notulensi Rapat</div>
                </div>
                <div class="pdf-sign-box">
                    <div>Disetujui oleh (Pimpinan Forum),</div>
                    <div class="pdf-sign-space"></div>
                    <div class="pdf-sign-name">Pimpinan Rapat</div>
                    <div style="font-size: 10px; color: #64748B;">Team Leader / Manager</div>
                </div>
            </div>
        </div>
    `;

    const cleanTitle = (item.namaNotulensi || 'Meeting').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const filename = `Notulensi_${item.jenisNotulensi}_${cleanTitle}_${(item.tanggal || '').replace(/\//g, '-')}.pdf`;

    const opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(renderArea).save().then(() => {
        showToast(`Dokumen "${filename}" berhasil diunduh.`, 'success', 'PDF Siap');
    }).catch(err => {
        console.error("PDF generation failed:", err);
        showToast('Gagal mengunduh PDF: ' + err.message, 'error');
    });
}

// ==========================================================================
// UTILITY: ESCAPE HTML
// ==========================================================================
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================================================
// INITIALIZATION & EVENT LISTENERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. Inisialisasi Tanggal WIB di Formulir & Dashboard Banner
    const todayIndo = getTodayDateIndo();
    const todayISO = getTodayDateISO();
    
    const bannerEl = document.getElementById('currentDateIndoBanner');
    if (bannerEl) bannerEl.textContent = getIndonesianLongDate();

    const dateFormattedInput = document.getElementById('tanggalNotulensiFormatted');
    const dateHiddenPicker = document.getElementById('tanggalPickerHidden');

    if (dateFormattedInput) dateFormattedInput.value = todayIndo;
    if (dateHiddenPicker) dateHiddenPicker.value = todayISO;

    // Sinkronisasi pemilih tanggal kalender dengan input teks
    if (dateHiddenPicker && dateFormattedInput) {
        dateHiddenPicker.addEventListener('change', () => {
            dateFormattedInput.value = isoToIndoDate(dateHiddenPicker.value);
        });
    }

    // 2. Toolbar Rich Format
    setupTextareaToolbar('.textarea-toolbar', 'detailNotulensi');

    // 3. Tambah Peserta Meeting (Form Utama)
    const addParticipantBtn = document.getElementById('addParticipantBtn');
    const participantInput = document.getElementById('participantInput');
    if (addParticipantBtn && participantInput) {
        addParticipantBtn.addEventListener('click', () => {
            handleAddParticipant('participantInput', state.participantsDraft, 'participantsChipsContainer', false);
        });
        participantInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddParticipant('participantInput', state.participantsDraft, 'participantsChipsContainer', false);
            }
        });
    }

    // 4. Tambah Peserta Meeting (Modal Edit)
    const editAddParticipantBtn = document.getElementById('editAddParticipantBtn');
    const editParticipantInput = document.getElementById('editParticipantInput');
    if (editAddParticipantBtn && editParticipantInput) {
        editAddParticipantBtn.addEventListener('click', () => {
            handleAddParticipant('editParticipantInput', state.editParticipantsDraft, 'editParticipantsChipsContainer', true);
        });
        editParticipantInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddParticipant('editParticipantInput', state.editParticipantsDraft, 'editParticipantsChipsContainer', true);
            }
        });
    }

    // 5. Submit Form Simpan Notulensi
    const notulensiForm = document.getElementById('notulensiForm');
    if (notulensiForm) {
        notulensiForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSaveNotulensi();
        });
    }

    // 6. Tombol Reset Form
    const resetFormBtn = document.getElementById('resetFormBtn');
    const resetFormBtnTop = document.getElementById('resetFormBtnTop');
    if (resetFormBtn) resetFormBtn.addEventListener('click', resetCreateForm);
    if (resetFormBtnTop) resetFormBtnTop.addEventListener('click', resetCreateForm);

    // 7. Preview Notulensi Button
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) previewBtn.addEventListener('click', openPreviewModal);

    const previewConfirmSaveBtn = document.getElementById('previewConfirmSaveBtn');
    if (previewConfirmSaveBtn) {
        previewConfirmSaveBtn.addEventListener('click', () => {
            document.getElementById('previewModal')?.classList.remove('active');
            handleSaveNotulensi();
        });
    }

    // 8. Search Bar Input (Instant Real-time Search)
    const searchInput = document.getElementById('mainSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            state.currentFilter.searchQuery = e.target.value;
            if (clearSearchBtn) {
                if (e.target.value.length > 0) {
                    clearSearchBtn.classList.add('visible');
                } else {
                    clearSearchBtn.classList.remove('visible');
                }
            }
            applySearchAndFilters();
        });
    }

    if (clearSearchBtn && searchInput) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            state.currentFilter.searchQuery = '';
            clearSearchBtn.classList.remove('visible');
            searchInput.focus();
            applySearchAndFilters();
        });
    }

    // 9. Kategori Filter Pills (Semua, Evaluasi, Kalibrasi)
    const categoryPills = document.querySelectorAll('#categoryFilterPills .pill-btn');
    categoryPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            categoryPills.forEach(p => p.classList.remove('active'));
            e.currentTarget.classList.add('active');
            state.currentFilter.category = e.currentTarget.getAttribute('data-category');
            applySearchAndFilters();
        });
    });

    // 10. Periode Filter Dropdown & Custom Date Range
    const periodFilterSelect = document.getElementById('periodFilterSelect');
    const customDateRangeBox = document.getElementById('customDateRangeBox');
    const customStartDate = document.getElementById('customStartDate');
    const customEndDate = document.getElementById('customEndDate');

    if (periodFilterSelect) {
        periodFilterSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            state.currentFilter.period = val;

            if (val === 'CUSTOM') {
                if (customDateRangeBox) customDateRangeBox.classList.add('active');
            } else {
                if (customDateRangeBox) customDateRangeBox.classList.remove('active');
                state.currentFilter.startDate = '';
                state.currentFilter.endDate = '';
                applySearchAndFilters();
            }
        });
    }

    if (customStartDate) {
        customStartDate.addEventListener('change', (e) => {
            state.currentFilter.startDate = e.target.value;
            applySearchAndFilters();
        });
    }

    if (customEndDate) {
        customEndDate.addEventListener('change', (e) => {
            state.currentFilter.endDate = e.target.value;
            applySearchAndFilters();
        });
    }

    // 11. Urutan Sorting Select
    const sortOrderSelect = document.getElementById('sortOrderSelect');
    if (sortOrderSelect) {
        sortOrderSelect.addEventListener('change', (e) => {
            state.currentFilter.sortOrder = e.target.value;
            applySearchAndFilters();
        });
    }

    // 12. Reset Filter & Search Button (Empty state button)
    const resetSearchAndFilterBtn = document.getElementById('resetSearchAndFilterBtn');
    if (resetSearchAndFilterBtn) {
        resetSearchAndFilterBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            state.currentFilter.searchQuery = '';
            if (clearSearchBtn) clearSearchBtn.classList.remove('visible');

            state.currentFilter.category = 'ALL';
            categoryPills.forEach(p => {
                if (p.getAttribute('data-category') === 'ALL') p.classList.add('active');
                else p.classList.remove('active');
            });

            state.currentFilter.period = 'ALL';
            if (periodFilterSelect) periodFilterSelect.value = 'ALL';
            if (customDateRangeBox) customDateRangeBox.classList.remove('active');
            if (customStartDate) customStartDate.value = '';
            if (customEndDate) customEndDate.value = '';

            state.currentFilter.sortOrder = 'NEWEST';
            if (sortOrderSelect) sortOrderSelect.value = 'NEWEST';

            applySearchAndFilters();
        });
    }

    // 13. Tombol Refresh Data
    const refreshDataBtn = document.getElementById('refreshDataBtn');
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', () => {
            showToast('Menyinkronkan data dengan Firestore...', 'info', 'Sinkronisasi');
            applySearchAndFilters();
            updateDashboardKPIs();
            renderRecentTable();
        });
    }

    // 14. Action buttons inside Detail Modal
    const modalEditBtn = document.getElementById('modalEditBtn');
    if (modalEditBtn) {
        modalEditBtn.addEventListener('click', () => {
            if (state.currentDetailItem) {
                document.getElementById('detailModal')?.classList.remove('active');
                openEditModal(state.currentDetailItem);
            }
        });
    }

    const modalDownloadPdfBtn = document.getElementById('modalDownloadPdfBtn');
    if (modalDownloadPdfBtn) {
        modalDownloadPdfBtn.addEventListener('click', () => {
            if (state.currentDetailItem) {
                generateNotulensiPdf(state.currentDetailItem);
            }
        });
    }

    // 15. Save Edit Button
    const saveEditBtn = document.getElementById('saveEditBtn');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', handleSaveEdit);
    }

    // 16. Delete Confirmation Button
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    }

    // 17. Modal Close Buttons (delegated)
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = btn.getAttribute('data-close-modal');
            const target = document.getElementById(modalId);
            if (target) target.classList.remove('active');
        });
    });

    // Close modal on click outside content
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });

    // 18. Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            navMenu.classList.toggle('open');
        });
    }

    // 19. Hash change routing
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash || '#dashboard';
        if (hash === '#dashboard') switchView('dashboardView');
        else if (hash === '#create') switchView('createView');
        else if (hash === '#history') switchView('historyView');
    });

    // Initial Route
    const initialHash = window.location.hash || '#dashboard';
    if (initialHash === '#create') switchView('createView');
    else if (initialHash === '#history') switchView('historyView');
    else switchView('dashboardView');

    // 20. Inisialisasi Layanan Firebase Firestore Real-Time
    initFirebaseService(
        // On Data Update Callback
        (list, fromCache) => {
            state.notulensiList = list || [];
            updateDashboardKPIs();
            renderRecentTable();
            applySearchAndFilters();
            if (!fromCache && list.length > 0) {
                console.log(`Firestore data disinkronkan (${list.length} rekaman)`);
            }
        },
        // On Connection Status Callback
        (statusObj) => {
            const dot = document.getElementById('statusDot');
            const text = document.getElementById('statusText');
            if (!dot || !text) return;

            dot.className = 'status-dot ' + statusObj.status;
            text.textContent = statusObj.message;
        }
    );
});
