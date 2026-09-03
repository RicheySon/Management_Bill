'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { searchPlaces } from '@/lib/api-client';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

const STYLES = [
    { name: 'Street', url: 'mapbox://styles/mapbox/streets-v12' },
    { name: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
    { name: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
];

const GA_NORTH_CENTER: [number, number] = [-0.27, 5.68]; // lng, lat
const GA_NORTH_BOUNDS: [[number, number], [number, number]] = [
    [-0.38, 5.52],
    [-0.12, 5.78],
];

interface MapSelectorProps {
    onLocationSelectAction: (lat: number, lng: number) => void;
    initialLat?: number;
    initialLng?: number;
    accuracy?: number;
}

export default function MapSelector({
    onLocationSelectAction,
    initialLat,
    initialLng,
    accuracy,
}: MapSelectorProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markerRef = useRef<mapboxgl.Marker | null>(null);
    const onSelectRef = useRef(onLocationSelectAction);

    const [styleIndex, setStyleIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [mapError, setMapError] = useState<string | null>(null);

    useEffect(() => {
        onSelectRef.current = onLocationSelectAction;
    }, [onLocationSelectAction]);

    const placeMarker = (lng: number, lat: number, notify = true) => {
        if (!mapRef.current) return;
        if (!markerRef.current) {
            markerRef.current = new mapboxgl.Marker({ color: '#C8102E', draggable: true })
                .setLngLat([lng, lat])
                .addTo(mapRef.current);
            markerRef.current.on('dragend', () => {
                const pos = markerRef.current?.getLngLat();
                if (pos) onSelectRef.current(pos.lat, pos.lng);
            });
        } else {
            markerRef.current.setLngLat([lng, lat]);
        }
        if (notify) onSelectRef.current(lat, lng);
    };

    useEffect(() => {
        if (!MAPBOX_TOKEN) {
            setMapError(
                'Mapbox token missing. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in Vercel / .env.local'
            );
            return;
        }
        if (!mapContainerRef.current || mapRef.current) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

        try {
            const hasInitial = typeof initialLat === 'number' && typeof initialLng === 'number';
            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: STYLES[0].url,
                center: hasInitial ? [initialLng!, initialLat!] : GA_NORTH_CENTER,
                zoom: hasInitial ? 16 : 12,
                maxBounds: GA_NORTH_BOUNDS,
                attributionControl: true,
            });

            map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'bottom-right');
            map.addControl(
                new mapboxgl.GeolocateControl({
                    positionOptions: { enableHighAccuracy: true },
                    trackUserLocation: false,
                    showAccuracyCircle: true,
                }),
                'bottom-right'
            );

            map.on('click', (e) => {
                placeMarker(e.lngLat.lng, e.lngLat.lat, true);
            });

            map.on('load', () => {
                if (hasInitial) {
                    placeMarker(initialLng!, initialLat!, false);
                }
                if (accuracy && accuracy < 2000 && hasInitial) {
                    map.easeTo({ center: [initialLng!, initialLat!], zoom: 17 });
                }
            });

            map.on('error', (e) => {
                console.error('Mapbox error', e.error);
                setMapError(e.error?.message || 'Mapbox failed to load. Check the access token.');
            });

            mapRef.current = map;
        } catch (err: any) {
            console.error(err);
            setMapError(err?.message || 'Failed to initialize Mapbox');
        }

        return () => {
            markerRef.current?.remove();
            markerRef.current = null;
            mapRef.current?.remove();
            mapRef.current = null;
        };
        // intentionally mount once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!mapRef.current || !MAPBOX_TOKEN) return;
        mapRef.current.setStyle(STYLES[styleIndex].url);
        // Re-add marker after style reload
        mapRef.current.once('style.load', () => {
            const pos = markerRef.current?.getLngLat();
            if (pos) placeMarker(pos.lng, pos.lat, false);
        });
    }, [styleIndex]);

    useEffect(() => {
        if (
            !mapRef.current ||
            typeof initialLat !== 'number' ||
            typeof initialLng !== 'number' ||
            Number.isNaN(initialLat) ||
            Number.isNaN(initialLng)
        ) {
            return;
        }
        placeMarker(initialLng, initialLat, false);
        mapRef.current.easeTo({
            center: [initialLng, initialLat],
            zoom: accuracy && accuracy < 2000 ? 17 : Math.max(mapRef.current.getZoom(), 15),
        });
    }, [initialLat, initialLng, accuracy]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const data = await searchPlaces(searchQuery.trim());
            setResults(data);
            if (data.length === 1) {
                pickResult(data[0]);
            } else if (data.length === 0) {
                alert('Place not found in Ga North. Try a nearby community name.');
            }
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setIsSearching(false);
        }
    };

    const pickResult = (item: any) => {
        const lat = parseFloat(item.lat ?? item.center?.[1]);
        const lng = parseFloat(item.lon ?? item.center?.[0]);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return;
        placeMarker(lng, lat, true);
        mapRef.current?.easeTo({ center: [lng, lat], zoom: 16 });
        setResults([]);
        setSearchQuery(item.display_name?.split(',')[0] || item.text || searchQuery);
    };

    if (mapError) {
        return (
            <div className="h-[400px] w-full rounded-lg border border-amber-300 bg-amber-50 p-6 flex flex-col justify-center gap-2">
                <p className="font-semibold text-amber-900">Mapbox map unavailable</p>
                <p className="text-sm text-amber-800">{mapError}</p>
                <p className="text-xs text-amber-700">
                    Create a token at mapbox.com, then set <code className="font-mono">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> and redeploy.
                </p>
            </div>
        );
    }

    return (
        <div className="h-[400px] w-full rounded-lg overflow-hidden border border-gray-300 relative z-0">
            <div className="absolute top-2 left-2 z-[1000] w-72">
                <form onSubmit={handleSearch} className="flex shadow-md">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search Ga North with Mapbox…"
                        className="flex-1 px-3 py-2 text-sm rounded-l border-r-0 border-gray-300 focus:ring-0 focus:border-municipal-teal bg-white"
                    />
                    <button
                        type="submit"
                        disabled={isSearching}
                        className="bg-municipal-teal text-white px-3 py-2 rounded-r hover:bg-teal-700 disabled:opacity-50"
                    >
                        {isSearching ? '…' : 'Go'}
                    </button>
                </form>
                {results.length > 1 && (
                    <div className="mt-1 max-h-40 overflow-y-auto bg-white rounded shadow border text-sm">
                        {results.map((item) => (
                            <button
                                key={`${item.id || item.place_id || item.display_name}`}
                                type="button"
                                onClick={() => pickResult(item)}
                                className="block w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0"
                            >
                                {item.display_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="absolute top-2 right-2 z-[1000] flex gap-1 flex-wrap justify-end">
                {STYLES.map((style, i) => (
                    <button
                        key={style.name}
                        type="button"
                        onClick={() => setStyleIndex(i)}
                        className={`px-2 py-1 text-[11px] font-bold rounded shadow-md transition-all border ${
                            styleIndex === i
                                ? 'bg-municipal-red text-white border-red-700'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        {style.name}
                    </button>
                ))}
            </div>

            <div ref={mapContainerRef} className="h-full w-full" />
            <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 text-[10px] px-2 py-1 rounded shadow text-gray-600">
                Click map or drag pin · Powered by Mapbox
            </div>
        </div>
    );
}
