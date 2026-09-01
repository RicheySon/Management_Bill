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
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('auth_token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor — force logout on expired/invalid session
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (typeof window !== 'undefined' && error.response?.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        }
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

export const updateCustomer = async (id: string, data: any) => {
    const response = await apiClient.put(`/customers/${id}`, data);
    return response.data;
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

export const updateProperty = async (id: string, data: any) => {
    const response = await apiClient.put(`/properties/${id}`, data);
    return response.data;
};

export const deleteProperty = async (id: string) => {
    const response = await apiClient.delete(`/properties/${id}`);
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

export const updateBusiness = async (id: string, data: any) => {
    const response = await apiClient.put(`/businesses/${id}`, data);
    return response.data;
};

export const deleteBusiness = async (id: string) => {
    const response = await apiClient.delete(`/businesses/${id}`);
    return response.data;
};

// Billing
export const generateBill = async (data: any) => {
    const response = await apiClient.post('/bills/generate', data);
    return response.data;
};

export const previewBill = async (data: any) => {
    const response = await apiClient.post('/bills/preview', data);
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

const mapFilters = (frontendFilters: any) => {
    const mapped: any = {};
    if (frontendFilters.billing_year) mapped.year = parseInt(frontendFilters.billing_year);
    if (frontendFilters.electoral_area_id) mapped.electoral_area_id = parseInt(frontendFilters.electoral_area_id);
    if (frontendFilters.status) mapped.payment_status = frontendFilters.status;
    if (frontendFilters.property_classification_id) mapped.classification_id = parseInt(frontendFilters.property_classification_id);
    if (frontendFilters.business_category_id) mapped.category_id = parseInt(frontendFilters.business_category_id);

    if (frontendFilters.bill_type === 'PROPERTY') {
        mapped.bill_type = 'PROPERTY_RATE';
    } else if (frontendFilters.bill_type === 'BOP') {
        mapped.bill_type = 'BOP';
    }
    return mapped;
};

export const sendBulkSMS = async (data: any) => {
    const response = await apiClient.post('/bills/bulk-sms', {
        ...data,
        filters: mapFilters(data.filters)
    });
    return response.data;
};

export const recordPayment = async (billId: string, data: { amount: number; payment_method: string; gcr_number: string; customer_id: string; payment_reference?: string }) => {
    const response = await apiClient.post(`/bills/${billId}/payment`, data);
    return response.data;
};

export const requestBillAmountChange = async (
    billId: string,
    data: {
        current_rate?: number;
        arrears?: number;
        rebate?: number;
        total_amount?: number;
        reason?: string;
    }
) => {
    const response = await apiClient.put(`/bills/${billId}/amounts`, data);
    return response.data;
};

export const fetchAmountChanges = async (params?: { status?: string; entity_type?: string; limit?: number }) => {
    const response = await apiClient.get('/amount-changes', { params });
    return response.data.data || [];
};

export const approveAmountChange = async (id: string, review_note?: string) => {
    const response = await apiClient.post(`/amount-changes/${id}/approve`, { review_note });
    return response.data;
};

export const rejectAmountChange = async (id: string, review_note?: string) => {
    const response = await apiClient.post(`/amount-changes/${id}/reject`, { review_note });
    return response.data;
};

export const deleteBill = async (id: string) => {
    const response = await apiClient.delete(`/bills/${id}`);
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
    try {
        const response = await apiClient.get(`/print/bill/${billId}`, {
            responseType: 'blob',
        });

        // If server returned JSON error as blob
        if (response.data?.type === 'application/json') {
            const text = await response.data.text();
            const parsed = JSON.parse(text);
            throw new Error(parsed.error || 'Print failed');
        }

        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `bill-${billId}.pdf`);
        document.body.appendChild(link);
        link.click();

        // Cleanup
        setTimeout(() => {
            if (link.parentNode) link.remove();
            window.URL.revokeObjectURL(url);
        }, 100);
    } catch (error: any) {
        console.error('Download failed:', error);
        const msg =
            error?.response?.data instanceof Blob
                ? JSON.parse(await error.response.data.text())?.error
                : error?.response?.data?.error || error?.message || 'Failed to download PDF';
        alert(msg);
        throw error;
    }
};

export const printBillPDF = async (billId: string) => {
    try {
        const response = await apiClient.get(`/print/bill/${billId}`, {
            responseType: 'blob',
        });

        if (response.data?.type === 'application/json') {
            const text = await response.data.text();
            const parsed = JSON.parse(text);
            throw new Error(parsed.error || 'Print failed');
        }

        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);

        // Detect mobile users - direct tab/window is more reliable for mobile printing
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
            window.open(url, '_blank');
            return;
        }

        // Create hidden iframe for desktop printing
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.src = url;
        document.body.appendChild(iframe);

        iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
                if (iframe.parentNode) document.body.removeChild(iframe);
                window.URL.revokeObjectURL(url);
            }, 2000);
        };
    } catch (error: any) {
        console.error('Print failed:', error);
        let msg = error?.message || 'Failed to initialize print. Please try again.';
        if (error?.response?.data instanceof Blob) {
            try {
                msg = JSON.parse(await error.response.data.text())?.error || msg;
            } catch {
                // ignore
            }
        }
        alert(msg);
        throw error;
    }
};

export const downloadBulkBillsPDF = async (frontendFilters: any) => {
    const response = await apiClient.post('/print/bills/bulk', {
        filters: mapFilters(frontendFilters)
    }, {
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

export const exportAuditLogs = async (params?: any) => {
    const response = await apiClient.get('/audit/export', {
        params: { ...params, limit: 5000 },
        responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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
export const reverseGeocode = async (lat: number, lon: number) => {
    try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
            headers: {
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        return response.data;
    } catch (error) {
        console.error('Reverse geocoding failed:', error);
        return null;
    }
};

export const fetchActivePropertyRateZones = async (year?: number) => {
    const response = await apiClient.get('/fee-config/active/property-zones', { params: { year } });
    return response.data.data;
};

export const fetchActiveBusinessFeeItems = async (year?: number) => {
    const response = await apiClient.get('/fee-config/active/business-items', { params: { year } });
    return response.data.data;
};

// Data Management
export const exportData = async (type: 'customers' | 'properties' | 'businesses') => {
    try {
        const response = await apiClient.get(`/data/export/${type}`, {
            responseType: 'arraybuffer'
        });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${type}_export_${new Date().toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        return true;
    } catch (error) {
        console.error(`Export ${type} error:`, error);
        throw error;
    }
};

export const importData = async (type: 'customers' | 'properties' | 'businesses', file: File) => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post(`/data/import/${type}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error: any) {
        console.error(`Import ${type} error:`, error);
        throw error.response?.data || error;
    }
};

// Privileged action requests (print / delete approvals)
export const requestPrivilegedAction = async (data: {
    action_type: 'PRINT_BILL' | 'DELETE_BILL';
    bill_id: string;
    reason?: string;
}) => {
    const response = await apiClient.post('/action-requests', data);
    return response.data;
};

export const fetchActionRequests = async (params?: { status?: string; limit?: number }) => {
    const response = await apiClient.get('/action-requests', { params });
    return response.data.data || [];
};

export const approveActionRequest = async (id: string, review_note?: string) => {
    const response = await apiClient.post(`/action-requests/${id}/approve`, { review_note });
    return response.data;
};

export const rejectActionRequest = async (id: string, review_note?: string) => {
    const response = await apiClient.post(`/action-requests/${id}/reject`, { review_note });
    return response.data;
};
