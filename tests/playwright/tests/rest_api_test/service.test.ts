import { test, expect } from '@playwright/test';
import { startApiServer, stopApiServer } from '../../helpers/api.helper';

interface Service {
    id?: string;
    'service-name': string;
    'service-ip': string;
    'service-port': number;
    'protocol': string;
}

const API_BASE_URL = 'http://localhost:5000';
const TEST_SERVICE: Service = {
    'service-name': 'test-service',
    'service-ip': '192.168.1.100',
    'service-port': 8080,
    'protocol': 'HTTP'
};

test.describe('REST API Service Tests', () => {
    let createdServiceId: string;

    test.beforeAll(async () => {
        await startApiServer();
    });

    test('should create a new service', async ({ request }) => {
        const response = await request.post(`${API_BASE_URL}/api/services`, {
            data: TEST_SERVICE
        });

        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(201);

        const responseBody = await response.json();
        expect(responseBody['service-name']).toBe(TEST_SERVICE['service-name']);
        expect(responseBody['service-ip']).toBe(TEST_SERVICE['service-ip']);
        expect(responseBody['service-port']).toBe(TEST_SERVICE['service-port']);
        expect(responseBody['protocol']).toBe(TEST_SERVICE['protocol']);
        expect(responseBody.id).toBeDefined();

        createdServiceId = responseBody.id;
    });

    test('should get all services', async ({ request }) => {
        const response = await request.get(`${API_BASE_URL}/api/services`);
        
        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);

        const services = await response.json();
        expect(Array.isArray(services)).toBeTruthy();
        
        if (services.length > 0) {
            const service = services[0];
            expect(service).toHaveProperty('service-name');
            expect(service).toHaveProperty('service-ip');
            expect(service).toHaveProperty('service-port');
            expect(service).toHaveProperty('protocol');
        }
    });

    test('should get a specific service by ID', async ({ request }) => {
        test.skip(!createdServiceId, 'Requires a service to be created first');

        const response = await request.get(`${API_BASE_URL}/api/services/${createdServiceId}`);
        
        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);

        const service = await response.json();
        expect(service.id).toBe(createdServiceId);
        expect(service['service-name']).toBe(TEST_SERVICE['service-name']);
        expect(service['service-ip']).toBe(TEST_SERVICE['service-ip']);
        expect(service['service-port']).toBe(TEST_SERVICE['service-port']);
        expect(service['protocol']).toBe(TEST_SERVICE['protocol']);
    });

    test('should update an existing service', async ({ request }) => {
        test.skip(!createdServiceId, 'Requires a service to be created first');

        const updatedService = {
            'service-name': 'updated-service',
            'service-ip': '192.168.1.200',
            'service-port': 9090,
            'protocol': 'HTTPS'
        };

        const response = await request.put(`${API_BASE_URL}/api/services/${createdServiceId}`, {
            data: updatedService
        });

        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(200);

        const service = await response.json();
        expect(service.id).toBe(createdServiceId);
        expect(service['service-name']).toBe(updatedService['service-name']);
        expect(service['service-ip']).toBe(updatedService['service-ip']);
        expect(service['service-port']).toBe(updatedService['service-port']);
        expect(service['protocol']).toBe(updatedService['protocol']);
    });

    test('should handle invalid service creation', async ({ request }) => {
        const invalidService = {
            'service-name': 'invalid-service',
            // Missing required fields
        };

        const response = await request.post(`${API_BASE_URL}/api/services`, {
            data: invalidService
        });

        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(400);

        const error = await response.json();
        expect(error.error).toContain('Validation failed');
    });

    test('should handle invalid port number', async ({ request }) => {
        const invalidService = {
            ...TEST_SERVICE,
            'service-port': '8080' // Port should be integer, not string
        };

        const response = await request.post(`${API_BASE_URL}/api/services`, {
            data: invalidService
        });

        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(400);

        const error = await response.json();
        expect(error.error).toContain('Validation failed');
    });

    test('should return 404 for non-existent service', async ({ request }) => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const response = await request.get(`${API_BASE_URL}/api/services/${nonExistentId}`);
        
        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(404);

        const error = await response.json();
        expect(error.error).toBe('Service not found');
    });

    test('should delete a service', async ({ request }) => {
        test.skip(!createdServiceId, 'Requires a service to be created first');

        const response = await request.delete(`${API_BASE_URL}/api/services/${createdServiceId}`);
        
        expect(response.ok()).toBeTruthy();
        expect(response.status()).toBe(204);

        // Verify service is deleted
        const getResponse = await request.get(`${API_BASE_URL}/api/services/${createdServiceId}`);
        expect(getResponse.status()).toBe(404);
    });
});
