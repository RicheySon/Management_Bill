import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { Home, Users, Building2, FileText, DollarSign, BarChart3, Printer, LogOut, Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { usePathname } from 'next/navigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Municipal Revenue Management System',
    description: 'GA North Municipal Revenue Collection Platform',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <AuthProvider>
                    <AppLayout>{children}</AppLayout>
                </AuthProvider>
            </body>
        </html>
    )
}

function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, logout, isLoading, hasPermission } = useAuth();
    const pathname = usePathname();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-12 h-12 text-municipal-red animate-spin" />
            </div>
        );
    }

    // Only allow login page to render without a layout
    if (!user || pathname === '/login') {
        return <main className="min-h-screen bg-gray-50">{children}</main>;
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r shadow-sm flex flex-col fixed h-full z-10">
                <div className="p-6 border-b bg-municipal-red">
                    <div className="flex items-center space-x-3 text-white">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                            <img src="/logo.png" alt="GA North Logo" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold leading-tight">GA NORTH</h1>
                            <p className="text-[10px] text-red-100 uppercase tracking-wider">Revenue System</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-6 px-4">
                    <ul className="space-y-2">
                        <NavLink href="/" icon={<Home className="w-5 h-5" />} label="Dashboard" />
                        {hasPermission('view_customer') && <NavLink href="/customers" icon={<Users className="w-5 h-5" />} label="Customers" />}
                        {(hasPermission('register_property') || hasPermission('edit_property')) && <NavLink href="/properties" icon={<Building2 className="w-5 h-5" />} label="Properties" />}
                        {(hasPermission('register_business') || hasPermission('edit_business')) && <NavLink href="/businesses" icon={<FileText className="w-5 h-5" />} label="Businesses" />}
                        {hasPermission('generate_bill') && <NavLink href="/billing" icon={<DollarSign className="w-5 h-5" />} label="Billing" />}
                        {hasPermission('view_reports') && <NavLink href="/reports" icon={<BarChart3 className="w-5 h-5" />} label="Reports" />}
                        {hasPermission('bulk_print') && <NavLink href="/print" icon={<Printer className="w-5 h-5" />} label="Print" />}
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
                        v1.1.0-RBAC
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 ml-64 flex flex-col">
                {/* Header */}
                <header className="bg-white border-b h-16 flex items-center px-8 justify-between sticky top-0 z-10">
                    <div className="flex items-center text-gray-400">
                        <span className="text-sm font-medium">Municipal Revenue Management System</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">{user.full_name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{user.roles[0]}</p>
                        </div>
                        <div className="w-10 h-10 bg-municipal-red rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-red-500/20">
                            {user.full_name.split(' ').map(n => n[0]).join('')}
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

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    return (
        <li>
            <Link
                href={href}
                className="flex items-center space-x-3 px-4 py-3 text-gray-600 rounded-lg hover:bg-red-50 hover:text-municipal-red transition-all group"
            >
                <div className="text-gray-400 group-hover:text-municipal-red transition-colors">
                    {icon}
                </div>
                <span className="font-medium text-sm">{label}</span>
            </Link>
        </li>
    )
}
