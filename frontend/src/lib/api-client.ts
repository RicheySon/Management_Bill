import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config) => {
        // Only run in browser environment
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('auth_token');
            console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
                hasToken: !!token,
                tokenPrefix: token ? `${token.substring(0, 10)}...` : 'none'
            });
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            } else {
                console.warn('No auth token found in localStorage for request:', config.url);
            }
        }
        return config;
    },
    (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
    }
);

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

// Users & Roles
export const fetchUsers = async () => {
    const response = await apiClient.get('/users');
    return response.data.data;
};

export const fetchRoles = async () => {
    const response = await apiClient.get('/users/roles');
    return response.data.data;
};

export const createUser = async (data: any) => {
    const response = await apiClient.post('/users', data);
    return response.data;
};

export const updateUserStatus = async (id: string, status: string) => {
    const response = await apiClient.patch(`/users/${id}/status`, { status });
    return response.data;
};

// Audit Logs
export const fetchAuditLogs = async (params?: any) => {
    const response = await apiClient.get('/audit', { params });
    return response.data.data;
};

// =====================================================
// FEE CONFIGURATION
// =====================================================

// Fee Schedules
export const fetchFeeSchedules = async (year?: number) => {
    const response = await apiClient.get('/fee-config/schedules', { params: { year } });
    return response.data.data;
};

export const fetchFeeSchedule = async (id: number) => {
    const response = await apiClient.get(`/fee-config/schedules/${id}`);
    return response.data.data;
};

export const createFeeSchedule = async (data: any) => {
    const response = await apiClient.post('/fee-config/schedules', data);
    return response.data;
};

export const updateFeeSchedule = async (id: number, data: any) => {
    const response = await apiClient.put(`/fee-config/schedules/${id}`, data);
    return response.data;
};

export const activateFeeSchedule = async (id: number) => {
    const response = await apiClient.put(`/fee-config/schedules/${id}/activate`);
    return response.data;
};

// Property Rate Zones
export const fetchPropertyRateZones = async (scheduleId: number) => {
    const response = await apiClient.get(`/fee-config/schedules/${scheduleId}/property-zones`);
    return response.data.data;
};

export const createPropertyRateZone = async (scheduleId: number, data: any) => {
    const response = await apiClient.post(`/fee-config/schedules/${scheduleId}/property-zones`, data);
    return response.data;
};

export const updatePropertyRateZone = async (zoneId: number, data: any) => {
    const response = await apiClient.put(`/fee-config/property-zones/${zoneId}`, data);
    return response.data;
};

export const deletePropertyRateZone = async (zoneId: number) => {
    const response = await apiClient.delete(`/fee-config/property-zones/${zoneId}`);
    return response.data;
};

// Business Fee Items
export const fetchBusinessFeeItems = async (scheduleId: number) => {
    const response = await apiClient.get(`/fee-config/schedules/${scheduleId}/business-items`);
    return response.data.data;
};

export const createBusinessFeeItem = async (scheduleId: number, data: any) => {
    const response = await apiClient.post(`/fee-config/schedules/${scheduleId}/business-items`, data);
    return response.data;
};

export const updateBusinessFeeItem = async (itemId: number, data: any) => {
    const response = await apiClient.put(`/fee-config/business-items/${itemId}`, data);
    return response.data;
};

export const deleteBusinessFeeItem = async (itemId: number) => {
    const response = await apiClient.delete(`/fee-config/business-items/${itemId}`);
    return response.data;
};

// Excel Import
export const previewFeeScheduleImport = async (scheduleId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(
        `/fee-config/schedules/${scheduleId}/import/preview`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
};

export const commitFeeScheduleImport = async (scheduleId: number, data: any) => {
    const response = await apiClient.post(`/fee-config/schedules/${scheduleId}/import/commit`, data);
    return response.data;
};

// Active Fee Schedule Lookups (for forms)
export const fetchActivePropertyRateZones = async (year?: number) => {
    const response = await apiClient.get('/fee-config/active/property-zones', { params: { year } });
    return response.data.data;
};

export const fetchActiveBusinessFeeItems = async (year?: number) => {
    const response = await apiClient.get('/fee-config/active/business-items', { params: { year } });
    return response.data.data;
};
