import eventlet
eventlet.monkey_patch()


import bcrypt
import pymongo
from pymongo import MongoClient
import json
import time
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import Flask, request, jsonify, render_template, redirect, url_for, session
from email_validator import validate_email, EmailNotValidError
import random
import string
import threading
import math
import os
import datetime
from datetime import datetime, timezone
from dotenv import load_dotenv
from functools import wraps
import certifi


# Load environment variables
load_dotenv()


# Initialize Flask app
app = Flask(__name__ , template_folder='templates')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')


# Configuration
MONGO_URI = os.getenv("MONGO_URI")
API_KEY = os.getenv("API_KEY")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
SECRET_KEY = os.getenv("SECRET_KEY")  # Use a default secret key if not set in .env
MIN_PASSWORD_LENGTH = 8
VERIFICATION_CODE_LENGTH = 6

# MongoDB Connection
client = client = pymongo.MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client['bus_tracker']
users_collection = db['users']
buses_collection = db['buses']
notification_collection = db['notifications']


# Custom Exceptions
class ValidationError(Exception):
    pass

# Middleware for login that takes you to bus tracking page if loggin is successful
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'student_email' not in session:
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated_function



# Middleware for API key verification
def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != API_KEY:
            return jsonify({'error': 'Invalid or missing API key'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Utility Functions
def generate_verification_code(length=VERIFICATION_CODE_LENGTH):
    """Generate a random verification code of specified length."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

def validate_password(password):
    """Validate password strength."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationError(f'Password must be at least {MIN_PASSWORD_LENGTH} characters long')
    if not any(c.isupper() for c in password):
        raise ValidationError('Password must contain at least one uppercase letter')
    if not any(c.islower() for c in password):
        raise ValidationError('Password must contain at least one lowercase letter')
    if not any(c.isdigit() for c in password):
        raise ValidationError('Password must contain at least one number')

def validate_student_email(email):
    """Validate student email format and domain."""
    try:
        v = validate_email(email)
        email_domain = v.email.split('@')[1]
        if 'student' not in email_domain:
            raise ValidationError('Invalid email domain. Only student emails allowed.')
        return v.email
    except EmailNotValidError as e:
        raise ValidationError(str(e))

bus_data = {
    'bus_1': {'lat': -26.2041, 'lng': 28.0473},  # Johannesburg coordinates
}


@app.route('/')
def home():
    return redirect(url_for('login_page'))

@app.route('/config')
def get_config():
    return jsonify({
        'apiKey': os.getenv("API_KEY")
    })

@app.route('/get-google-maps-key', methods=["GET"])
def get_google_maps_key():
    return jsonify({"apiKey": GOOGLE_MAPS_API_KEY})

# Ayth pages
@app.route('/register', methods=['GET'])
def signup_page():
    return render_template('register.html')   

@app.route('/verify-email', methods=['GET'])
def verify_page():
    return render_template('verify.html')

@app.route('/login', methods=['GET'])
def login_page():
    return render_template('login.html')

@app.route('/bus-tracking', methods=['GET'])
@login_required
def bus_tracking_page():
    return render_template('bus_tracking.html')

@app.route('/admin', methods=['GET'])
def get_bus_data():
    return render_template('admin.html')

@app.route ('/logout')
def logout():
    session.clear()
    return redirect(url_for('login_page'))

# Register API
@app.route('/register', methods=['POST'])
@require_api_key
def register_api():
    data = request.json
    name = data.get('name')
    surname = data.get('surname')
    password = data.get('password')
    confirm_password = data.get('confirm_password')
    student_email = data.get('student_email')

    if not all([name, surname, password, confirm_password, student_email]):
        return jsonify({'error': 'All fields are required'}), 400

    try:
        student_email = validate_student_email(student_email)
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400

    if password != confirm_password:
        return jsonify({'error': 'Passwords do not match'}), 400

    try:
        validate_password(password)
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400

    if users_collection.find_one({'student_email': student_email}):
        return jsonify({'error': 'User with this email already exists'}), 400

    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    verification_code = generate_verification_code()
    user_data = {
        'name': name,
        'surname': surname,
        'student_email': student_email,
        'password': hashed_password,
        'is_verified': False,
        'verification_code': verification_code
    }
    users_collection.insert_one(user_data)

    return jsonify({
        'message': 'User registered successfully. Please verify your email with the code sent.',
        'verification_code': verification_code
    }), 201

# Verify API
@app.route('/verify-email', methods=['POST'])
@require_api_key
def verify_email():
    data = request.json
    student_email = data.get('student_email')
    verification_code = data.get('verification_code')

    if not student_email or not verification_code:
        return jsonify({'error': 'Email and verification code are required'}), 400

    user = users_collection.find_one({'student_email': student_email})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user['verification_code'] != verification_code:
        return jsonify({'error': 'Invalid verification code'}), 400
    
    users_collection.update_one(
        {'student_email': student_email}, 
        {'$set': {'is_verified': True}}
    )

    return jsonify({'message': 'Email verified successfully'}), 200

# Login API
@app.route('/login', methods=['POST'])
@require_api_key
def login():
    data = request.json
    student_email = data.get('student_email')
    password = data.get('password')

    if not student_email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = users_collection.find_one({'student_email': student_email})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if not user['is_verified']:
        return jsonify({'error': 'Email not verified'}), 400

    if bcrypt.checkpw(password.encode('utf-8'), user['password']):
        session['user_id'] = str(user['_id'])  # Store only safe data
        session['student_email'] = user['student_email']
        return jsonify({'message': 'Login successful'}), 200

    else:
        return jsonify({'error': 'Invalid credentials'}), 401


@app.route('/admin', methods=['POST'])
def update_bus_data():
    data = request.json
    bus_id = data.get('bus_id')
    lat = data.get('lat')
    lng = data.get('lng')
    status = data.get('status')
    route = data.get('route')

    bus = buses_collection.find_one({'bus_id': bus_id})

    if bus:
        buses_collection.update_one(
            ({'bus_id': bus_id}, {'$set': {'lat': lat, 'lng': lng, 'status': status, 'route': route, 'timestamp': datetime.utcnow()}})
        )
    else:
        buses_collection.insert_one({
            'bus_id': bus_id,
            'status': status,
            'lat': lat,
            'lng': lng,
            'route': route,
            'timestamp': datetime.utcnow()
        })

    socketio.emit('bus_location_update', {
        'bus_id': bus_id,
        'lat': lat,
        'lng': lng,
        'status': status,
        'route': route
    })
    return jsonify({'message': 'Location updated'})

@app.route('/get_buses', methods=['GET'])
def get_buses():
    route = request.args.get('route')
    buses = list(buses_collection.find())
    result = []
    for bus in buses:
        if route and bus.get('route') != route:
            continue
        result.append({
            'bus_id': bus.get('bus_id'),
            'status': bus.get('status'),
            'lat': bus.get('lat'),
            'lng': bus.get('lng'),
            'route': bus.get('route')
        })
    return jsonify(result)

@app.route('/notifications', methods=['GET'])
def get_notifications():
    notifications = list(notification_collection.find().sort('timestamp', -1).limit(5))
    result = [{'message': n.get('message'), 'timestamp': n.get('timestamp')} for n in notifications]
    return jsonify(result)

@app.route('/send_notification', methods=['POST'])
def send_notification():
    data = request.get_json()
    message = data.get('message')
    notification_collection.insert_one({'message': message, 'timestamp': datetime.utcnow()})
    socketio.emit('new_notification', {'message': message}) 
    return jsonify({'message': 'Notification sent'})

@socketio.on('connect')
def handle_connect():
    print('Client connected!')

# Additional route for testing bus updates (optional)
@app.route('/test_bus_update', methods=['POST'])
def test_bus_update():
    """Test endpoint to simulate bus updates"""
    data = request.get_json()
    socketio.emit('bus_location_update', data)
    return jsonify({'message': 'Test update sent'})

# Route to get bus by ID (optional utility)
@app.route('/get_bus/<bus_id>', methods=['GET'])
def get_bus_by_id(bus_id):
    bus = buses_collection.find_one({'bus_id': bus_id})
    if bus:
        return jsonify({
            'bus_id': bus.get('bus_id'),
            'status': bus.get('status'),
            'lat': bus.get('lat'),
            'lng': bus.get('lng'),
            'route': bus.get('route'),
            'timestamp': bus.get('timestamp')
        })
    return jsonify({'error': 'Bus not found'}), 404


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))