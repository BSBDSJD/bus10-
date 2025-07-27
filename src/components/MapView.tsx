import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation } from 'lucide-react';
import MarkerClusterGroup from 'react-leaflet-cluster';

interface Stop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  lines?: string;
  address?: string;
  furniture?: string;
  stopType?: string;
}

interface StopInfo {
  document: {
    id: number;
    name: string;
    address: string;
    furniture: string;
    stopType: string;
    lines: string;
    utmx: number;
    utmy: number;
  };
}

interface MapViewProps {
  onStopSelect: (stopId: string) => void;
}

// Custom cluster icon
const createClusterCustomIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<div class="cluster-icon">${count}</div>`,
    className: 'custom-marker-cluster',
    iconSize: L.point(40, 40, true),
  });
};

// Custom bus stop icon
const busStopIcon = new L.Icon({
  iconUrl: 'https://bus.bdnmedia.cat/tusa/assets/icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [0, -25],
  shadowSize: [35, 35]
});

// User location icon
const userLocationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMzQjgyRjYiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMyIgZmlsbD0id2hpdGUiLz4KPC9zdmc+',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Closest stop icon
const closestStopIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTUiIGZpbGw9IiNGRkJGMDAiIHN0cm9rZT0iI0Y1OTUwRiIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjgiIGZpbGw9IiNGNTk1MEYiLz4KPC9zdmc+',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

function LocationHandler({ userLocation, closestStop }: { userLocation: [number, number] | null, closestStop: Stop | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (userLocation) {
      map.setView(userLocation, 16);
    }
  }, [userLocation, map]);

  useEffect(() => {
    if (closestStop) {
      map.setView([closestStop.stop_lat, closestStop.stop_lon], 17);
    }
  }, [closestStop, map]);

  return null;
}

function MapCenterHandler({ center, zoom }: { center: [number, number] | null, zoom?: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 16);
    }
  }, [center, zoom, map]);

  return null;
}

const MapView: React.FC<MapViewProps> = ({ onStopSelect }) => {
  const [stops, setStops] = useState<Stop[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [closestStop, setClosestStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [loadingStopInfo, setLoadingStopInfo] = useState<Set<string>>(new Set());
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchStops();
    }
  }, [userLocation]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: [number, number] = [
            position.coords.latitude,
            position.coords.longitude
          ];
          setUserLocation(location);
        },
        (error) => {
          console.error('Error getting location:', error);
          // Default to Barcelona center if location fails
          setUserLocation([41.3851, 2.1734]);
        }
      );
    } else {
      // Default to Barcelona center if geolocation not supported
      setUserLocation([41.3851, 2.1734]);
    }
  };

  const fetchStops = async () => {
    try {
      const response = await fetch('https://bdnmedia.cat/transit/tusa/stops.php');
      const text = await response.text();
      const lines = text.split('\n').slice(1); // Skip header
      const stopsData: Stop[] = lines
        .filter(line => line.trim())
        .map(line => {
          const [stop_id, , stop_name, , stop_lat, stop_lon] = line.split(',');
          return {
            stop_id: stop_id?.replace(/"/g, ''),
            stop_name: stop_name?.replace(/"/g, ''),
            stop_lat: parseFloat(stop_lat),
            stop_lon: parseFloat(stop_lon)
          };
        })
        .filter(stop => stop.stop_id && stop.stop_name && !isNaN(stop.stop_lat) && !isNaN(stop.stop_lon));
      
      setStops(stopsData);
      
      // Find closest stop to user
      if (userLocation && stopsData.length > 0) {
        const closest = stopsData.reduce((prev, current) => {
          const prevDistance = getDistance(userLocation, [prev.stop_lat, prev.stop_lon]);
          const currentDistance = getDistance(userLocation, [current.stop_lat, current.stop_lon]);
          return currentDistance < prevDistance ? current : prev;
        });
        setClosestStop(closest);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stops:', error);
      setLoading(false);
    }
  };

  const fetchStopInfo = async (stopId: string): Promise<StopInfo | null> => {
    try {
      setLoadingStopInfo(prev => new Set(prev).add(stopId));
      const response = await fetch(`https://bdnmedia.cat/proxy.php?endpoint=stops/${stopId}`);
      const data = await response.json();
      setLoadingStopInfo(prev => {
        const newSet = new Set(prev);
        newSet.delete(stopId);
        return newSet;
      });
      return data;
    } catch (error) {
      console.error('Error fetching stop info:', error);
      setLoadingStopInfo(prev => {
        const newSet = new Set(prev);
        newSet.delete(stopId);
        return newSet;
      });
      return null;
    }
  };

  const handleStopClick = async (stop: Stop) => {
    const stopInfo = await fetchStopInfo(stop.stop_id);
    if (stopInfo) {
      // Update stop with additional info
      const updatedStop = {
        ...stop,
        lines: stopInfo.document.lines,
        address: stopInfo.document.address,
        furniture: stopInfo.document.furniture,
        stopType: stopInfo.document.stopType
      };
      
      // Update stops array
      setStops(prevStops => 
        prevStops.map(s => s.stop_id === stop.stop_id ? updatedStop : s)
      );
    }
    
    // Center map on selected stop
    setMapCenter([stop.stop_lat, stop.stop_lon]);
    
    // Call the parent callback
    onStopSelect(stop.stop_id);
  };

  const renderLines = (lines: string) => {
    if (!lines) return null;
    const lineArray = lines.split(' - ');
    
    return lineArray.map((line, index) => {
      const isNightBus = line.startsWith('N');
      const color = isNightBus ? 'bg-blue-800 text-white' : 'bg-yellow-400 text-black';
      return (
        <span
          key={index}
          className={`${color} px-1 py-0.5 rounded text-xs font-semibold mr-1 inline-block`}
        >
          {line}
        </span>
      );
    });
  };

  const getDistance = (pos1: [number, number], pos2: [number, number]) => {
    const R = 6371; // Earth's radius in km
    const dLat = (pos2[0] - pos1[0]) * Math.PI / 180;
    const dLon = (pos2[1] - pos1[1]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(pos1[0] * Math.PI / 180) * Math.cos(pos2[0] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  if (loading || !userLocation) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={24} className="text-yellow-400" />
          <h2 className="text-2xl font-bold">Mapa de parades</h2>
        </div>
        <div className="h-[400px] flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <Navigation className="animate-spin mx-auto mb-2" size={32} />
            <p>Obtenint la teva ubicació...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        .custom-marker-cluster {
          background: rgba(255, 191, 0, 0.9);
          border: 2px solid #F59E0B;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cluster-icon {
          color: black;
          font-weight: bold;
          font-size: 14px;
        }
      `}</style>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={24} className="text-yellow-400" />
          <h2 className="text-2xl font-bold">Mapa de parades</h2>
        </div>
        <div className="h-[400px] w-full rounded-lg overflow-hidden">
          <MapContainer
            center={userLocation}
            zoom={16}
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <LocationHandler userLocation={userLocation} closestStop={closestStop} />
            <MapCenterHandler center={mapCenter} zoom={17} />
            
            {/* User location marker */}
            <Marker position={userLocation} icon={userLocationIcon}>
              <Popup>
                <div className="text-center">
                  <strong>La teva ubicació</strong>
                </div>
              </Popup>
            </Marker>

            {/* Clustered bus stop markers */}
            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createClusterCustomIcon}
              maxClusterRadius={50}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
            >
              {stops.map((stop) => (
                <Marker
                  key={stop.stop_id}
                  position={[stop.stop_lat, stop.stop_lon]}
                  icon={closestStop?.stop_id === stop.stop_id ? closestStopIcon : busStopIcon}
                >
                  <Popup>
                    <div className="text-center">
                      <strong>{stop.stop_name}</strong>
                      <br />
                      
                      {stop.address && (
                        <div className="text-xs text-gray-500 mb-2">{stop.address}</div>
                      )}
                      
                      {stop.furniture && stop.stopType && (
                        <div className="text-xs text-gray-500 mb-2">
                          {stop.furniture} | {stop.stopType}
                        </div>
                      )}
                      
                      {stop.lines && (
                        <div className="mb-2">
                          {renderLines(stop.lines)}
                        </div>
                      )}
                      
                      <span className="text-sm text-gray-600">ID: {stop.stop_id}</span>
                      <br />
                      {closestStop?.stop_id === stop.stop_id && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                          Més propera
                        </span>
                      )}
                      
                      {loadingStopInfo.has(stop.stop_id) ? (
                        <div className="text-xs text-gray-500 mb-2">Carregant informació...</div>
                      ) : null}
                      
                      <button
                        onClick={() => handleStopClick(stop)}
                        className="mt-2 bg-yellow-400 text-black px-3 py-1 rounded text-sm hover:bg-yellow-500"
                        disabled={loadingStopInfo.has(stop.stop_id)}
                      >
                        {loadingStopInfo.has(stop.stop_id) ? 'Carregant...' : 'Veure horaris'}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>
    </>
  );
};

export default MapView;