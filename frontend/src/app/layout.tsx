import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import { Home, Users, Building2, FileText, DollarSign, BarChart3, Printer } from 'lucide-react'

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
                <div className="min-h-screen bg-gray-50">
                    {/* Header */}
                    <header className="bg-municipal-blue text-white shadow-lg">
                        <div className="container mx-auto px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                                        <Building2 className="w-8 h-8 text-municipal-blue" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold">GA NORTH MUNICIPAL</h1>
                                        <p className="text-sm text-blue-100">Revenue Management System</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm">Admin Portal</p>
                                    <p className="text-xs text-blue-200">2026</p>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Navigation */}
                    <nav className="bg-white shadow-md border-b">
                        <div className="container mx-auto px-6">
                            <ul className="flex space-x-1">
                                <NavLink href="/" icon={<Home className="w-4 h-4" />} label="Dashboard" />
                                <NavLink href="/customers" icon={<Users className="w-4 h-4" />} label="Customers" />
                                <NavLink href="/properties" icon={<Building2 className="w-4 h-4" />} label="Properties" />
                                <NavLink href="/businesses" icon={<FileText className="w-4 h-4" />} label="Businesses" />
                                <NavLink href="/billing" icon={<DollarSign className="w-4 h-4" />} label="Billing" />
                                <NavLink href="/reports" icon={<BarChart3 className="w-4 h-4" />} label="Reports" />
                                <NavLink href="/print" icon={<Printer className="w-4 h-4" />} label="Print" />
                            </ul>
                        </div>
                    </nav>

                    {/* Main Content */}
                    <main className="container mx-auto px-6 py-8">
                        {children}
                    </main>

                    {/* Footer */}
                    <footer className="bg-gray-800 text-white mt-16">
                        <div className="container mx-auto px-6 py-6">
                            <div className="text-center">
                                <p className="text-sm">© 2026 GA North Municipal - All Rights Reserved</p>
                                <p className="text-xs text-gray-400 mt-1">Municipal Revenue Management System v1.0</p>
                            </div>
                        </div>
                    </footer>
                </div>
            </body>
        </html>
    )
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    return (
        <li>
            <Link
                href={href}
                className="flex items-center space-x-2 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-municipal-blue transition-colors border-b-2 border-transparent hover:border-municipal-blue"
            >
                {icon}
                <span className="font-medium">{label}</span>
            </Link>
        </li>
    )
}
