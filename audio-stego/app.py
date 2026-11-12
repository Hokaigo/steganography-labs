from flask import Flask, render_template, request, jsonify, url_for
import os
from lsb_core import embed_message, extract_message, save_waveforms_plot

app = Flask(__name__)
UPLOAD_FOLDER = 'static/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/encrypt', methods=['POST'])
def encrypt():
    file = request.files.get('audio')
    text = request.form.get('text')
    key = request.form.get('key', '')
    
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], 'cover.wav')
    output_path = os.path.join(app.config['UPLOAD_FOLDER'], 'stego.wav')
    plot_path = os.path.join(app.config['UPLOAD_FOLDER'], 'plot.png')
    
    file.save(input_path)
    embed_message(input_path, output_path, text, key)
    save_waveforms_plot(input_path, output_path, plot_path)
    
    return jsonify({
        "stego_url": url_for('static', filename='uploads/stego.wav'),
        "plot_url": url_for('static', filename='uploads/plot.png')
    })

@app.route('/api/decrypt', methods=['POST'])
def decrypt():
    file = request.files.get('audio')
    key = request.form.get('key', '')
    
    stego_path = os.path.join(app.config['UPLOAD_FOLDER'], 'uploaded_stego.wav')
    file.save(stego_path)
    
    msg = extract_message(stego_path, key)
    return jsonify({"message": msg})

if __name__ == '__main__':
    app.run(debug=True)