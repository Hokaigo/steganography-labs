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
export async function encodeImage(file, text) {
    outputCanvas.classList.remove("hidden");
    const ctx = await loadImageToCanvas(file, outputCanvas);
    const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const pixels = imageData.data;
    const textToEncode = text + 'END';
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(textToEncode);
    const totalAvailableBits = Math.floor((pixels.length / 4) * 3);
    const requiredBits = textBytes.length * 8;
    if (requiredBits > totalAvailableBits) {
        throw new Error(`Текст занадто довгий! Максимум байтів: ${Math.floor(totalAvailableBits / 8)}`);
    }
    let bitIndex = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        if (bitIndex >= requiredBits)
            break;
        for (let j = 0; j < 3; j++) {
            if (bitIndex < requiredBits) {
                const byteIndex = Math.floor(bitIndex / 8);
                const bitOffset = 7 - (bitIndex % 8);
                const bit = (textBytes[byteIndex] >> bitOffset) & 1;
                pixels[i + j] = (pixels[i + j] & ~1) | bit;
                bitIndex++;
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
    downloadBtn.classList.remove("hidden");
    downloadBtn.onclick = () => {
        const link = document.createElement("a");
        link.download = "encrypted.png";
        link.href = outputCanvas.toDataURL("image/png");
        link.click();
    };
}
export async function decodeImage(file) {
    const ctx = await loadImageToCanvas(file, outputCanvas);
    outputCanvas.classList.remove("hidden");
    const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const pixels = imageData.data;
    let textBytes = [];
    let currentCharCode = 0;
    let bitCount = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        for (let j = 0; j < 3; j++) {
            const bit = pixels[i + j] & 1;
            currentCharCode = (currentCharCode << 1) | bit;
            bitCount++;
            if (bitCount === 8) {
                textBytes.push(currentCharCode);
                if (textBytes.length >= 3) {
                    const len = textBytes.length;
                    if (textBytes[len - 3] === 69 &&
                        textBytes[len - 2] === 78 &&
                        textBytes[len - 1] === 68) {
                        const actualMessageBytes = new Uint8Array(textBytes.slice(0, len - 3));
                        const decoder = new TextDecoder("utf-8");
                        const decodedText = decoder.decode(actualMessageBytes);
                        decryptedTextOutput.textContent = "Розшифрований текст: \n" + decodedText;
                        decryptedTextOutput.classList.remove("hidden");
                        downloadBtn.classList.add("hidden");
                        return;
                    }
                }
                currentCharCode = 0;
                bitCount = 0;
            }
        }
    }
    throw new Error("Не знайдено маркер 'END'. Можливо, зображення не містить прихованого тексту або пошкоджене.");
}
