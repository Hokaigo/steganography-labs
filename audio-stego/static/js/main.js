function toggleMode() {
    const isEncrypt = document.querySelector('input[name="mode"][value="encrypt"]').checked;
    const encSection = document.getElementById('encryptSection');
    const decSection = document.getElementById('decryptSection');
    
    if (isEncrypt) {
        encSection.classList.remove('hidden');
        decSection.classList.add('hidden');
    } else {
        encSection.classList.add('hidden');
        decSection.classList.remove('hidden');
    }
    
    document.getElementById('encResult').classList.add('hidden');
    document.getElementById('decResultContainer').classList.add('hidden');
}

async function encrypt() {
    const fileInput = document.getElementById('encFile');
    const textInput = document.getElementById('encText');
    const keyInput = document.getElementById('encKey');
    const btn = document.getElementById('encBtn');
    
    if (!fileInput.files[0] || !textInput.value.trim()) {
        showToast("Оберіть файл та введіть текст.", "warning");
        return;
    }

    btn.innerText = "Обробка...";
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('audio', fileInput.files[0]);
        formData.append('text', textInput.value);
        formData.append('key', keyInput.value);

        const res = await fetch('/api/encrypt', { method: 'POST', body: formData });
        if (!res.ok) throw new Error("Помилка сервера");
        const data = await res.json();
        
        document.getElementById('downloadLink').href = data.stego_url;
        document.getElementById('plotImg').src = data.plot_url + "?t=" + new Date().getTime();
        document.getElementById('encResult').classList.remove('hidden');
        showToast("Текст успішно приховано!", "success");
    } catch (e) {
        showToast("Помилка шифрування. Перевірте файл.", "error");
    } finally {
        btn.innerText = "Приховати";
        btn.disabled = false;
    }
}

async function decrypt() {
    const fileInput = document.getElementById('decFile');
    const keyInput = document.getElementById('decKey');
    const btn = document.getElementById('decBtn');
    
    if (!fileInput.files[0]) {
        showToast("Оберіть файл.", "warning");
        return;
    }

    btn.innerText = "Обробка...";
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('audio', fileInput.files[0]);
        formData.append('key', keyInput.value);

        const res = await fetch('/api/decrypt', { method: 'POST', body: formData });
        if (!res.ok) throw new Error("Помилка сервера");
        const data = await res.json();
        
        document.getElementById('decResultContainer').classList.remove('hidden');
        document.getElementById('decResult').innerText = data.message;
        showToast("Текст успішно вилучено!", "success");
    } catch (e) {
        showToast("Помилка вилучення або невірний ключ.", "error");
    } finally {
        btn.innerText = "Вилучити";
        btn.disabled = false;
    }
}