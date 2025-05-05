from flask import Flask, request, render_template, redirect, url_for, session, jsonify
import json
import os


BASE = os.path.abspath(os.path.dirname(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE, '..'))

app = Flask(
    __name__,
    static_folder = PROJECT_ROOT,    # <-- serve EVERYTHING in the parent folder as “/…”
    static_url_path = '',            # <-- so “/src/script.js”, “/style.css”, “/controller_l.glb”, etc. all work
    template_folder = PROJECT_ROOT   # <-- and look here for templates (i.e. index.html)
)

app.config['UPLOAD_FOLDER'] = 'uploads'
app.secret_key = os.urandom(24)

if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

@app.route('/')
def index():
    return render_template('first_page.html')

@app.route('/submit', methods=['POST'])
def submit():
    json_file = request.files['json_file']
    if json_file:
        json_file_path = os.path.join(app.config['UPLOAD_FOLDER'], json_file.filename)
        # json_file.save(json_file_path) #this saves to server uploads folder

        user_input = request.form['user_input']

        session['user_input'] = user_input.strip()
        session['json_data_file'] = json_file.filename

        return redirect(url_for('main_page'))

@app.route('/main_page')
def main_page():
    user_input      = session.get('user_input', '')
    json_data_file  = session.get('json_data_file', '')
    config_data     = {}

    if json_data_file:
        path = os.path.join(app.config['UPLOAD_FOLDER'], json_data_file)
        with open(path, 'r') as f:
            config_data = json.load(f)

    return render_template(
        'index.html',
         user_input     = user_input,
         json_data      = config_data,
         filename = json_data_file
    )

if __name__ == '__main__':
    app.run(debug=True, port="3000")
