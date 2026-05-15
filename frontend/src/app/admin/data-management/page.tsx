'use client';

import { useState } from 'react';
import { exportData, importData } from '@/lib/api-client';
import { DownloadCloud, UploadCloud, FileSpreadsheet, FileWarning, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type DataType = 'customers' | 'properties' | 'businesses';

export default function DataManagementPage() {
    const { hasPermission } = useAuth();
    const [selectedType, setSelectedType] = useState<DataType>('customers');
    const [file, setFile] = useState<File | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Ensure only admins/users with 'manage_users' can access here based on backend requirement
    if (!hasPermission('manage_users')) {
        return (
            <div className="flex h-64 items-center justify-center p-8 bg-white rounded-xl border border-gray-200 mt-8">
                <div className="text-center">
                    <FileWarning className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
                    <p className="text-gray-500 mt-2">You do not have permission to view this page.</p>
                </div>
            </div>
        );
    }

    const typeLabels = {
        customers: 'Customers',
        properties: 'Properties',
        businesses: 'Businesses'
    };

    const handleExport = async () => {
        setIsExporting(true);
        setMessage(null);
        try {
            await exportData(selectedType);
            setMessage({ type: 'success', text: `Successfully exported ${typeLabels[selectedType]}.` });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to export data.' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setIsImporting(true);
        setMessage(null);
        try {
            const res = await importData(selectedType, file);
            if (res.success) {
                setMessage({
                    type: 'success',
                    text: `Import complete. Inserted ${res.data.importedCount} new records. Skipped ${res.data.skippedCount} duplicates.`
                });
                setFile(null);
                // Reset file input
                const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } else {
                setMessage({ type: 'error', text: res.error || 'Import failed.' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.error || 'Check the console for errors.' });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center">
                        <FileSpreadsheet className="w-6 h-6 mr-2 text-municipal-red" />
                        Data Management
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Import Excel sheets or export your database table.</p>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl border flex items-start \${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5 mr-3 shrink-0" /> : <FileWarning className="w-5 h-5 mr-3 shrink-0" />}
                    <span>{message.text}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Configuration Sidebar */}
                <div className="lg:col-span-1 border border-gray-200 bg-white shadow-sm p-6 rounded-xl space-y-4">
                    <h3 className="font-bold text-gray-800 border-b pb-2">Data Type</h3>
                    <div className="space-y-2">
                        {(Object.keys(typeLabels) as DataType[]).map((type) => (
                            <label
                                key={type}
                                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors \${selectedType === type ? 'border-municipal-red bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}
                            >
                                <input
                                    type="radio"
                                    name="dataType"
                                    value={type}
                                    checked={selectedType === type}
                                    onChange={() => setSelectedType(type)}
                                    className="text-municipal-red focus:ring-municipal-red"
                                />
                                <span className="\${selectedType === type ? 'font-semibold text-municipal-red' : 'text-gray-700'} ml-3">
                                    {typeLabels[type]}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Import / Export Controls */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Export Card */}
                    <div className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl flex flex-col sm:flex-row justify-between items-center sm:items-start">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Export {typeLabels[selectedType]}</h3>
                            <p className="text-sm text-gray-500 mt-1">Download all current records to an Excel (.xlsx) file.</p>
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="mt-4 sm:mt-0 flex items-center justify-center px-4 py-2 bg-municipal-red text-white text-sm font-semibold rounded hover:bg-red-800 disabled:opacity-50 transition-colors"
                        >
                            <DownloadCloud className="w-4 h-4 mr-2" />
                            {isExporting ? 'Exporting...' : 'Export Data'}
                        </button>
                    </div>

                    {/* Import Card */}
                    <div className="bg-white border border-gray-200 shadow-sm p-6 rounded-xl">
                        <h3 className="text-lg font-bold text-gray-800">Import {typeLabels[selectedType]}</h3>
                        <p className="text-sm text-gray-500 mt-1 mb-6">
                            Upload an Excel file to bulk import. <br />
                            <strong>Note:</strong> We automatically skip duplicate items if they already exist in the database (based on Phone Number or ID Number).
                        </p>

                        <form onSubmit={handleImport} className="space-y-4">
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-municipal-red transition-colors bg-gray-50">
                                <input
                                    type="file"
                                    id="file-upload"
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />
                                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                                    <FileSpreadsheet className={`w-10 h-10 mb-2 \${file ? 'text-municipal-red' : 'text-gray-400'}`} />
                                    {file ? (
                                        <span className="font-semibold text-municipal-red">{file.name}</span>
                                    ) : (
                                        <>
                                            <span className="font-semibold text-gray-700">Click to select an Excel file</span>
                                            <span className="text-xs text-gray-500 mt-1">Supports .xlsx and .xls</span>
                                        </>
                                    )}
                                </label>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isImporting || !file}
                                    className="flex items-center px-6 py-2 bg-gray-900 text-white font-semibold rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
                                >
                                    <UploadCloud className="w-4 h-4 mr-2" />
                                    {isImporting ? 'Importing...' : 'Start Import'}
                                </button>
                            </div>
                        </form>
                    </div>

                </div>

            </div>
        </div>
    );
}
