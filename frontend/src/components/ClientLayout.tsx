'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import {
    Home, Users, Building2, FileText,
    DollarSign, BarChart3, Printer, LogOut, Loader2, Shield,
    Briefcase, ClipboardList, Settings, Menu, Database, MapPinned
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BackButton from '@/components/BackButton';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const { user, logout, isLoading, hasPermission } = useAuth();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-12 h-12 text-municipal-red animate-spin" />
            </div>
        );
    }

    // Only allow login page to render without a layout
    // Also if user is not logged in and not on login page, AuthContext will redirect
    if (!user || pathname === '/login') {
        return <main className="min-h-screen bg-gray-50">{children}</main>;
    }

    const isRevenueCollector = user.roles?.includes('Revenue Collector');

    if (isRevenueCollector) {
        return (
            <div className="flex min-h-screen bg-gray-50">
                {/* Mobile Overlay */}
                {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

                {/* Revenue Collector Sidebar - Teal Theme */}
                <aside className={`w-64 bg-white border-r shadow-sm flex flex-col fixed h-full z-30 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                    <div className="p-6 flex justify-center">
                        <div className="w-36 h-36 rounded-full overflow-hidden border-2 border-gray-100">
                            <img src="/logo.jpg" alt="GA North Logo" className="w-full h-full object-cover" />
                        </div>
                    </div>

                    <div className="mx-6 border-b-2 border-municipal-teal"></div>

                    <nav className="flex-1 overflow-y-auto py-6 px-4">
                        <ul className="space-y-4">
                            <CollectorNavLink href="/" icon={<Home className="w-6 h-6" />} label="Home" onClick={() => setIsSidebarOpen(false)} />
                            <CollectorNavLink href="/customers" icon={<Users className="w-6 h-6" />} label="Rate Payers" onClick={() => setIsSidebarOpen(false)} />
                            <CollectorNavLink href="/properties" icon={<Building2 className="w-6 h-6" />} label="Property Rates" onClick={() => setIsSidebarOpen(false)} />
                            <CollectorNavLink href="/businesses" icon={<Briefcase className="w-6 h-6" />} label="Business Owners" onClick={() => setIsSidebarOpen(false)} />
                            <CollectorNavLink href="/businesses#permits" icon={<ClipboardList className="w-6 h-6" />} label="Business Operation Permits" onClick={() => setIsSidebarOpen(false)} />
                            {(hasPermission('request_print') || hasPermission('request_delete') || hasPermission('record_payment')) && (
                                <CollectorNavLink href="/billing" icon={<ClipboardList className="w-6 h-6" />} label="Bills & Requests" onClick={() => setIsSidebarOpen(false)} />
                            )}
                        </ul>
                    </nav>

                    <div className="mx-6 border-b-2 border-municipal-teal"></div>

                    <div className="p-4">
                        <button
                            onClick={logout}
                            className="flex items-center space-x-3 w-full px-4 py-3 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-all"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="font-semibold text-sm">Logout</span>
                        </button>
                        <div className="mt-4 text-sm text-center text-municipal-teal font-medium">
                            Version 1.0.3
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 ml-0 md:ml-64 flex flex-col transition-all duration-300">
                    <header className="bg-white border-b h-16 flex items-center px-4 md:px-8 justify-between sticky top-0 z-10">
                        <div className="flex items-center text-gray-400 gap-3">
                            <button className="md:hidden p-1 hover:bg-gray-100 rounded-md" onClick={() => setIsSidebarOpen(true)}>
                                <Menu className="w-6 h-6 text-gray-600" />
                            </button>
                            <BackButton />
                            <span className="text-sm font-medium hidden sm:inline-block">Municipal Revenue Management System</span>
                            <span className="text-sm font-medium sm:hidden">MRMS</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">{user.full_name}</p>
                                <p className="text-[10px] text-municipal-teal font-bold uppercase tracking-tighter">
                                    Revenue Collector
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-municipal-teal rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-teal-500/20">
                                {user.full_name.split(' ').map((n: string) => n[0]).join('')}
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 p-8">
                        <div className="container mx-auto">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Mobile Overlay */}
            {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

            {/* Sidebar */}
            <aside className={`w-64 bg-white border-r shadow-sm flex flex-col fixed h-full z-30 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-6 border-b bg-municipal-red">
                    <div className="flex items-center space-x-3 text-white">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                            <img src="/logo.jpg" alt="GA North Logo" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold leading-tight">GA NORTH</h1>
                            <p className="text-[10px] text-red-100 uppercase tracking-wider">Revenue System</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-6 px-4">
                    <ul className="space-y-2">
                        <NavLink href="/" icon={<Home className="w-5 h-5" />} label="Dashboard" onClick={() => setIsSidebarOpen(false)} />

                        {hasPermission('view_customer') &&
                            <NavLink href="/customers" icon={<Users className="w-5 h-5" />} label="Customers" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {(hasPermission('register_property') || hasPermission('edit_property')) &&
                            <NavLink href="/properties" icon={<Building2 className="w-5 h-5" />} label="Properties" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {(hasPermission('register_business') || hasPermission('edit_business')) &&
                            <NavLink href="/businesses" icon={<FileText className="w-5 h-5" />} label="Businesses" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {hasPermission('generate_bill') &&
                            <NavLink href="/billing" icon={<DollarSign className="w-5 h-5" />} label="Billing" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {/* Cashier / collectors who pay or request actions */}
                        {!hasPermission('generate_bill') && (hasPermission('record_payment') || hasPermission('request_print') || hasPermission('request_delete')) &&
                            <NavLink href="/billing" icon={<DollarSign className="w-5 h-5" />} label="Billing & Payments" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {hasPermission('view_reports') &&
                            <NavLink href="/reports" icon={<BarChart3 className="w-5 h-5" />} label="Reports" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {hasPermission('bulk_print') &&
                            <NavLink href="/print" icon={<Printer className="w-5 h-5" />} label="Bulk Printing" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {/* Admin Links */}
                        {(hasPermission('manage_users') || hasPermission('configure_rates') || hasPermission('view_logs') || hasPermission('approve_amount_changes') || hasPermission('approve_privileged_actions')) && (
                            <div className="pt-4 pb-2">
                                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Administration</p>
                            </div>
                        )}

                        {hasPermission('manage_users') &&
                            <NavLink href="/admin/users" icon={<Shield className="w-5 h-5" />} label="User Management" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {(hasPermission('approve_amount_changes') || hasPermission('approve_privileged_actions')) &&
                            <NavLink href="/admin/approvals" icon={<ClipboardList className="w-5 h-5" />} label="Approvals" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {hasPermission('manage_users') &&
                            <NavLink href="/admin/areas" icon={<MapPinned className="w-5 h-5" />} label="Areas & Communities" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {hasPermission('configure_rates') &&
                            <NavLink href="/admin/configuration" icon={<Settings className="w-5 h-5" />} label="Fee Configuration" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {hasPermission('view_logs') &&
                            <NavLink href="/admin/audit" icon={<FileText className="w-5 h-5" />} label="Audit Logs" onClick={() => setIsSidebarOpen(false)} />
                        }

                        {hasPermission('manage_users') &&
                            <NavLink href="/admin/data-management" icon={<Database className="w-5 h-5" />} label="Data Management" onClick={() => setIsSidebarOpen(false)} />
                        }
                    </ul>
                </nav>

                <div className="p-4 border-t bg-gray-50">
                    <button
                        onClick={logout}
                        className="flex items-center space-x-3 w-full px-4 py-3 text-gray-600 rounded-lg hover:bg-red-50 hover:text-municipal-red transition-all group"
                    >
                        <LogOut className="w-5 h-5 text-gray-400 group-hover:text-municipal-red" />
                        <span className="font-semibold text-sm">Logout</span>
                    </button>
                    <div className="mt-4 text-[10px] text-center text-gray-400 font-medium uppercase tracking-widest">
                        v1.0.3
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 ml-0 md:ml-64 flex flex-col transition-all duration-300">
                {/* Header */}
                <header className="bg-white border-b h-16 flex items-center px-4 md:px-8 justify-between sticky top-0 z-10">
                    <div className="flex items-center text-gray-400 gap-3">
                        <button className="md:hidden p-1 hover:bg-gray-100 rounded-md" onClick={() => setIsSidebarOpen(true)}>
                            <Menu className="w-6 h-6 text-gray-600" />
                        </button>
                        <BackButton />
                        <span className="text-sm font-medium hidden sm:inline-block">Municipal Revenue Management System</span>
                        <span className="text-sm font-medium sm:hidden">MRMS</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">{user.full_name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                                {user.roles && user.roles.length > 0 ? user.roles[0] : 'User'}
                            </p>
                        </div>
                        <div className="w-10 h-10 bg-municipal-red rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-red-500/20">
                            {user.full_name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-8">
                    <div className="container mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

function NavLink({ href, icon, label, onClick }: { href: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
    const pathname = usePathname();
    const isActive = pathname === href || pathname.startsWith(`${href}/`);

    return (
        <li>
            <Link
                href={href}
                onClick={onClick}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all group ${isActive
                    ? 'bg-red-50 text-municipal-red font-medium shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-municipal-red'
                    }`}
            >
                <div className={`transition-colors ${isActive ? 'text-municipal-red' : 'text-gray-400 group-hover:text-municipal-red'}`}>
                    {icon}
                </div>
                <span className="text-sm">{label}</span>
            </Link>
        </li>
    );
}

function CollectorNavLink({ href, icon, label, onClick }: { href: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
    return (
        <li>
            <Link
                href={href}
                onClick={onClick}
                className="flex items-center space-x-4 px-4 py-3 rounded-lg text-municipal-teal hover:bg-teal-50 transition-all group"
            >
                <div className="text-municipal-teal">
                    {icon}
                </div>
                <span className="text-base font-semibold">{label}</span>
            </Link>
        </li>
    );
}
