import React, { useState, useEffect, useRef } from 'react';
import { Search, Bus, Clock, Info, RotateCw, Star, StarOff, MapPin, Plus, MinusSquare, AlertCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from "framer-motion";
import Modal from './Modal';

// Create custom icon for the bus stop marker
const busStopIcon = new L.Icon({
  iconUrl: 'https://bus.bdnmedia.cat/tusa/assets/icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  shadowSize: [41, 41]
});

interface Stop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
}

interface TMBStop {
  codi_parada: string;
  nom_parada: string;
  linies_trajectes: Array<{
    codi_linia: string;
    nom_linia: string;
    desti_trajecte: string;
    propers_busos: Array<{
      temps_arribada: number;
      id_bus: number;
    }>;
  }>;
}

interface BusTime {
  time: number;
  destination: string;
  routeId: string;
  arrivalTime: number;
  lineCode: string;
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

interface FavoriteStop {
  id: string;
  name: string;
  lines: string;
}

interface GroupedBusTime {
  lineCode: string;
  times: number[];
  destination: string;
  isExpanded?: boolean;
}

interface NotFoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchTerm: string;
}

const NotFoundModal: React.FC<NotFoundModalProps> = ({ isOpen, onClose, searchTerm }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Parada no trobada">
      <div className="text-center space-y-4">
        <div className="text-6xl">🚌</div>
        <div className="text-4xl">😅</div>
        <h3 className="text-xl font-bold">Ups! No hem trobat aquesta parada</h3>
        <p className="text-gray-600">
          La parada "{searchTerm}" no existeix o no està disponible al nostre sistema.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertCircle size={20} />
            <span className="font-semibold">Consells:</span>
          </div>
          <ul className="text-sm text-yellow-700 mt-2 space-y-1">
            <li>• Comprova que l'ID de la parada sigui correcte</li>
            <li>• Prova a buscar per nom de la parada</li>
            <li>• Utilitza el mapa per trobar parades properes</li>
          </ul>
        </div>
        <div className="text-2xl">🚏➡️🗺️</div>
      </div>
    </Modal>
  );
};

function RecenterMap({ coords }: { coords: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(coords, 16);
  }, [coords, map]);
  return null;
}

interface CercaIDProps {
  favoriteStops: FavoriteStop[];
  setFavoriteStops: React.Dispatch<React.SetStateAction<FavoriteStop[]>>;
  showFavorites: boolean;
  setShowFavorites: React.Dispatch<React.SetStateAction<boolean>>;
  selectedStopFromMap?: string;
}

