'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import axios from 'axios';

interface User {
    id: string;
    full_name: string;
    email: string;
    roles: string[];
    permissions: string[];
    electoral_area_ids?: number[];
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
    hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const getDeviceFingerprint = () => {
    if (typeof window === 'undefined') return undefined;
    try {
        const key = 'device_fingerprint';
        let fp = localStorage.getItem(key);
        if (!fp) {
            fp = `web-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
            localStorage.setItem(key, fp);
        }
        return fp;
    } catch {
        return undefined;
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const validateToken = async () => {
            const storedToken = localStorage.getItem('auth_token');
            const storedUser = localStorage.getItem('auth_user');

            if (storedToken && storedUser) {
                try {
                    const { data } = await axios.get(`${API_BASE_URL}/auth/validate`, {
                        headers: { Authorization: `Bearer ${storedToken}` },
                        timeout: 5000,
                    });
                    // Prefer refreshed user/token so Supervisor Fee Configuration appears after deploy
                    const nextToken = data.token || storedToken;
                    const nextUser = data.user || JSON.parse(storedUser);
                    setToken(nextToken);
                    setUser(nextUser);
                    localStorage.setItem('auth_token', nextToken);
                    localStorage.setItem('auth_user', JSON.stringify(nextUser));
                    document.cookie = `auth_token=${nextToken}; path=/; SameSite=Lax`;
                } catch (error) {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('auth_user');
                    document.cookie = 'auth_token=; path=/; max-age=0';
                }
            }
            setIsLoading(false);
        };

        validateToken();
    }, []);

    const login = async (email: string, password: string) => {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            email,
            password,
            mac_address: 'unavailable',
            device_fingerprint: getDeviceFingerprint(),
        });
        const { token: newToken, user: newUser } = response.data;

        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
        const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `auth_token=${newToken}; path=/; SameSite=Lax${secure}`;

        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        router.push(next && next.startsWith('/') ? next : '/');
    };

    const logout = async () => {
        try {
            if (token) {
                await axios.post(
                    `${API_BASE_URL}/auth/logout`,
                    { mac_address: 'unavailable', device_fingerprint: getDeviceFingerprint() },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
        } catch {
            // ignore logout audit failures
        }
        setToken(null);
        setUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        document.cookie = 'auth_token=; path=/; max-age=0';
        router.push('/login');
    };

    const hasPermission = (permission: string) => {
        // Cheque clearance is Revenue Officer only — ignore stale Admin JWT grants
        if (permission === 'approve_cheque_payments') {
            return !!user?.roles?.includes('Revenue Officer');
        }
        if (user?.permissions?.includes(permission)) return true;
        // Supervisors always see/use Fee Configuration
        if (permission === 'configure_rates' && user?.roles?.includes('Supervisor')) return true;
        // Collectors can record payments on bills in their assigned areas
        if (permission === 'record_payment' && user?.roles?.includes('Revenue Collector')) return true;
        return false;
    };

    useEffect(() => {
        if (!isLoading && !token && pathname !== '/login') {
            router.push('/login');
        } else if (!isLoading && token && pathname === '/login') {
            router.push('/');
        }
    }, [token, pathname, isLoading, router]);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
