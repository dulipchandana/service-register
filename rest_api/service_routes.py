from flask import Blueprint, jsonify, request
from typing import Dict, List
import uuid

# Create a Blueprint for service routes
service_api = Blueprint('service_api', __name__)

# In-memory storage for services (replace with database in production)
services: Dict[str, dict] = {}

@service_api.route('/api/services', methods=['GET'])
def get_services() -> tuple:
    """Get all registered services."""
    try:
        return jsonify(list(services.values())), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@service_api.route('/api/services', methods=['POST'])
def create_service() -> tuple:
    """Create a new service."""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['service-name', 'service-ip', 'service-port', 'protocol']
        if not all(field in data for field in required_fields):
            return jsonify({
                "error": f"Missing required fields. Required: {required_fields}"
            }), 400
        
        # Validate data types
        if not isinstance(data['service-port'], int):
            return jsonify({
                "error": "service-port must be an integer"
            }), 400
        
        # Generate a unique ID for the service
        service_id = str(uuid.uuid4())
        service_data = {
            "id": service_id,
            **data
        }
        
        services[service_id] = service_data
        return jsonify(service_data), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@service_api.route('/api/services/<service_id>', methods=['GET'])
def get_service(service_id: str) -> tuple:
    """Get a specific service by ID."""
    try:
        service = services.get(service_id)
        if service is None:
            return jsonify({"error": "Service not found"}), 404
        return jsonify(service), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@service_api.route('/api/services/<service_id>', methods=['PUT'])
def update_service(service_id: str) -> tuple:
    """Update an existing service."""
    try:
        if service_id not in services:
            return jsonify({"error": "Service not found"}), 404
            
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['service-name', 'service-ip', 'service-port', 'protocol']
        if not all(field in data for field in required_fields):
            return jsonify({
                "error": f"Missing required fields. Required: {required_fields}"
            }), 400
            
        # Validate data types
        if not isinstance(data['service-port'], int):
            return jsonify({
                "error": "service-port must be an integer"
            }), 400
            
        # Update service while preserving its ID
        service_data = {
            "id": service_id,
            **data
        }
        services[service_id] = service_data
        return jsonify(service_data), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@service_api.route('/api/services/<service_id>', methods=['DELETE'])
def delete_service(service_id: str) -> tuple:
    """Delete an existing service."""
    try:
        if service_id not in services:
            return jsonify({"error": "Service not found"}), 404
            
        del services[service_id]
        return '', 204
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
