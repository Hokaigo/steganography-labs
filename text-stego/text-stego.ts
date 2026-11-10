import { showToast } from './error-handler.ts';

const modeEncrypt = document.getElementById("modeEncrypt") as HTMLInputElement;
const modeDecrypt = document.getElementById("modeDecrypt") as HTMLInputElement;
const methodSelect = document.getElementById("methodSelect") as HTMLSelectElement;
const useCaesar = document.getElementById("useCaesar") as HTMLInputElement;

const encryptSection = document.getElementById("encryptSection") as HTMLDivElement;
const decryptSection = document.getElementById("decryptSection") as HTMLDivElement;
const coverTextArea = document.getElementById("coverTextArea") as HTMLTextAreaElement;
const secretTextArea = document.getElementById("secretTextArea") as HTMLTextAreaElement;
const stegoFileInput = document.getElementById("stegoFileInput") as HTMLInputElement;

const actionBtn = document.getElementById("actionBtn") as HTMLButtonElement;
const downloadBtn = document.getElementById("downloadBtn") as HTMLButtonElement;
const debugOutput = document.getElementById("debugOutput") as HTMLDivElement;
const extractedTextOutput = document.getElementById("extractedTextOutput") as HTMLParagraphElement;

let generatedStegoData = "";
let generatedExtension = ".txt";

const MARKER = "[END]";

function strToBin(str: string): string {
    return Array.from(new TextEncoder().encode(str)).map(b => b.toString(2).padStart(8, '0')).join('');
}

function binToStr(bin: string): string {
    const bytes = [];
    for (let i = 0; i < bin.length; i += 8) {
        bytes.push(parseInt(bin.slice(i, i + 8), 2));
    }
    return new TextDecoder().decode(new Uint8Array(bytes)).split(MARKER)[0];
}

function caesarCipher(text: string, shift: number): string {
    return text.split('').map(char => {
        const code = char.charCodeAt(0);
        return String.fromCharCode(code + shift);
    }).join('');
}

function hideZWC(cover: string, secret: string): string {
    const bin = strToBin(secret + MARKER);
    const zwcStr = bin.split('').map(b => b === '1' ? '\u200B' : '\u200C').join('');
    return zwcStr + cover;
}

function extractZWC(stego: string): string {
    let bin = "";
    for (const char of stego) {
        if (char === '\u200B') bin += '1';
        else if (char === '\u200C') bin += '0';
    }
    return binToStr(bin);
}

function hideCase(cover: string, secret: string): string {
    const bin = strToBin(secret + MARKER);
    let res = "";
    let bIdx = 0;
    
    const lettersCount = (cover.match(/[a-zA-Zа-яА-ЯіІїЇєЄґҐ]/g) || []).length;
    if (bin.length > lettersCount) throw new Error("Контейнер занадто малий для цього повідомлення!");

    for (const char of cover) {
        if (/[a-zA-Zа-яА-ЯіІїЇєЄґҐ]/.test(char) && bIdx < bin.length) {
            res += bin[bIdx] === '1' ? char.toUpperCase() : char.toLowerCase();
            bIdx++;
        } else {
            res += char;
        }
    }
    return res;
}
function extractCase(stego: string): string {
    let bin = "";
    for (const char of stego) {
        if (/[a-zA-Zа-яА-ЯіІїЇєЄґҐ]/.test(char)) {
            bin += char === char.toUpperCase() ? '1' : '0';
        }
    }
    bin = bin.substring(0, bin.length - (bin.length % 8));
    return binToStr(bin);
}

function hideSpace(cover: string, secret: string): string {
    const bin = strToBin(secret + MARKER);
    const words = cover.split(' ');
    
    let res = words[0] || "";

    for (let i = 0; i < bin.length; i++) {
        const space = bin[i] === '1' ? '\u00A0' : ' ';
        
        if (i < words.length - 1) {
            res += space + words[i + 1];
        } else {
            res += space;
        }
    }

    for (let i = bin.length; i < words.length - 1; i++) {
        res += ' ' + words[i + 1];
    }
    
    return res;
}

function extractSpace(stego: string): string {
    let bin = "";
    for (const char of stego) {
        if (char === '\u00A0') bin += '1';
        else if (char === ' ') bin += '0';
    }
    bin = bin.substring(0, bin.length - (bin.length % 8));
    return binToStr(bin);
}

