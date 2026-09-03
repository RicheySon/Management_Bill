'use client';

import { useEffect, useState } from 'react';
import {
    fetchElectoralAreas,
    fetchLocalAreas,
    createElectoralArea,
    updateElectoralArea,
    deleteElectoralArea,
    createLocalArea,
    updateLocalArea,
    deleteLocalArea,
} from '@/lib/api-client';
import { MapPinned, Plus, Trash2, Save, Pencil } from 'lucide-react';

export default function ElectoralAreasAdminPage() {
    const [areas, setAreas] = useState<any[]>([]);
    const [communities, setCommunities] = useState<any[]>([]);
    const [selectedAreaId, setSelectedAreaId] = useState<number | ''>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [areaForm, setAreaForm] = useState({ id: 0, name: '', code: '' });
    const [communityForm, setCommunityForm] = useState({ id: 0, name: '' });

    const loadAreas = async () => {
        const list = await fetchElectoralAreas();
        setAreas(list || []);
        if (!selectedAreaId && list?.length) {
            setSelectedAreaId(list[0].id);
        }
    };

    const loadCommunities = async (areaId: number | '') => {
        if (!areaId) {
            setCommunities([]);
            return;
        }
        const list = await fetchLocalAreas(Number(areaId));
        setCommunities(list || []);
    };

    useEffect(() => {
        (async () => {
            try {
                await loadAreas();
            } catch {
                setError('Failed to load electoral areas');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        loadCommunities(selectedAreaId);
        setCommunityForm({ id: 0, name: '' });
    }, [selectedAreaId]);

    const selectedArea = areas.find((a) => a.id === selectedAreaId);

    const saveArea = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        try {
            if (areaForm.id) {
                await updateElectoralArea(areaForm.id, {
                    name: areaForm.name.trim(),
                    code: areaForm.code.trim().toUpperCase(),
                });
                setMessage('Electoral area updated');
            } else {
                await createElectoralArea({
                    name: areaForm.name.trim(),
                    code: areaForm.code.trim().toUpperCase(),
                });
                setMessage('Electoral area added');
            }
            setAreaForm({ id: 0, name: '', code: '' });
            await loadAreas();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to save electoral area');
        }
    };

    const removeArea = async (id: number) => {
        if (!confirm('Delete this electoral area? Communities must be removed first.')) return;
        setError(null);
        try {
            await deleteElectoralArea(id);
            if (selectedAreaId === id) setSelectedAreaId('');
            setMessage('Electoral area deleted');
            await loadAreas();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to delete electoral area');
        }
    };

    const saveCommunity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAreaId) return;
        setError(null);
        setMessage(null);
        try {
            if (communityForm.id) {
                await updateLocalArea(communityForm.id, {
                    name: communityForm.name.trim(),
                    electoral_area_id: Number(selectedAreaId),
                });
                setMessage('Community updated');
            } else {
                await createLocalArea({
                    name: communityForm.name.trim(),
                    electoral_area_id: Number(selectedAreaId),
                });
                setMessage('Community added');
            }
            setCommunityForm({ id: 0, name: '' });
            await loadCommunities(selectedAreaId);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to save community');
        }
    };

    const removeCommunity = async (id: number) => {
        if (!confirm('Delete this community?')) return;
        setError(null);
        try {
            await deleteLocalArea(id);
            setMessage('Community deleted');
            await loadCommunities(selectedAreaId);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to delete community');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-municipal-red" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <MapPinned className="w-8 h-8 text-municipal-red" />
                    Electoral Areas & Communities
                </h1>
                <p className="text-gray-600 mt-1">
                    Add or remove electoral areas and link communities so registration dropdowns stay matched.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}
            {message && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">{message}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card space-y-4">
                    <h2 className="font-bold text-lg">Electoral Areas</h2>
                    <form onSubmit={saveArea} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                            className="input-field md:col-span-1"
                            placeholder="Name (e.g. POKUASE)"
                            value={areaForm.name}
                            onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                            required
                        />
                        <input
                            className="input-field"
                            placeholder="Code (e.g. POK)"
                            value={areaForm.code}
                            onChange={(e) => setAreaForm({ ...areaForm, code: e.target.value.toUpperCase() })}
                            required
                            maxLength={20}
                        />
                        <button type="submit" className="btn-primary flex items-center justify-center gap-2">
                            {areaForm.id ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {areaForm.id ? 'Update' : 'Add Area'}
                        </button>
                    </form>
                    {areaForm.id > 0 && (
                        <button
                            type="button"
                            className="text-xs text-gray-500 underline"
                            onClick={() => setAreaForm({ id: 0, name: '', code: '' })}
                        >
                            Cancel edit
                        </button>
                    )}
                    <div className="divide-y border rounded-lg overflow-hidden">
                        {areas.map((area) => (
                            <div
                                key={area.id}
                                className={`flex items-center justify-between px-4 py-3 ${
                                    selectedAreaId === area.id ? 'bg-red-50' : 'bg-white'
                                }`}
                            >
                                <button
                                    type="button"
                                    className="text-left flex-1"
                                    onClick={() => setSelectedAreaId(area.id)}
                                >
                                    <p className="font-semibold text-gray-900">{area.name}</p>
                                    <p className="text-xs text-gray-500 font-mono">{area.code}</p>
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="p-2 text-gray-500 hover:text-municipal-red"
                                        onClick={() =>
                                            setAreaForm({ id: area.id, name: area.name, code: area.code })
                                        }
                                        title="Edit"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        className="p-2 text-gray-500 hover:text-red-600"
                                        onClick={() => removeArea(area.id)}
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {areas.length === 0 && (
                            <p className="px-4 py-8 text-center text-gray-500 text-sm">No electoral areas yet.</p>
                        )}
                    </div>
                </div>

                <div className="card space-y-4">
                    <h2 className="font-bold text-lg">
                        Communities {selectedArea ? `— ${selectedArea.name}` : ''}
                    </h2>
                    {!selectedAreaId ? (
                        <p className="text-sm text-gray-500">Select an electoral area to manage its communities.</p>
                    ) : (
                        <>
                            <form onSubmit={saveCommunity} className="flex gap-3">
                                <input
                                    className="input-field flex-1"
                                    placeholder="Community name"
                                    value={communityForm.name}
                                    onChange={(e) =>
                                        setCommunityForm({ ...communityForm, name: e.target.value })
                                    }
                                    required
                                />
                                <button type="submit" className="btn-primary flex items-center gap-2 px-4">
                                    {communityForm.id ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    {communityForm.id ? 'Update' : 'Add'}
                                </button>
                            </form>
                            {communityForm.id > 0 && (
                                <button
                                    type="button"
                                    className="text-xs text-gray-500 underline"
                                    onClick={() => setCommunityForm({ id: 0, name: '' })}
                                >
                                    Cancel edit
                                </button>
                            )}
                            <div className="divide-y border rounded-lg overflow-hidden">
                                {communities.map((c) => (
                                    <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-white">
                                        <p className="font-medium text-gray-900">{c.name}</p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="p-2 text-gray-500 hover:text-municipal-red"
                                                onClick={() => setCommunityForm({ id: c.id, name: c.name })}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                className="p-2 text-gray-500 hover:text-red-600"
                                                onClick={() => removeCommunity(c.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {communities.length === 0 && (
                                    <p className="px-4 py-8 text-center text-gray-500 text-sm">
                                        No communities linked to this electoral area yet.
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
