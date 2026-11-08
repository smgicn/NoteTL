// Firebase Configuration & Service Layer
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Konfigurasi resmi Firebase Project kabinnet12-d8305
const firebaseConfig = {
    apiKey: "AIzaSyDl3wX5h-AM9vOg3qtePl6wAl2vNS_lN2Y",
    authDomain: "kabinnet12-d8305.firebaseapp.com",
    projectId: "kabinnet12-d8305",
    storageBucket: "kabinnet12-d8305.firebasestorage.app",
    messagingSenderId: "504059668634",
    appId: "1:504059668634:web:d31810dff98697b9801723",
    measurementId: "G-SCQ4HRKKW2"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const APP_DOC_REF = doc(db, "app", "notulensiData");
const LOCAL_STORAGE_KEY = "TLNOTE_notulensi_cache";

let isOnline = navigator.onLine;
let authReady = false;
let pendingSave = null;

// Silent admin authentication untuk write access ke Firestore
async function ensureAuth() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                authReady = true;
                resolve(user);
            } else {
                try {
                    const cred = await signInWithEmailAndPassword(auth, "admin@kabinnet.com", "Smg1234");
                    authReady = true;
                    resolve(cred.user);
                } catch (err) {
                    console.warn("Silent auth fallback or failed:", err);
                    resolve(null);
                }
            }
        });
    });
}

// Inisialisasi listener real-time Firestore
export async function initFirebaseService(onDataUpdate, onStatusUpdate) {
    onStatusUpdate({ status: 'connecting', message: 'Menghubungkan ke Firebase...' });

    // Cek cache lokal dulu untuk render instan
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
                onDataUpdate(parsed, true); // true = from cache
            }
        } catch (e) {
            console.error("Error reading cache:", e);
        }
    }

    try {
        await ensureAuth();
        onStatusUpdate({ status: 'connected', message: 'Terhubung ke Firebase Firestore' });
    } catch (e) {
        console.warn("Auth initialization note:", e);
        onStatusUpdate({ status: 'offline', message: 'Mode Offline (Penyimpanan Lokal Aktif)' });
    }

    // Pasang real-time snapshot listener ke Firestore
    try {
        onSnapshot(APP_DOC_REF, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                let list = [];
                if (data.jsonData) {
                    try {
                        const parsed = JSON.parse(data.jsonData);
                        list = Array.isArray(parsed) ? parsed : (parsed.notulensi || []);
                    } catch (err) {
                        console.error("JSON parse error:", err);
                    }
                } else if (Array.isArray(data.items)) {
                    list = data.items;
                }

                // Simpan juga ke cache lokal
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
                onStatusUpdate({ status: 'connected', message: 'Terhubung ke Firebase Firestore' });
                onDataUpdate(list, false);
            } else {
                // Dokumen belum ada, buat struktur awal
                console.log("Inisialisasi dokumen baru notulensiData...");
                setDoc(APP_DOC_REF, { jsonData: JSON.stringify([]), updatedAt: Date.now() }, { merge: true })
                    .catch(err => console.error("Initial doc error:", err));
                onDataUpdate([], false);
            }
        }, (error) => {
            console.error("Firestore snapshot error:", error);
            onStatusUpdate({ status: 'error', message: 'Koneksi Firestore terganggu: ' + error.message });
        });
    } catch (err) {
        console.error("Failed to setup snapshot listener:", err);
        onStatusUpdate({ status: 'offline', message: 'Koneksi Offline' });
    }

    // Monitor event online/offline browser
    window.addEventListener('online', async () => {
        onStatusUpdate({ status: 'connecting', message: 'Menyambungkan kembali...' });
        await ensureAuth();
        onStatusUpdate({ status: 'connected', message: 'Terhubung ke Firebase Firestore' });
    });

    window.addEventListener('offline', () => {
        onStatusUpdate({ status: 'offline', message: 'Koneksi Internet Terputus (Mode Offline)' });
    });
}

// Simpan data notulensi ke Firestore
export async function saveNotulensiListToFirebase(list) {
    // 1. Simpan selalu ke localStorage sebagai fail-safe instan
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));

    // 2. Simpan ke Firestore
    try {
        await ensureAuth();
        await setDoc(APP_DOC_REF, {
            jsonData: JSON.stringify(list),
            totalRecords: list.length,
            updatedAt: Date.now()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error("Error saving to Firebase:", error);
        // Jika gagal karena auth, coba re-auth sekali
        try {
            await signInWithEmailAndPassword(auth, "admin@kabinnet.com", "Smg1234");
            await setDoc(APP_DOC_REF, {
                jsonData: JSON.stringify(list),
                totalRecords: list.length,
                updatedAt: Date.now()
            }, { merge: true });
            return { success: true };
        } catch (retryErr) {
            console.error("Retry failed:", retryErr);
            throw new Error("Gagal menyimpan ke Firestore: " + (retryErr.message || error.message));
        }
    }
}

export { db, auth };
