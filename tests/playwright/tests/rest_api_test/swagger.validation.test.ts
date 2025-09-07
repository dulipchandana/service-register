import { test, expect } from '@playwright/test';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import path from 'path';
import { startApiServer, stopApiServer } from '../../helpers/api.helper';

// Configure Ajv to handle OpenAPI/Swagger schemas
const ajv = new Ajv({
    strict: false,  // To handle additional keywords like 'example'
    allowUnionTypes: true,
    removeAdditional: true,
    validateFormats: false // Optional: set to true if you want to validate formats
});
addFormats(ajv); // Add support for formats
let swaggerDoc: any;
let validateGetAllServices: any;
let validateService: any;

test.describe('Swagger API Validation Tests', () => {
    test.beforeAll(async () => {
        // Start the API server
        await startApiServer();

        // Parse and dereference the Swagger document
        swaggerDoc = await SwaggerParser.dereference(path.join(__dirname, '../../../../rest-api/swagger.yaml'));
        
        // Create validators for different response schemas
        // Clean up schema by removing OpenAPI-specific fields
        const serviceSchema = { ...swaggerDoc.components.schemas.Service };
        delete serviceSchema.example;  // Remove example
        Object.keys(serviceSchema.properties).forEach(key => {
            if (serviceSchema.properties[key].description) {
                delete serviceSchema.properties[key].description;  // Remove descriptions
            }
        });

        validateGetAllServices = ajv.compile({
            type: 'array',
            items: serviceSchema
        });
        
        validateService = ajv.compile(serviceSchema);
    });

    test('GET /api/services should return data matching Swagger schema', async ({ request }) => {
        const response = await request.get('http://localhost:5000/api/services');
        expect(response.status()).toBe(200);

        const data = await response.json();
        const valid = validateGetAllServices(data);
        expect(valid).toBeTruthy();
        if (!valid) {
            console.error('Validation errors:', validateGetAllServices.errors);
        }
    });

    test('POST /api/services should create service according to schema', async ({ request }) => {
        const newService = {
            'service-name': 'test-service',
            'service-ip': '192.168.1.200',
            'service-port': 8080,
            'protocol': 'HTTP'
        };

        const response = await request.post('http://localhost:5000/api/services', {
            data: newService
        });
        expect(response.status()).toBe(201);

        const data = await response.json();
        const valid = validateService(data);
        expect(valid).toBeTruthy();
        if (!valid) {
            console.error('Validation errors:', validateService.errors);
        }
    });

    test('GET /api/services/{serviceId} should return data matching Swagger schema', async ({ request }) => {
        // First create a service to get its ID
        const newService = {
            'service-name': 'test-service-get',
            'service-ip': '192.168.1.201',
            'service-port': 8081,
            'protocol': 'HTTP'
        };

        const createResponse = await request.post('http://localhost:5000/api/services', {
            data: newService
        });
        const createdService = await createResponse.json();
        const serviceId = createdService.id || createdService._id;

        // Now get the service and validate
        const response = await request.get(`http://localhost:5000/api/services/${serviceId}`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        const valid = validateService(data);
        expect(valid).toBeTruthy();
        if (!valid) {
            console.error('Validation errors:', validateService.errors);
        }
    });

    test('PUT /api/services/{serviceId} should update service according to schema', async ({ request }) => {
        // First create a service to update
        const newService = {
            'service-name': 'test-service-put',
            'service-ip': '192.168.1.202',
            'service-port': 8082,
            'protocol': 'HTTP'
        };

        const createResponse = await request.post('http://localhost:5000/api/services', {
            data: newService
        });
        const createdService = await createResponse.json();
        const serviceId = createdService.id || createdService._id;

        // Update the service
        const updatedService = {
            ...newService,
            'service-name': 'test-service-updated'
        };

        const response = await request.put(`http://localhost:5000/api/services/${serviceId}`, {
            data: updatedService
        });
        expect(response.status()).toBe(200);

        const data = await response.json();
        const valid = validateService(data);
        expect(valid).toBeTruthy();
        if (!valid) {
            console.error('Validation errors:', validateService.errors);
        }
    });

    test('DELETE /api/services/{serviceId} should return correct status code', async ({ request }) => {
        // First create a service to delete
        const newService = {
            'service-name': 'test-service-delete',
            'service-ip': '192.168.1.203',
            'service-port': 8083,
            'protocol': 'HTTP'
        };

        const createResponse = await request.post('http://localhost:5000/api/services', {
            data: newService
        });
        const createdService = await createResponse.json();
        const serviceId = createdService.id || createdService._id;

        // Delete the service
        const response = await request.delete(`http://localhost:5000/api/services/${serviceId}`);
        expect(response.status()).toBe(204);
    });

    test('Error responses should match Swagger specifications', async ({ request }) => {
        // Test 404 for non-existent service
        const response404 = await request.get('http://localhost:5000/api/services/nonexistent');
        expect(response404.status()).toBe(404);

        // Test 400 for invalid service data
        const response400 = await request.post('http://localhost:5000/api/services', {
            data: { invalid: 'data' }
        });
        expect(response400.status()).toBe(400);
    });

    test('Swagger docs endpoint should be accessible', async ({ request }) => {
        const response = await request.get('http://localhost:5000/api/docs/');
        expect(response.status()).toBe(200);
        
        // Verify response headers indicate HTML content
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('text/html');
    });
});
