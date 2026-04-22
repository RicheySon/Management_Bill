'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Next.js
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
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
        maxZoom: 19,
    },
    {
        name: 'Terrain',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
        maxZoom: 17,
    },
    {
        name: 'Dark',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
];

const SEARCH_API = 'https://nominatim.openstreetmap.org/search?format=json&q=';

interface MapSelectorProps {
    onLocationSelectAction: (lat: number, lng: number) => void;
    initialLat?: number;
    initialLng?: number;
    accuracy?: number;
}

function LocationMarker({ position, setPosition, onLocationSelectAction }: {
    position: [number, number] | null,
    setPosition: (pos: [number, number]) => void,
    onLocationSelectAction: (lat: number, lng: number) => void
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

    return position === null ? null : (
        <Marker position={position} icon={icon} />
    );
}

// Helper to update map view when initial coordinates change
function ChangeView({ center, zoom, accuracy }: { center: [number, number], zoom: number, accuracy?: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
        if (accuracy && accuracy < 2000) {
            // If accuracy is good, zoom in more
            map.setZoom(17);
        }
    }, [center, zoom, accuracy, map]);
    return null;
}

export default function MapSelector({ onLocationSelectAction, initialLat, initialLng, accuracy }: MapSelectorProps) {
    const defaultCenter: [number, number] = [5.6037, -0.1870]; // Accra
    const [position, setPosition] = useState<[number, number] | null>(
        initialLat && initialLng ? [initialLat, initialLng] : null
    );
    const [activeLayer, setActiveLayer] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const center = position || defaultCenter;
    const layer = TILE_LAYERS[activeLayer];

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const response = await fetch(`${SEARCH_API}${encodeURIComponent(searchQuery + ' Ga North Municipal Assembly, Ghana')}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                const newPos: [number, number] = [parseFloat(lat), parseFloat(lon)];
                setPosition(newPos);
                onLocationSelectAction(newPos[0], newPos[1]);
            } else {
                alert('Place not found. Try adding more details.');
            }
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="h-[400px] w-full rounded-lg overflow-hidden border border-gray-300 relative z-0">
            {/* Search Bar */}
            <div className="absolute top-2 left-2 z-[1000] w-64">
                <form onSubmit={handleSearch} className="flex shadow-md">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search community or area..."
                        className="flex-1 px-3 py-2 text-sm rounded-l border-r-0 border-gray-300 focus:ring-0 focus:border-municipal-teal"
                    />
                    <button
                        type="submit"
                        disabled={isSearching}
                        className="bg-municipal-teal text-white px-3 py-2 rounded-r hover:bg-teal-700 disabled:opacity-50"
                    >
                        {isSearching ? '...' : 'Go'}
                    </button>
                </form>
            </div>

            {/* Layer Switcher */}
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

            <MapContainer
                center={center}
                zoom={13}
                scrollWheelZoom={true}
                className="h-full w-full"
            >
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
                {(initialLat && initialLng && !position) || (position) ? (
                    <ChangeView 
                        center={position || [initialLat!, initialLng!]} 
                        zoom={position ? 18 : 15} 
                        accuracy={accuracy}
                    />
                ) : null}
            </MapContainer>
        </div>
    );
}