function hideColorHTML(cover: string, secret: string): string {
    const bin = strToBin(secret + MARKER);
    let res = "";
    let bIdx = 0;
    
    if (bin.length > cover.replace(/\s/g, '').length) 
        throw new Error("Контейнер занадто малий!");

    for (const char of cover) {
        if (/\S/.test(char) && char !== '\u200B' && char !== '\u200C' && bIdx < bin.length) {
            const color = bin[bIdx] === '1' ? "#0A0A0A" : "#000000";
            res += `<span style="color:${color}">${char}</span>`;
            bIdx++;
        } else {
            res += char;
        }
    }
    return `<html><body><p>${res}</p></body></html>`;
}

function extractColorHTML(stegoHTML: string): string {
    const regex = /<span style="color:(#[0-9A-Fa-f]{6})">(.*?)<\/span>/g;
    let match;
    let bin = "";
    while ((match = regex.exec(stegoHTML)) !== null) {
        const color = match[1].toUpperCase();
        if (color === '#0A0A0A') bin += '1';
        else if (color === '#000000') bin += '0';
    }
    return binToStr(bin);
}

document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const isEncrypt = modeEncrypt.checked;
        encryptSection.style.display = isEncrypt ? "block" : "none";
        decryptSection.style.display = isEncrypt ? "none" : "block";
        actionBtn.textContent = isEncrypt ? "Приховати" : "Вилучити";
        downloadBtn.classList.add("hidden");
        extractedTextOutput.classList.add("hidden");
        debugOutput.textContent = "";
    });
});

actionBtn.addEventListener("click", async () => {
    try {
        debugOutput.textContent = "";
        extractedTextOutput.classList.add("hidden");
        downloadBtn.classList.add("hidden");

        const method = methodSelect.value;
        const caesarActive = useCaesar.checked;

        if (modeEncrypt.checked) {
            const cover = coverTextArea.value;
            let secret = secretTextArea.value;
            
            if (!cover || !secret) throw new Error("Заповніть обидва текстові поля!");

            debugOutput.innerHTML = `<strong>Початкове секретне повідомлення:</strong> ${secret}<br>`;
            
            if (caesarActive) {
                secret = caesarCipher(secret, 3);
                debugOutput.innerHTML += `<strong>Після шифру Цезаря:</strong> ${secret}<br>`;
            }

            debugOutput.innerHTML += `<strong>Бінарний вигляд (з маркером ${MARKER}):</strong> ${strToBin(secret + MARKER)}<br>`;

            generatedExtension = method === 'color' ? '.html' : '.txt';

            switch (method) {
                case 'zwc': generatedStegoData = hideZWC(cover, secret); break;
                case 'case': generatedStegoData = hideCase(cover, secret); break;
                case 'space': generatedStegoData = hideSpace(cover, secret); break;
                case 'color': generatedStegoData = hideColorHTML(cover, secret); break;
            }

            debugOutput.innerHTML += `<br><strong>Успішно приховано!</strong> Натисніть кнопку нижче, щоб зберегти файл.`;
            downloadBtn.classList.remove("hidden");
            showToast("Текст успішно приховано!", "success");

        } else {
            const file = stegoFileInput.files?.[0];
            if (!file) throw new Error("Оберіть файл для вилучення!");

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const stegoText = e.target?.result as string;
                    let extracted = "";

                    switch (method) {
                        case 'zwc': extracted = extractZWC(stegoText); break;
                        case 'case': extracted = extractCase(stegoText); break;
                        case 'space': extracted = extractSpace(stegoText); break;
                        case 'color': extracted = extractColorHTML(stegoText); break;
                    }

                    if (!extracted) throw new Error("Не вдалося знайти повідомлення. Можливо обрано неправильний метод.");

                    if (caesarActive) {
                        extracted = caesarCipher(extracted, -3);
                    }

                    extractedTextOutput.textContent = `Вилучене повідомлення: ${extracted}`;
                    extractedTextOutput.classList.remove("hidden");
                    showToast("Повідомлення успішно вилучено!", "success");
                } catch (err: any) {
                    showToast(err.message, 'error');
                }
            };
            reader.readAsText(file);
        }
    } catch (err: any) {
        showToast(err.message, 'error');
    }
});

downloadBtn.addEventListener("click", () => {
    const blob = new Blob([generatedStegoData], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stego_output${generatedExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});