const CercaID: React.FC<CercaIDProps> = ({ 
  favoriteStops, 
  setFavoriteStops, 
  showFavorites, 
  setShowFavorites,
  selectedStopFromMap
}) => {
  const [stopId, setStopId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Stop[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [busTimes, setBusTimes] = useState<BusTime[]>([]);
  const [stopInfo, setStopInfo] = useState<StopInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>('');
  const [groupedBusTimes, setGroupedBusTimes] = useState<GroupedBusTime[]>([]);
  const [isFirstSearch, setIsFirstSearch] = useState(true);
  const [showNotFound, setShowNotFound] = useState(false);
  const [notFoundTerm, setNotFoundTerm] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const stopInfoRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Load all stops on component mount
  useEffect(() => {
    fetchAllStops();
  }, []);

  // Handle stop selection from map
  useEffect(() => {
    if (selectedStopFromMap) {
      const stop = allStops.find(s => s.stop_id === selectedStopFromMap);
      if (stop) {
        setStopId(selectedStopFromMap);
        setSearchTerm(stop.stop_name);
        fetchBusTimes(true);
        fetchStopInfo();
      }
    }
  }, [selectedStopFromMap, allStops]);

  const fetchAllStops = async () => {
    try {
      const response = await fetch('https://bdnmedia.cat/transit/tusa/stops.php');
      const text = await response.text();
      const lines = text.split('\n').slice(1); // Skip header
      const stops: Stop[] = lines
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
        .filter(stop => stop.stop_id && stop.stop_name);
      setAllStops(stops);
    } catch (error) {
      console.error('Error fetching stops:', error);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value.length > 2) {
      const filtered = allStops.filter(stop =>
        stop.stop_name.toLowerCase().includes(value.toLowerCase()) ||
        stop.stop_id.includes(value)
      ).slice(0, 10);
      setSearchResults(filtered);
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  };

  const selectStop = (stop: Stop) => {
    setStopId(stop.stop_id);
    setSearchTerm(stop.stop_name);
    setShowSearchResults(false);
    
    // Automatically fetch data and scroll
    fetchBusTimes(true);
    fetchStopInfo();
    
    // Center map on selected stop
    setMapCenter([stop.stop_lat, stop.stop_lon]);
    
    // Scroll to results
    setTimeout(() => {
      scrollToStopInfo();
    }, 100);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lastUpdate) {
      interval = setInterval(() => {
        const diff = new Date().getTime() - lastUpdate.getTime();
        const seconds = Math.floor(diff / 1000);
        setTimeSinceUpdate(`${seconds}`);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lastUpdate]);

  useEffect(() => {
    if (busTimes.length > 0) {
      const grouped = busTimes.reduce((acc: GroupedBusTime[], curr) => {
        const existing = acc.find(g => g.lineCode === curr.lineCode);
        if (existing) {
          existing.times.push(curr.arrivalTime);
          existing.times.sort((a, b) => a - b);
        } else {
          acc.push({
            lineCode: curr.lineCode,
            times: [curr.arrivalTime],
            destination: curr.destination,
            isExpanded: false
          });
        }
        return acc;
      }, []);

      grouped.sort((a, b) => {
        const aMinTime = Math.min(...a.times);
        const bMinTime = Math.min(...b.times);
        return aMinTime - bMinTime;
      });

      setGroupedBusTimes(grouped);
    }
  }, [busTimes]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (stopId) {
      interval = setInterval(() => {
        fetchBusTimes();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [stopId]);

  const scrollToStopInfo = () => {
    stopInfoRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchBusTimes = async (isInitialSearch = false) => {
    if (!stopId) return;
    setLoading(true);
    try {
      if (stopId.length === 4) {
        // TMB API for 4-digit stops
        const response = await fetch(`https://bdnmedia.cat/tmbapi.php?path=itransit/bus/parades/${stopId}`);
        const data = await response.json();
        
        if (data.parades && data.parades.length > 0) {
          const parada = data.parades[0];
          const times: BusTime[] = [];
          
          parada.linies_trajectes.forEach((linia: any) => {
            linia.propers_busos.forEach((bus: any) => {
              const arrivalTime = Math.floor((bus.temps_arribada - Date.now()) / 1000 / 60);
              times.push({
                time: arrivalTime,
                destination: linia.desti_trajecte,
                routeId: linia.codi_linia,
                arrivalTime: arrivalTime,
                lineCode: linia.nom_linia
              });
            });
          });
          
          setBusTimes(times);
          setLastUpdate(new Date());
          setTimeSinceUpdate('0');
        } else {
          setNotFoundTerm(stopId);
          setShowNotFound(true);
        }
      } else {
        // Original API for 6-digit stops
        const response = await fetch(`https://bdnmedia.cat/proxy.php?endpoint=stops/${stopId}/realtimes`);
        const data = await response.json();
        
        if (data.times) {
          setBusTimes(data.times);
          setLastUpdate(new Date());
          setTimeSinceUpdate('0');
        } else {
          setNotFoundTerm(stopId);
          setShowNotFound(true);
        }
      }
      
      if (isInitialSearch && isFirstSearch) {
        setTimeout(scrollToStopInfo, 100);
        setIsFirstSearch(false);
      }
    } catch (error) {
      console.error('Error fetching bus times:', error);
      setNotFoundTerm(stopId);
      setShowNotFound(true);
    }
    setLoading(false);
  };

  const fetchStopInfo = async () => {
    if (!stopId) return;
    try {
      if (stopId.length === 4) {
        // For TMB stops, create mock stop info
        const stop = allStops.find(s => s.stop_id === stopId);
        if (stop) {
          setStopInfo({
            document: {
              id: parseInt(stopId),
              name: stop.stop_name,
              address: stop.stop_name,
              furniture: 'TMB',
              stopType: 'TMB',
              lines: 'TMB Lines',
              utmx: stop.stop_lat,
              utmy: stop.stop_lon
            }
          });
        }
      } else {
        const response = await fetch(`https://bdnmedia.cat/proxy.php?endpoint=stops/${stopId}/`);
        const data = await response.json();
        setStopInfo(data);
      }
    } catch (error) {
      console.error('Error fetching stop info:', error);
    }
  };

  const toggleFavorite = () => {
    if (!stopInfo) return;
    
    const newFavorites = favoriteStops.some(stop => stop.id === stopId)
      ? favoriteStops.filter(stop => stop.id !== stopId)
      : [...favoriteStops, {
          id: stopId,
          name: stopInfo.document.name,
          lines: stopInfo.document.lines
        }];
    
    setFavoriteStops(newFavorites);
    localStorage.setItem('favoriteStops', JSON.stringify(newFavorites));
  };

  const loadFavoriteStop = (stopId: string) => {
    setStopId(stopId);
    const stop = allStops.find(s => s.stop_id === stopId);
    setSearchTerm(stop ? stop.stop_name : stopId);
    
    // Automatically fetch data and scroll
    fetchBusTimes(true);
    fetchStopInfo();
    
    // Center map on selected stop if found
    if (stop) {
      setMapCenter([stop.stop_lat, stop.stop_lon]);
    }
    
    // Scroll to results
    setTimeout(() => {
      scrollToStopInfo();
    }, 100);
  };

  const getLineColor = (lineCode: string) => {
    const firstChar = lineCode.charAt(0);
    switch (firstChar) {
      case 'V': return 'bg-green-600 text-white';
      case 'D': return 'bg-purple-600 text-white';
      case 'H': return 'bg-indigo-600 text-white';
      case 'M': return 'bg-yellow-400 text-black';
      case 'B': return 'bg-yellow-400 text-black';
      case 'N': return 'bg-blue-800 text-white';
      default: return 'bg-red-600 text-white';
    }
  };

  const formatArrivalTime = (minutes: number) => {
    if (minutes < 1) return { text: 'Imminent', isUrgent: true };
    if (minutes === 1) return { text: '1 min', isUrgent: true };
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return {
        text: `${hours}h ${remainingMinutes > 0 ? `${remainingMinutes}min` : ''}`,
        isUrgent: false
      };
    }
    return { text: `${minutes} min`, isUrgent: false };
  };

  const sortLines = (lines: string[]): string[] => {
    return lines.sort((a, b) => {
      const aIsNight = a.startsWith('N');
      const bIsNight = b.startsWith('N');
      
      if (aIsNight && !bIsNight) return 1;
      if (!aIsNight && bIsNight) return -1;
      
      const aNum = parseInt(a.replace(/[^0-9]/g, ''));
      const bNum = parseInt(b.replace(/[^0-9]/g, ''));
      return aNum - bNum;
    });
  };

  const renderLines = (lines: string) => {
    const lineArray = lines.split(' - ');
    const sortedLines = sortLines(lineArray);
    
    return sortedLines.map((line, index) => {
      const isNightBus = line.startsWith('N');
      const color = isNightBus ? 'bg-blue-800 text-white' : 'bg-yellow-400 text-black';
      return (
        <span
          key={index}
          className={`${color} px-2 py-1 rounded-md text-sm font-semibold mr-2 inline-block`}
        >
          {line}
        </span>
      );
    });
  };

  return (
    <>
      {favoriteStops.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Parades Favorites</h2>
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className="text-gray-600 hover:text-gray-800"
            >
              {showFavorites ? <MinusSquare size={24} /> : <Plus size={24} />}
            </button>
          </div>
          <AnimatePresence>
            {showFavorites && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              >
                {favoriteStops.map((stop) => (
                  <motion.button
                    key={stop.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => loadFavoriteStop(stop.id)}
                    className="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow text-left"
                  >
                    <div className="font-semibold mb-1">{stop.name}</div>
                    <div className="text-sm text-gray-500 mb-2">ID: {stop.id}</div>
                    <div className="flex flex-wrap gap-1">
                      {renderLines(stop.lines)}
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <NotFoundModal
        isOpen={showNotFound}
        onClose={() => setShowNotFound(false)}
        searchTerm={notFoundTerm}
      />
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-4 text-center">Cerca la teva parada</h2>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col sm:flex-row gap-4 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Introdueix l'ID o nom de la parada"
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 border-yellow-400"
            />
            {showSearchResults && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                {searchResults.map((stop) => (
                  <button
                    key={stop.stop_id}
                    onClick={() => selectStop(stop)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b last:border-b-0"
                  >
                    <div className="font-semibold">{stop.stop_name}</div>
                    <div className="text-sm text-gray-500">ID: {stop.stop_id}</div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                if (!stopId && searchTerm) {
                  const exactMatch = allStops.find(s => 
                    s.stop_name.toLowerCase() === searchTerm.toLowerCase() ||
                    s.stop_id === searchTerm
                  );
                  if (exactMatch) {
                    setStopId(exactMatch.stop_id);
                    // Center map on found stop
                    setMapCenter([exactMatch.stop_lat, exactMatch.stop_lon]);
                  } else {
                    setStopId(searchTerm);
                  }
                  fetchBusTimes(true);
                  fetchStopInfo();
                  
                  // Scroll to results after search
                  setTimeout(() => {
                    scrollToStopInfo();
                  }, 100);
                } else if (stopId) {
                  fetchBusTimes(true);
                  fetchStopInfo();
                  
                  // Scroll to results after search
                  setTimeout(() => {
                    scrollToStopInfo();
                  }, 100);
                }
              }}
              disabled={loading}
              className="w-full sm:w-auto bg-yellow-400 text-black px-6 py-2 rounded-lg hover:bg-yellow-500 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <RotateCw className="animate-spin" size={20} />
              ) : (
                <Search size={20} />
              )}
              {loading ? 'Actualitzant...' : 'Cercar'}
            </button>
          </div>
        </div>
      </div>

      {stopInfo && (
        <>
          <div ref={stopInfoRef} className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-start gap-4">
              <Info size={24} className="text-yellow-400 mt-1 flex-shrink-0" />
              <div className="flex-grow">
                <div className="flex items-start justify-between">
                  <h2 className="text-2xl font-bold mb-2">{stopInfo.document.name}</h2>
                  <button
                    onClick={toggleFavorite}
                    className="text-yellow-500 hover:text-yellow-600 flex-shrink-0"
                    title={favoriteStops.some(stop => stop.id === stopId) ? "Eliminar dels favorits" : "Afegir als favorits"}
                  >
                    {favoriteStops.some(stop => stop.id === stopId) ? (
                      <Star size={24} fill="currentColor" />
                    ) : (
                      <StarOff size={24} />
                    )}
                  </button>
                </div>
                <p className="text-gray-600 mb-4">{stopInfo.document.address}</p>
                <div className="mb-4">
                  <p className="text-sm text-gray-500">
                    Mobiliari: {stopInfo.document.furniture} | Tipus: {stopInfo.document.stopType}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {renderLines(stopInfo.document.lines)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bus size={24} className="text-yellow-400" />
                <h2 className="text-2xl font-bold">Pròximes arribades</h2>
              </div>
              <div className="flex items-center gap-4">
                {lastUpdate && (
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    <Clock size={14} />
                    {timeSinceUpdate} seg
                  </span>
                )}
                <button
                  onClick={() => fetchBusTimes(false)}
                  disabled={loading}
                  className="text-yellow-400 hover:text-yellow-500"
                  title="Actualitzar temps"
                >
                  <RotateCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {groupedBusTimes.map((group, index) => {
                const isNightBus = group.lineCode.startsWith('N');
                const formattedTimes = group.times.map(time => {
                  const minutes = Math.floor(time / 60);
                  return formatArrivalTime(minutes);
                });
                
                return (
                  <div key={index} className="border-b pb-4 last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span
                          className={`${
                            getLineColor(group.lineCode)
                          } px-3 py-1 rounded-md font-semibold`}
                        >
                          {group.lineCode}
                        </span>
                        <span className="text-gray-600">{group.destination}</span>
                      </div>
                      <div className="flex items-center">
                        <span className={formattedTimes[0].isUrgent ? 'text-red-500 font-bold' : 'text-gray-900'}>
                          {formattedTimes[0].text}
                        </span>
                        {formattedTimes.length > 1 && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              const updatedGroups = [...groupedBusTimes];
                              updatedGroups[index].isExpanded = !updatedGroups[index].isExpanded;
                              setGroupedBusTimes(updatedGroups);
                            }}
                            className="ml-2 text-yellow-400 hover:text-yellow-500 transition-colors"
                          >
                            {group.isExpanded ? <MinusSquare size={20} /> : <Plus size={20} />}
                          </motion.button>
                        )}
                      </div>
                    </div>
                    <AnimatePresence>
                      {group.isExpanded && formattedTimes.length > 1 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-2 flex justify-end"
                        >
                          <div className="space-y-1">
                            {formattedTimes.slice(1).map((time, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className={`text-sm ${time.isUrgent ? 'text-red-500 font-bold' : 'text-gray-900'}`}
                              >
                                {time.text}
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={24} className="text-yellow-400" />
              <h2 className="text-2xl font-bold">Ubicació de la parada</h2>
            </div>
            <div className="h-[200px] md:h-[300px] w-full rounded-lg overflow-hidden">
              <MapContainer
                center={[stopInfo.document.utmx, stopInfo.document.utmy]}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                ref={mapRef}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker
                  position={[stopInfo.document.utmx, stopInfo.document.utmy]}
                  icon={busStopIcon}
                >
                  <Popup className="text-xs">
                    <div className="font-semibold">{stopInfo.document.name}</div>
                    <div className="text-gray-600">{stopInfo.document.address}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {renderLines(stopInfo.document.lines)}
                    </div>
                  </Popup>
                </Marker>
                <RecenterMap coords={[stopInfo.document.utmx, stopInfo.document.utmy]} />
                {mapCenter && (
                  <RecenterMap coords={mapCenter} />
                )}
              </MapContainer>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default CercaID;