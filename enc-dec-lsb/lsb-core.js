import { showToast } from './error-handler.js';
// --- 1. Отримання елементів DOM ---
const actionBtn = document.getElementById("actionBtn");
const inputImg = document.getElementById("inputImg");
const modeEncrypt = document.getElementById("modeEncrypt");
const modeDecrypt = document.getElementById("modeDecrypt");
const encryptSection = document.getElementById("encryptSection");
const inputTextTextArea = document.getElementById("inputTextTextArea");
const outputCanvas = document.getElementById("outputCanvas");
const downloadBtn = document.getElementById("downloadBtn");
const decryptedTextOutput = document.getElementById("decryptedTextOutput");
// --- 2. Обробник перемикання режимів (UI) ---
document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const isEncrypt = modeEncrypt.checked;
        encryptSection.style.display = isEncrypt ? "block" : "none";
        actionBtn.textContent = isEncrypt ? "Зашифрувати" : "Розшифрувати";
        // Очищення попередніх результатів при перемиканні режиму
        outputCanvas.classList.add("hidden");
        downloadBtn.classList.add("hidden");
        decryptedTextOutput.classList.add("hidden");
    });
});
// --- 3. Обробник головної кнопки дії ---
actionBtn.addEventListener("click", async () => {
    try {
        if (!inputImg.files || inputImg.files.length === 0) {
            throw new Error("Будь ласка, оберіть зображення.");
        }
        if (inputImg.files.length > 1) {
            throw new Error("Можна завантажити лише одне зображення.");
        }
        const file = inputImg.files[0];
        // Перевірка магічних байтів
        const isValid = await isPngOrBmp(file);
        if (!isValid) {
            throw new Error("Невірний формат. Підтримуються лише PNG або BMP.");
        }
        // Ховаємо попередні результати перед новим запуском
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
// --- 4. Допоміжні функції ---
// Перевірка формату файлу (PNG або BMP) за магічними байтами
async function isPngOrBmp(file) {
    const headerBlob = file.slice(0, 8);
    const headerArrayBuffer = await headerBlob.arrayBuffer();
    const headerBytes = new Uint8Array(headerArrayBuffer);
    // Перевірка PNG
    if (headerBytes[0] === 0x89 &&
        headerBytes[1] === 0x50 &&
        headerBytes[2] === 0x4E &&
        headerBytes[3] === 0x47 &&
        headerBytes[4] === 0x0D &&
        headerBytes[5] === 0x0A &&
        headerBytes[6] === 0x1A &&
        headerBytes[7] === 0x0A) {
        return true;
    }
    // Перевірка BMP
    if (headerBytes[0] === 0x42 && headerBytes[1] === 0x4D) {
        return true;
    }
    return false;
}
// Асинхронне завантаження файлу в Canvas
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
// --- 5. Основні функції LSB ---
// Функція шифрування
export async function encodeImage(file, text) {
    outputCanvas.classList.remove("hidden");
    const ctx = await loadImageToCanvas(file, outputCanvas);
    const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const pixels = imageData.data;
    // Додаємо маркер кінця рядка (\0), щоб при розшифровці знати, де зупинитись
    const textToEncode = text + '\0';
    // Підрахунок місткості (по 3 біти в кожному пікселі: R, G, B)
    const totalAvailableBits = Math.floor((pixels.length / 4) * 3);
    const requiredBits = textToEncode.length * 8;
    if (requiredBits > totalAvailableBits) {
        throw new Error(`Текст занадто довгий! Максимум символів: ${Math.floor(totalAvailableBits / 8)}`);
    }
    let bitIndex = 0;
    // Запис бітів у пікселі
    for (let i = 0; i < pixels.length; i += 4) {
        if (bitIndex >= requiredBits)
            break;
        // Змінюємо R, G, B канали (Alpha-канал пропускаємо)
        for (let j = 0; j < 3; j++) {
            if (bitIndex < requiredBits) {
                const charIndex = Math.floor(bitIndex / 8);
                const bitOffset = 7 - (bitIndex % 8); // Читаємо від старшого біта до молодшого
                // Отримуємо поточний біт тексту (0 або 1)
                const bit = (textToEncode.charCodeAt(charIndex) >> bitOffset) & 1;
                // Очищаємо останній біт пікселя і записуємо наш
                pixels[i + j] = (pixels[i + j] & ~1) | bit;
                bitIndex++;
            }
        }
    }
    // Відмальовуємо змінені пікселі назад
    ctx.putImageData(imageData, 0, 0);
    // Відображаємо кнопку завантаження
    downloadBtn.classList.remove("hidden");
    downloadBtn.onclick = () => {
        const link = document.createElement("a");
        link.download = "encrypted.png";
        link.href = outputCanvas.toDataURL("image/png");
        link.click();
    };
}
// Функція розшифрування
export async function decodeImage(file) {
    const ctx = await loadImageToCanvas(file, outputCanvas);
    outputCanvas.classList.remove("hidden"); // Показуємо зображення користувачу
    const imageData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const pixels = imageData.data;
    let decodedText = "";
    let currentCharCode = 0;
    let bitCount = 0;
    // Читання бітів з пікселів
    for (let i = 0; i < pixels.length; i += 4) {
        for (let j = 0; j < 3; j++) {
            const bit = pixels[i + j] & 1; // Отримуємо останній біт
            currentCharCode = (currentCharCode << 1) | bit;
            bitCount++;
            // Коли зібрали 8 бітів (1 символ)
            if (bitCount === 8) {
                if (currentCharCode === 0) {
                    // Знайшли нуль-термінатор \0 -> виводимо результат
                    decryptedTextOutput.textContent = "Розшифрований текст: \n" + decodedText;
                    decryptedTextOutput.classList.remove("hidden");
                    downloadBtn.classList.add("hidden");
                    return;
                }
                decodedText += String.fromCharCode(currentCharCode);
                currentCharCode = 0;
                bitCount = 0;
            }
        }
    }
    throw new Error("Не знайдено зашифрованого тексту (або він був пошкоджений/неправильний формат).");
}
//# sourceMappingURL=lsb-core.js.map