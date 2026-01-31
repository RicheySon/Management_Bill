import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export default apiClient;

// API Functions

// Lookups
export const fetchElectoralAreas = async () => {
    try {
        const response = await apiClient.get('/lookups/electoral-areas');
        return response.data.data || [];
    } catch (error) {
        console.error('fetchElectoralAreas error:', error);
        return [];
    }
};

export const fetchLocalAreas = async (electoralAreaId?: number) => {
    try {
        const response = await apiClient.get('/lookups/local-areas', {
            params: { electoral_area_id: electoralAreaId },
        });
        return response.data.data || [];
    } catch (error) {
        console.error('fetchLocalAreas error:', error);
        return [];
    }
};

export const fetchPropertyClassifications = async () => {
    try {
        const response = await apiClient.get('/lookups/property-classifications');
        return response.data.data || [];
    } catch (error) {
        console.error('fetchPropertyClassifications error:', error);
        return [];
    }
};

export const fetchBusinessCategories = async () => {
    try {
        const response = await apiClient.get('/lookups/business-categories');
        return response.data.data || [];
    } catch (error) {
        console.error('fetchBusinessCategories error:', error);
        return [];
    }
};

// Customers
export const createCustomer = async (data: any) => {
    const response = await apiClient.post('/customers', data);
    return response.data;
};

export const fetchCustomer = async (id: string) => {
    const response = await apiClient.get(`/customers/${id}`);
    return response.data.data;
};

export const fetchCustomers = async (params?: any) => {
    const response = await apiClient.get('/customers', { params });
    return response.data;
};

// Properties
export const createProperty = async (data: any) => {
    const response = await apiClient.post('/properties', data);
    return response.data;
};

export const fetchProperty = async (id: string) => {
    const response = await apiClient.get(`/properties/${id}`);
    return response.data.data;
};

export const fetchProperties = async (params?: any) => {
    const response = await apiClient.get('/properties', { params });
    return response.data;
};

// Businesses
export const createBusiness = async (data: any) => {
    const response = await apiClient.post('/businesses', data);
    return response.data;
};

export const fetchBusiness = async (id: string) => {
    const response = await apiClient.get(`/businesses/${id}`);
    return response.data.data;
};

export const fetchBusinesses = async (params?: any) => {
    const response = await apiClient.get('/businesses', { params });
    return response.data;
};

// Billing
export const generateBill = async (data: any) => {
    const response = await apiClient.post('/bills/generate', data);
    return response.data;
};

export const fetchBill = async (id: string) => {
    const response = await apiClient.get(`/bills/${id}`);
    return response.data.data;
};

export const fetchBills = async (params?: any) => {
    const response = await apiClient.get('/bills', { params });
    return response.data;
};

export const recordPayment = async (billId: string, data: any) => {
    const response = await apiClient.post(`/bills/${billId}/payment`, data);
    return response.data;
};

// Reports
export const fetchDashboardData = async () => {
    const response = await apiClient.get('/reports/dashboard');
    return response.data.data;
};

export const fetchRevenueReport = async (params?: any) => {
    const response = await apiClient.get('/reports/revenue', { params });
    return response.data.data;
};

export const fetchDefaulters = async (params?: any) => {
    const response = await apiClient.get('/reports/defaulters', { params });
    return response.data.data;
};

// Print
export const downloadBillPDF = async (billId: string) => {
    const response = await apiClient.get(`/print/bill/${billId}`, {
        responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bill-${billId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

export const downloadBulkBillsPDF = async (filters: any) => {
    const response = await apiClient.post('/print/bills/bulk', filters, {
        responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bulk-bills-${Date.now()}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};
