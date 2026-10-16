// Captura el micrófono a 16 kHz y lo entrega como PCM16 en bloques de ~100 ms.
// Archivo estático (no blob:) para cumplir la CSP script-src 'self'.
class Pcm16Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) this.buf.push(ch[i]);
      if (this.buf.length >= 1600) {
        const out = new Int16Array(this.buf.length);
        for (let i = 0; i < this.buf.length; i++) {
          const s = Math.max(-1, Math.min(1, this.buf[i]));
          out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(out.buffer, [out.buffer]);
        this.buf = [];
      }
    }
    return true;
  }
}
registerProcessor("pcm16-capture", Pcm16Capture);
