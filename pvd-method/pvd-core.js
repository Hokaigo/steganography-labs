import { showToast } from './error-handler.js';
const actionBtn = document.getElementById("actionBtn");
const inputImg = document.getElementById("inputImg");
const modeEncrypt = document.getElementById("modeEncrypt");
const encryptSection = document.getElementById("encryptSection");
const inputTextTextArea = document.getElementById("inputTextTextArea");
const outputCanvas = document.getElementById("outputCanvas");
const downloadBtn = document.getElementById("downloadBtn");
const decryptedTextOutput = document.getElementById("decryptedTextOutput");
document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const isEncrypt = modeEncrypt.checked;
        encryptSection.style.display = isEncrypt ? "block" : "none";
        actionBtn.textContent = isEncrypt ? "Зашифрувати" : "Розшифрувати";
        outputCanvas.classList.add("hidden");
        downloadBtn.classList.add("hidden");
        decryptedTextOutput.classList.add("hidden");
    });
});
actionBtn.addEventListener("click", async () => {
    try {
        if (!inputImg.files || inputImg.files.length === 0) {
            throw new Error("Будь ласка, оберіть зображення.");
        }
        if (inputImg.files.length > 1) {
            throw new Error("Можна завантажити лише одне зображення.");
        }
        const file = inputImg.files[0];
        const isValid = await isPngOrBmp(file);
        if (!isValid) {
            throw new Error("Невірний формат. Підтримуються лише PNG або BMP.");
        }
        outputCanvas.classList.add("hidden");
        downloadBtn.classList.add("hidden");
        decryptedTextOutput.classList.add("hidden");
        if (modeEncrypt.checked) {
            const text = inputTextTextArea.value;
            if (!text) {
                throw new Error("Введіть текст для шифрування.");
            }
            await encodeImage(file, text);
        }
        else {
            await decodeImage(file);
        }
    }
    catch (err) {
        showToast(err.message, 'error');
    }
});
async function isPngOrBmp(file) {
    const headerBlob = file.slice(0, 8);
    const headerArrayBuffer = await headerBlob.arrayBuffer();
    const headerBytes = new Uint8Array(headerArrayBuffer);
    if (headerBytes[0] === 0x89 && headerBytes[1] === 0x50 &&
        headerBytes[2] === 0x4E && headerBytes[3] === 0x47) {
        return true;
    }
    if (headerBytes[0] === 0x42 && headerBytes[1] === 0x4D) {
        return true;
    }
    return false;
}
async function loadImageToCanvas(file, canvas) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx)
                    return reject(new Error("Помилка отримання контексту Canvas"));
                ctx.drawImage(img, 0, 0);
                resolve(ctx);
            };
            img.onerror = () => reject(new Error("Помилка завантаження зображення у Canvas"));
            img.src = e.target?.result;
        };
        reader.onerror = () => reject(new Error("Помилка читання файлу"));
        reader.readAsDataURL(file);
    });
}
const PVD_RANGES = [
    { lower: 0, upper: 7, bits: 3 },
    { lower: 8, upper: 15, bits: 3 },
    { lower: 16, upper: 31, bits: 4 },
    { lower: 32, upper: 63, bits: 5 },
    { lower: 64, upper: 127, bits: 6 },
    { lower: 128, upper: 255, bits: 7 }
];
export function getPvdRange(delta) {
    return PVD_RANGES.find(r => delta >= r.lower && delta <= r.upper) || null;
}
function embedPvdPair(p1, p2, secretValue, lowerBound) {
    const d = Math.abs(p1 - p2);
    const d_new = lowerBound + secretValue;
    const m = d_new - d;
    const delta_p1 = m !== 0 ? Math.floor(Math.abs(m) / 2) : 0;
    const delta_p2 = m !== 0 ? Math.ceil(Math.abs(m) / 2) : 0;
    let p1_raw = p1;
    let p2_raw = p2;
    if (m > 0) {
        if (p2 >= p1) {
            p1_raw = p1 - delta_p1;
            p2_raw = p2 + delta_p2;
        }
        else {
            p1_raw = p1 + delta_p1;
            p2_raw = p2 - delta_p2;
        }
    }
    else if (m < 0) {
        if (p2 >= p1) {
            p1_raw = p1 + delta_p1;
            p2_raw = p2 - delta_p2;
        }
        else {
            p1_raw = p1 - delta_p1;
            p2_raw = p2 + delta_p2;
        }
    }
    const overflow1 = p1_raw < 0 ? p1_raw : (p1_raw > 255 ? p1_raw - 255 : 0);
    const overflow2 = p2_raw < 0 ? p2_raw : (p2_raw > 255 ? p2_raw - 255 : 0);
    const p1_new = Math.max(0, Math.min(255, p1_raw - overflow2));
    const p2_new = Math.max(0, Math.min(255, p2_raw - overflow1));
    return [p1_new, p2_new];
}
export async function encodeImage(file, text) {
    outputCanvas.classList.remove("hidden");
    const ctx = await loadImageToCanvas(file, outputCanvas);
    const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const pixels = imageData.data;
    const textToEncode = text + 'END';
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(textToEncode);
    let bitIndex = 0;
    const totalBits = textBytes.length * 8;
    const hasNextBits = () => bitIndex < totalBits;
    const readBits = (n) => {
        let value = 0;
        for (let i = 0; i < n; i++) {
            let bit = 0;
            if (bitIndex < totalBits) {
                const byteIndex = Math.floor(bitIndex / 8);
                const bitOffset = 7 - (bitIndex % 8);
                bit = (textBytes[byteIndex] >> bitOffset) & 1;
            }
            value = (value << 1) | bit;
            bitIndex++;
        }
        return value;
    };
    for (let i = 0; i < pixels.length - 7; i += 8) {
        if (!hasNextBits())
            break;
        for (let c = 0; c < 3; c++) {
            if (!hasNextBits())
                break;
            const p1 = pixels[i + c];
            const p2 = pixels[i + 4 + c];
            const delta = Math.abs(p1 - p2);
            const range = getPvdRange(delta);
            if (!range)
                continue;
            const secretBits = readBits(range.bits);
            const [new_p1, new_p2] = embedPvdPair(p1, p2, secretBits, range.lower);
            pixels[i + c] = new_p1;
            pixels[i + 4 + c] = new_p2;
        }
    }
    if (hasNextBits()) {
        throw new Error("Текст занадто довгий для цього зображення (не вистачає контрастних ділянок).");
    }
    ctx.putImageData(imageData, 0, 0);
    downloadBtn.classList.remove("hidden");
    downloadBtn.onclick = () => {
        const link = document.createElement("a");
        link.download = "encrypted_pvd.png";
        link.href = outputCanvas.toDataURL("image/png");
        link.click();
    };
}
export async function decodeImage(file) {
    const ctx = await loadImageToCanvas(file, outputCanvas);
    outputCanvas.classList.remove("hidden");
    const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const pixels = imageData.data;
    const textBytes = [];
    let buffer = 0;
    let bitsInBuffer = 0;
    const writeBits = (value, n) => {
        for (let i = n - 1; i >= 0; i--) {
            const bit = (value >> i) & 1;
            buffer = (buffer << 1) | bit;
            bitsInBuffer++;
            if (bitsInBuffer === 8) {
                textBytes.push(buffer);
                buffer = 0;
                bitsInBuffer = 0;
            }
        }
    };
    const checkEndMarker = () => {
        const len = textBytes.length;
        if (len >= 3) {
            if (textBytes[len - 3] === 69 &&
                textBytes[len - 2] === 78 &&
                textBytes[len - 1] === 68) {
                const messageBytes = new Uint8Array(textBytes.slice(0, len - 3));
                const decoder = new TextDecoder("utf-8");
                return decoder.decode(messageBytes);
            }
        }
        return null;
    };
    for (let i = 0; i < pixels.length - 7; i += 8) {
        for (let c = 0; c < 3; c++) {
            const p1 = pixels[i + c];
            const p2 = pixels[i + 4 + c];
            const delta = Math.abs(p1 - p2);
            const range = getPvdRange(delta);
            if (!range)
                continue;
            const secretValue = delta - range.lower;
            writeBits(secretValue, range.bits);
            const decodedText = checkEndMarker();
            if (decodedText !== null) {
                decryptedTextOutput.textContent = "Розшифрований текст: \n" + decodedText;
                decryptedTextOutput.classList.remove("hidden");
                downloadBtn.classList.add("hidden");
                return;
            }
        }
    }
    throw new Error("Не знайдено маркер 'END'. Зображення не містить PVD тексту або воно пошкоджене.");
}
