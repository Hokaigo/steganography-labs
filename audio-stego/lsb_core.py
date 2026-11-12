import wave
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import hashlib

def embed_message(input_wav: str, output_wav: str, message: str, key: str = ""):
    message += chr(0)
    bits = ''.join(f'{ord(c):08b}' for c in message)
    
    with wave.open(input_wav, 'rb') as w:
        params = w.getparams()
        frames = w.readframes(params.nframes)
        
    samples = np.frombuffer(frames, dtype=np.int16)
    
    if len(bits) > len(samples):
        raise ValueError("Повідомлення занадто довге для цього аудіо")
        
    samples_mod = samples.copy()
    
    if key:
        seed = int(hashlib.sha256(key.encode('utf-8')).hexdigest(), 16) % (2**32)
        rng = np.random.default_rng(seed)
        indices = rng.permutation(len(samples))
    else:
        indices = np.arange(len(samples))
        
    for i, bit in enumerate(bits):
        idx = indices[i]
        samples_mod[idx] = (samples_mod[idx] & ~1) | int(bit)
        
    with wave.open(output_wav, 'wb') as w:
        w.setparams(params)
        w.writeframes(samples_mod.tobytes())

def extract_message(stego_wav: str, key: str = "") -> str:
    with wave.open(stego_wav, 'rb') as w:
        frames = w.readframes(w.getnframes())
        
    samples = np.frombuffer(frames, dtype=np.int16)
    
    if key:
        seed = int(hashlib.sha256(key.encode('utf-8')).hexdigest(), 16) % (2**32)
        rng = np.random.default_rng(seed)
        indices = rng.permutation(len(samples))
    else:
        indices = np.arange(len(samples))
        
    message = ""
    current_char_bits = ""
    
    for idx in indices:
        current_char_bits += str(samples[idx] & 1)
        if len(current_char_bits) == 8:
            char = chr(int(current_char_bits, 2))
            if char == chr(0):
                break
            message += char
            current_char_bits = ""
            
    return message

def save_waveforms_plot(wav1: str, wav2: str, output_img_path: str):
    def read_wav(path):
        with wave.open(path, 'rb') as w:
            sr = w.getframerate()
            frames = w.readframes(w.getnframes())
            data = np.frombuffer(frames, dtype=np.int16)
            time = np.linspace(0, len(data)/sr, num=len(data))
            return time, data

    t1, s1 = read_wav(wav1)
    t2, s2 = read_wav(wav2)

    plt.figure(figsize=(10, 5))
    plt.subplot(2, 1, 1)
    plt.plot(t1, s1)
    plt.title("Оригінал")
    
    plt.subplot(2, 1, 2)
    plt.plot(t2, s2, linestyle='--')
    plt.title("Стего")
    
    plt.tight_layout()
    plt.savefig(output_img_path)
    plt.close()