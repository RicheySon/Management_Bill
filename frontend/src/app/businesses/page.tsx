'use client';

import { useState, useEffect } from 'react';
import { fetchBusinesses } from '@/lib/api-client';
import { Plus, Search, FileText, User, ShoppingBag, MapPin, Tag } from 'lucide-react';
import Link from 'next/link';

export default function BusinessesPage() {
    const [businesses, setBusinesses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadBusinesses = async () => {
            try {
                const result = await fetchBusinesses();
                setBusinesses(result.data || []);
            } catch (error) {
                console.error('Failed to fetch businesses:', error);
            } finally {
                setLoading(false);
            }
        };
        loadBusinesses();
    }, []);

    const filteredBusinesses = businesses.filter(biz =>
        biz.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        biz.business_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        biz.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Businesses (BOP)</h1>
                    <p className="text-gray-600 mt-1">Manage all business operating permits</p>
                </div>
                <Link href="/businesses/new" className="btn-primary flex items-center space-x-2 self-start">
                    <Plus className="w-5 h-5" />
                    <span>Register New Business</span>
                </Link>
            </div>

            <div className="card mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by business name, BOP number, or owner..."
                        className="input-field pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading businesses...</p>
                </div>
            ) : filteredBusinesses.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {filteredBusinesses.map((biz) => (
                        <div key={biz.id} className="card hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center mb-1">
                                        <div className="w-8 h-8 bg-orange-50 rounded flex items-center justify-center text-orange-600 mr-2">
                                            <ShoppingBag className="w-4 h-4" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">{biz.business_name}</h3>
                                    </div>
                                    <p className="text-xs font-mono font-bold text-municipal-red">{biz.business_number}</p>
                                    {biz.account_number && (
                                        <p className="text-xs text-gray-500 mt-0.5">Acct: <span className="font-mono">{biz.account_number}</span></p>
                                    )}
                                </div>
                                <span className={`px-2 py-1 text-xs font-bold rounded-full ${biz.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                    {biz.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-6">
                                <div>
                                    <p className="text-xs text-gray-400 uppercase font-bold tracking-tighter">Owner</p>
                                    <div className="flex items-center mt-1">
                                        <User className="w-4 h-4 mr-1 text-gray-300" />
                                        {biz.owner_name}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 uppercase font-bold tracking-tighter">Category</p>
                                    <div className="flex items-center mt-1">
                                        <Tag className="w-4 h-4 mr-1 text-gray-300" />
                                        {biz.category_name}
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs text-gray-400 uppercase font-bold tracking-tighter">Location</p>
                                    <div className="flex items-center mt-1">
                                        <MapPin className="w-4 h-4 mr-1 text-gray-300" />
                                        {biz.physical_location || 'No location set'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                                <Link
                                    href={`/businesses/${biz.id}`}
                                    className="text-municipal-red text-sm font-bold hover:underline"
                                >
                                    Manage Business
                                </Link>
                                <div className="text-xs text-gray-400">
                                    Registered: {new Date(biz.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card text-center py-20">
                    <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No businesses found</h3>
                    <p className="text-gray-600 mt-1">Try a different search or register a new business.</p>
                </div>
            )}
        </div>
    );
}
