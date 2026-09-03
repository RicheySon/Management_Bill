'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { searchPlaces } from '@/lib/api-client';

const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

type TileLayerOption = {
    name: string;
    url: string;
    attribution: string;
    maxZoom?: number;
};

const TILE_LAYERS: TileLayerOption[] = [
    {
        name: 'Street',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    {
        name: 'Satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19,
    },
    {
        name: 'Terrain',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: 'Map style: &copy; OpenTopoMap',
        maxZoom: 17,
    },
];

interface MapSelectorProps {
    onLocationSelectAction: (lat: number, lng: number) => void;
    initialLat?: number;
    initialLng?: number;
    accuracy?: number;
}

function LocationMarker({
    position,
    setPosition,
    onLocationSelectAction,
}: {
    position: [number, number] | null;
    setPosition: (pos: [number, number]) => void;
    onLocationSelectAction: (lat: number, lng: number) => void;
}) {
    const map = useMap();

    useMapEvents({
        click(e) {
            const newPos: [number, number] = [e.latlng.lat, e.latlng.lng];
            setPosition(newPos);
            onLocationSelectAction(e.latlng.lat, e.latlng.lng);
            map.flyTo(e.latlng, map.getZoom());
        },
    });

    return position === null ? null : <Marker position={position} icon={icon} />;
}

function ChangeView({
    center,
    zoom,
    accuracy,
}: {
    center: [number, number];
    zoom: number;
    accuracy?: number;
}) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, accuracy && accuracy < 2000 ? 17 : zoom);
    }, [center, zoom, accuracy, map]);
    return null;
}

export default function MapSelector({
    onLocationSelectAction,
    initialLat,
    initialLng,
    accuracy,
}: MapSelectorProps) {
    const defaultCenter: [number, number] = [5.68, -0.27]; // Ga North
    const [position, setPosition] = useState<[number, number] | null>(
        initialLat && initialLng ? [initialLat, initialLng] : null
    );
    const [activeLayer, setActiveLayer] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<any[]>([]);

    const center = position || defaultCenter;
    const layer = TILE_LAYERS[activeLayer];

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const data = await searchPlaces(searchQuery.trim());
            setResults(data);
            if (data.length === 1) {
                const { lat, lon } = data[0];
                const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
                setPosition(newPos);
                onLocationSelectAction(newPos[0], newPos[1]);
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
        const newPos: [number, number] = [parseFloat(item.lat), parseFloat(item.lon)];
        setPosition(newPos);
        onLocationSelectAction(newPos[0], newPos[1]);
        setResults([]);
        setSearchQuery(item.display_name?.split(',')[0] || searchQuery);
    };

    return (
        <div className="h-[400px] w-full rounded-lg overflow-hidden border border-gray-300 relative z-0">
            <div className="absolute top-2 left-2 z-[1000] w-72">
                <form onSubmit={handleSearch} className="flex shadow-md">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search Ga North community…"
                        className="flex-1 px-3 py-2 text-sm rounded-l border-r-0 border-gray-300 focus:ring-0 focus:border-municipal-teal"
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
                                key={`${item.place_id}`}
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
                {TILE_LAYERS.map((tl, i) => (
                    <button
                        key={tl.name}
                        type="button"
                        onClick={() => setActiveLayer(i)}
                        className={`px-2 py-1 text-[11px] font-bold rounded shadow-md transition-all border ${
                            activeLayer === i
                                ? 'bg-municipal-red text-white border-red-700'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        {tl.name}
                    </button>
                ))}
            </div>

            <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full">
                <TileLayer
                    key={layer.url}
                    attribution={layer.attribution}
                    url={layer.url}
                    maxZoom={layer.maxZoom ?? 19}
                />
                <LocationMarker
                    position={position}
                    setPosition={setPosition}
                    onLocationSelectAction={onLocationSelectAction}
                />
                <ChangeView center={center} zoom={13} accuracy={accuracy} />
            </MapContainer>
        </div>
    );
}
