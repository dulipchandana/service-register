import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Service interface based on Swagger schema
interface Service {
    id?: string;
    'service-name': string;
    'service-ip': string;
    'service-port': number;
    protocol: 'HTTP' | 'HTTPS' | 'TCP' | 'UDP';
}

/**
 * Service API Client
 * Generated from Swagger specification
 */
export class ServiceApiClient {
    private readonly api: AxiosInstance;

    /**
     * Create a new ServiceApiClient
     * @param baseURL - Base URL for the API (default: http://localhost:5000)
     */
    constructor(baseURL: string = 'http://localhost:5000') {
        this.api = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Get all services
     * @returns Promise with array of services
     */
    async getAllServices(): Promise<Service[]> {
        try {
            const response: AxiosResponse<Service[]> = await this.api.get('/api/services');
            return response.data;
        } catch (error) {
            this.handleError('Error getting services', error);
            throw error;
        }
    }

    /**
     * Create a new service
     * @param service - Service data to create
     * @returns Promise with created service data
     */
    async createService(service: Omit<Service, 'id'>): Promise<Service> {
        try {
            const response: AxiosResponse<Service> = await this.api.post('/api/services', service);
            return response.data;
        } catch (error) {
            this.handleError('Error creating service', error);
            throw error;
        }
    }

    /**
     * Get a service by ID
     * @param serviceId - ID of the service to retrieve
     * @returns Promise with service data
     */
    async getService(serviceId: string): Promise<Service> {
        try {
            const response: AxiosResponse<Service> = await this.api.get(`/api/services/${serviceId}`);
            return response.data;
        } catch (error) {
            this.handleError(`Error getting service ${serviceId}`, error);
            throw error;
        }
    }

    /**
     * Update a service
     * @param serviceId - ID of the service to update
     * @param service - Updated service data
     * @returns Promise with updated service data
     */
    async updateService(serviceId: string, service: Omit<Service, 'id'>): Promise<Service> {
        try {
            const response: AxiosResponse<Service> = await this.api.put(`/api/services/${serviceId}`, service);
            return response.data;
        } catch (error) {
            this.handleError(`Error updating service ${serviceId}`, error);
            throw error;
        }
    }

    /**
     * Delete a service
     * @param serviceId - ID of the service to delete
     * @returns Promise that resolves when deletion is complete
     */
    async deleteService(serviceId: string): Promise<void> {
        try {
            await this.api.delete(`/api/services/${serviceId}`);
        } catch (error) {
            this.handleError(`Error deleting service ${serviceId}`, error);
            throw error;
        }
    }

    /**
     * Handle API errors
     * @param message - Error message prefix
     * @param error - Error object
     */
    private handleError(message: string, error: any): void {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const data = error.response?.data;
            
            switch (status) {
                case 400:
                    throw new Error(`${message}: Bad Request - ${JSON.stringify(data)}`);
                case 404:
                    throw new Error(`${message}: Service not found`);
                case 500:
                    throw new Error(`${message}: Internal Server Error - ${JSON.stringify(data)}`);
                default:
                    throw new Error(`${message}: ${error.message}`);
            }
        }
        throw error;
    }
}

// Example usage:
/*
const api = new ServiceApiClient();

// Create a service
const newService = {
    'service-name': 'test-service',
    'service-ip': '192.168.1.100',
    'service-port': 8080,
    'protocol': 'HTTP' as const
};

async function example() {
    try {
        // Create
        const created = await api.createService(newService);
        console.log('Created service:', created);

        // Get all
        const services = await api.getAllServices();
        console.log('All services:', services);

        // Get one
        const service = await api.getService(created.id!);
        console.log('Single service:', service);

        // Update
        const updated = await api.updateService(created.id!, {
            ...newService,
            'service-port': 8081
        });
        console.log('Updated service:', updated);

        // Delete
        await api.deleteService(created.id!);
        console.log('Service deleted');
    } catch (error) {
        console.error('API Error:', error);
    }
}
*/
