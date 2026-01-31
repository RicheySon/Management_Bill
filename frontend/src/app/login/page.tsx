'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await login(email, password);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Invalid credentials or connection error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-6">
                        <div className="w-24 h-24 relative p-4 bg-white rounded-2xl shadow-sm border border-red-100 flex items-center justify-center">
                            <Image
                                src="/logo.png"
                                alt="GA North Logo"
                                width={80}
                                height={80}
                                className="object-contain"
                            />
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Municipal Revenue</h1>
                    <p className="text-gray-500 mt-2 font-medium">GA North Municipal - Management Portal</p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-red-200/20 border border-gray-100 p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center space-x-3 text-red-600 animate-in fade-in slide-in-from-top-2 duration-300">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-semibold">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 ml-1">Staff Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-municipal-red transition-colors" />
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-municipal-red focus:bg-white focus:ring-4 focus:ring-red-500/10 transition-all font-medium"
                                    placeholder="name@ganorth.gov.gh"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 ml-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-municipal-red transition-colors" />
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-municipal-red focus:bg-white focus:ring-4 focus:ring-red-500/10 transition-all font-medium"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-municipal-red text-white rounded-2xl font-bold shadow-lg shadow-red-500/30 hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center space-x-3 disabled:opacity-70 disabled:pointer-events-none"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <span>Sign in to Dashboard</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <div className="mt-8 text-center text-sm text-gray-500 font-medium">
                    <p>© 2026 GA North Municipal Assembly</p>
                    <p className="mt-1">Internal Revenue Management System</p>
                </div>
            </div>
        </div>
    );
}
