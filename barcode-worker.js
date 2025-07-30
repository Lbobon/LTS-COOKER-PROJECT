// barcode-worker.js  – runs inside Web Worker
// Loads @undecaf/zbar-wasm (wrapper adds global `zbarWasm`).

importScripts('wasm/index.js');

// Tell wrapper where to fetch its .wasm (path is relative to page root)
zbarWasm.setModuleArgs({
  locateFile: () => 'wasm/zbar.wasm',
});

// Inform main thread we’re ready
self.postMessage({ type: 'workerReady' });

self.onmessage = async (e) => {
  if (e.data.type !== 'scanImage') return;

  try {
    const { imageData } = e.data;
    const symbols = await zbarWasm.scanImageData(imageData);
    if (symbols.length) {
      self.postMessage({
        type: 'scanResult',
        result: symbols.map((s) => s.decode()),
      });
    }
  } catch (err) {
    console.error('Worker scan error:', err);
    self.postMessage({ type: 'scanError', message: err.toString() });
  }
};