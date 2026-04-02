import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, Keyboard, Volume2, VolumeX, CheckCircle, AlertTriangle, Loader } from 'lucide-react';

/**
 * BarcodeScanner — Modal overlay for scanning barcodes/QR codes via camera.
 * Supports continuous scan, manual input, beep feedback, and mobile-first UI.
 *
 * Props:
 *   isOpen       — whether the scanner modal is visible
 *   onClose      — callback to close the modal
 *   onScan       — async callback(resi) when a resi is scanned/entered
 *   scannedResis — Set of already-scanned resis (for duplicate detection)
 */
function BarcodeScanner({ isOpen, onClose, onScan, scannedResis = new Set() }) {
    const [scanning, setScanning] = useState(false);
    const [manualMode, setManualMode] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [saving, setSaving] = useState(false);
    const [scanHistory, setScanHistory] = useState([]);
    const [cameraError, setCameraError] = useState(null);
    const scannerRef = useRef(null);
    const feedbackTimeoutRef = useRef(null);
    const audioCtxRef = useRef(null);
    const lastDetectedRef = useRef({ text: '', time: 0 });

    // Beep sound using Web Audio API
    const playBeep = useCallback((success = true) => {
        if (!soundEnabled) return;
        try {
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const ctx = audioCtxRef.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = success ? 1200 : 400;
            osc.type = 'sine';
            gain.gain.value = 0.3;
            osc.start();
            osc.stop(ctx.currentTime + (success ? 0.15 : 0.3));
        } catch (e) { /* ignore audio errors */ }
    }, [soundEnabled]);

    const vibrate = useCallback((success = true) => {
        if (navigator.vibrate) navigator.vibrate(success ? [50] : [100, 50, 100]);
    }, []);

    const showFeedback = useCallback((type, text) => {
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        setFeedback({ type, text });
        feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 3000);
    }, []);

    // Handle a detected resi
    const handleDetected = useCallback(async (resi) => {
        const trimmed = resi.trim();
        if (!trimmed) return;

        if (scannedResis.has(trimmed)) {
            playBeep(false);
            vibrate(false);
            showFeedback('duplicate', `Resi "${trimmed}" sudah pernah discan`);
            return;
        }

        setSaving(true);
        try {
            await onScan(trimmed);
            playBeep(true);
            vibrate(true);
            showFeedback('success', `✅ ${trimmed}`);
            setScanHistory(prev => [{ resi: trimmed, time: new Date() }, ...prev.slice(0, 19)]);
        } catch (err) {
            playBeep(false);
            vibrate(false);
            if (err.duplicate) {
                showFeedback('duplicate', `Resi "${trimmed}" sudah pernah discan`);
            } else {
                showFeedback('error', err.message || 'Gagal menyimpan resi');
            }
        }
        setSaving(false);
    }, [onScan, scannedResis, playBeep, vibrate, showFeedback]);

    // Request camera permission explicitly
    const requestCameraPermission = useCallback(async () => {
        // Check if we're in a secure context (HTTPS or localhost)
        if (!window.isSecureContext) {
            setCameraError('Kamera membutuhkan HTTPS. Buka dengan https:// atau gunakan input manual.');
            return false;
        }
        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError('API kamera tidak tersedia di browser ini. Coba buka dengan HTTPS atau gunakan browser lain.');
            return false;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            // Got permission — stop the stream immediately, html5-qrcode will open its own
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (err) {
            console.error('Camera permission denied:', err);
            if (err.name === 'NotAllowedError') {
                setCameraError('Izin kamera ditolak. Buka Pengaturan browser → izinkan akses kamera.');
            } else if (err.name === 'NotFoundError') {
                setCameraError('Kamera tidak ditemukan di perangkat ini.');
            } else if (err.name === 'NotReadableError') {
                setCameraError('Kamera sedang digunakan aplikasi lain. Tutup aplikasi kamera dan coba lagi.');
            } else {
                setCameraError(`Gagal mengakses kamera: ${err.message}`);
            }
            return false;
        }
    }, []);

    // Start camera scanner
    const startScanner = useCallback(async () => {
        if (scannerRef.current) return;
        setCameraError(null);

        // Step 1: explicitly request camera permission
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) {
            setManualMode(true);
            return;
        }

        // Step 2: wait for DOM to be ready
        const scanRegion = document.getElementById('scan-region');
        if (!scanRegion) return;

        try {
            const html5Qr = new Html5Qrcode('scan-region');
            scannerRef.current = html5Qr;

            await html5Qr.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: (vw, vh) => {
                        const w = Math.floor(vw * 0.85);
                        const h = Math.floor(vh * 0.35);
                        return { width: Math.max(w, 250), height: Math.max(h, 100) };
                    },
                    aspectRatio: window.innerWidth < 768 ? 1.777 : 1.333,
                    disableFlip: false,
                },
                (decodedText) => {
                    const now = Date.now();
                    if (decodedText === lastDetectedRef.current.text && now - lastDetectedRef.current.time < 3000) return;
                    lastDetectedRef.current = { text: decodedText, time: now };
                    handleDetected(decodedText);
                },
                () => { /* ignore scan failures */ }
            );
            setScanning(true);
        } catch (err) {
            console.error('Scanner start error:', err);
            setCameraError('Gagal membuka kamera. Coba gunakan input manual.');
            setManualMode(true);
        }
    }, [handleDetected, requestCameraPermission]);

    // Stop camera scanner
    const stopScanner = useCallback(async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (e) { /* ignore */ }
            scannerRef.current = null;
        }
        setScanning(false);
    }, []);

    // Auto-start scanner when modal opens
    useEffect(() => {
        if (isOpen && !manualMode) {
            const timer = setTimeout(() => startScanner(), 400);
            return () => clearTimeout(timer);
        }
    }, [isOpen, manualMode, startScanner]);

    // Cleanup on close
    useEffect(() => {
        if (!isOpen) {
            stopScanner();
            setManualMode(false);
            setManualInput('');
            setFeedback(null);
            setScanHistory([]);
            setCameraError(null);
        }
    }, [isOpen, stopScanner]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                try { scannerRef.current.stop(); scannerRef.current.clear(); } catch (e) { }
            }
            if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        };
    }, []);

    // Handle manual submit
    const handleManualSubmit = async (e) => {
        e.preventDefault();
        const val = manualInput.trim();
        if (!val) return;
        await handleDetected(val);
        setManualInput('');
    };

    // Toggle between camera and manual
    const toggleMode = async () => {
        if (manualMode) {
            setManualMode(false);
            setCameraError(null);
        } else {
            await stopScanner();
            setManualMode(true);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Top Bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(10px)',
            }}>
                <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Camera size={18} /> Scan Resi
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={() => setSoundEnabled(!soundEnabled)} style={iconBtnStyle} title={soundEnabled ? 'Matikan suara' : 'Nyalakan suara'}>
                        {soundEnabled ? <Volume2 size={18} color="#fff" /> : <VolumeX size={18} color="#888" />}
                    </button>
                    <button onClick={toggleMode} style={iconBtnStyle} title={manualMode ? 'Mode Kamera' : 'Input Manual'}>
                        {manualMode ? <Camera size={18} color="#fff" /> : <Keyboard size={18} color="#fff" />}
                    </button>
                    <button onClick={onClose} style={{ ...iconBtnStyle, background: 'rgba(239,68,68,0.3)' }} title="Tutup">
                        <X size={18} color="#fff" />
                    </button>
                </div>
            </div>

            {/* Feedback Banner */}
            {feedback && (
                <div style={{
                    padding: '0.625rem 1rem', textAlign: 'center', fontWeight: 700, fontSize: '0.875rem',
                    background: feedback.type === 'success' ? 'rgba(34,197,94,0.2)' :
                        feedback.type === 'duplicate' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                    color: feedback.type === 'success' ? '#4ade80' :
                        feedback.type === 'duplicate' ? '#fbbf24' : '#f87171',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}>
                    {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {feedback.text}
                </div>
            )}

            {/* Camera Error */}
            {cameraError && (
                <div style={{
                    padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, fontSize: '0.8125rem',
                    background: 'rgba(239,68,68,0.15)', color: '#f87171',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                }}>
                    <AlertTriangle size={20} />
                    {cameraError}
                    <button onClick={() => { setCameraError(null); setManualMode(false); }}
                        style={{ marginTop: '0.25rem', padding: '0.375rem 1rem', borderRadius: '0.5rem', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
                        Coba Lagi
                    </button>
                </div>
            )}

            {/* Scanner Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: manualMode ? '1rem' : '0', overflow: 'hidden' }}>
                {manualMode ? (
                    <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
                        <p style={{ color: '#ccc', textAlign: 'center', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            Ketik nomor resi secara manual
                        </p>
                        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                value={manualInput}
                                onChange={e => setManualInput(e.target.value)}
                                placeholder="Nomor resi..."
                                autoFocus
                                style={{
                                    flex: 1, padding: '0.875rem 1rem', fontSize: '1rem', fontWeight: 600,
                                    borderRadius: '0.75rem', border: '2px solid rgba(124,58,237,0.5)',
                                    background: 'rgba(255,255,255,0.1)', color: '#fff', outline: 'none',
                                }}
                            />
                            <button type="submit" disabled={!manualInput.trim() || saving}
                                style={{
                                    padding: '0.875rem 1.5rem', fontSize: '1rem', fontWeight: 700,
                                    borderRadius: '0.75rem', border: 'none',
                                    background: manualInput.trim() && !saving ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' : '#555',
                                    color: '#fff', cursor: manualInput.trim() && !saving ? 'pointer' : 'default',
                                    opacity: saving ? 0.7 : 1,
                                }}>
                                {saving ? '...' : 'Simpan'}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div style={{ width: '100%', height: '100%', position: 'relative', flex: 1 }}>
                        <div id="scan-region" style={{
                            width: '100%', height: '100%', overflow: 'hidden',
                            background: '#000',
                        }} />
                        {!scanning && !cameraError && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(0,0,0,0.6)', gap: '0.75rem',
                            }}>
                                <Loader size={32} color="#7c3aed" className="spin" />
                                <span style={{ color: '#999', fontSize: '0.8125rem' }}>Meminta izin kamera...</span>
                            </div>
                        )}
                        {scanning && (
                            <p style={{ color: '#999', textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', position: 'absolute', bottom: 0, left: 0, right: 0, margin: 0, background: 'rgba(0,0,0,0.5)' }}>
                                Arahkan kamera ke barcode atau QR code resi
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Session History */}
            {scanHistory.length > 0 && (
                <div style={{
                    maxHeight: '160px', overflowY: 'auto',
                    padding: '0.5rem 1rem',
                    background: 'rgba(0,0,0,0.5)',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <p style={{ color: '#999', fontSize: '0.6875rem', fontWeight: 700, marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Riwayat Scan ({scanHistory.length})
                    </p>
                    {scanHistory.map((item, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.25rem 0', fontSize: '0.8125rem',
                        }}>
                            <CheckCircle size={12} color="#4ade80" />
                            <span style={{ color: '#e5e7eb', fontWeight: 600, fontFamily: 'monospace' }}>{item.resi}</span>
                            <span style={{ color: '#666', fontSize: '0.6875rem', marginLeft: 'auto' }}>
                                {item.time.toLocaleTimeString('id-ID')}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const iconBtnStyle = {
    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '0.5rem',
    padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export default BarcodeScanner;
