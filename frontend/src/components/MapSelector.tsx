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

interface MapSelectorProps {
    onLocationSelectAction: (lat: number, lng: number) => void;
    initialLat?: number;
    initialLng?: number;
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
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

export default function MapSelector({ onLocationSelectAction, initialLat, initialLng }: MapSelectorProps) {
    const defaultCenter: [number, number] = [5.6037, -0.1870]; // Accra
    const [position, setPosition] = useState<[number, number] | null>(
        initialLat && initialLng ? [initialLat, initialLng] : null
    );
    const [activeLayer, setActiveLayer] = useState(0);

    const center = position || defaultCenter;
    const layer = TILE_LAYERS[activeLayer];

    return (
        <div className="h-[400px] w-full rounded-lg overflow-hidden border border-gray-300 relative z-0">
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
                {initialLat && initialLng && !position && (
                    <ChangeView center={[initialLat, initialLng]} zoom={15} />
                )}
            </MapContainer>
        </div>
    );
}
