from flask import Flask
import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Now we can import the service_routes
from rest_api.service_routes import service_api
from flask_swagger_ui import get_swaggerui_blueprint

app = Flask(__name__)

# Configure Swagger UI
SWAGGER_URL = '/api/docs'
API_URL = '/static/swagger.yaml'

swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,
    API_URL,
    config={
        'app_name': "Service Registry API"
    }
)

# Register blueprints
app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)
app.register_blueprint(service_api)

@app.route('/static/swagger.yaml')
def send_swagger_spec():
    from flask import send_from_directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return send_from_directory(os.path.join(current_dir, 'rest-api'), 'swagger.yaml')

if __name__ == '__main__':
    print("Starting Service Registry API on http://localhost:5000")
    print("Swagger UI available at http://localhost:5000/api/docs")
    app.run(host='0.0.0.0', port=5000, debug=True)
