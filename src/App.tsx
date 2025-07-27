import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Incidencies from './components/Incidencies';
import CercaID from './components/CercaID';
import MapView from './components/MapView';
import Footer from './components/Footer';

interface FavoriteStop {
  id: string;
  name: string;
  lines: string;
}

function App() {
  const [favoriteStops, setFavoriteStops] = useState<FavoriteStop[]>([]);
  const [showFavorites, setShowFavorites] = useState(true);
  const [selectedStopFromMap, setSelectedStopFromMap] = useState<string>('');

  const headerImages = [
    'https://bus.bdnmedia.cat/wp-content/uploads/2024/06/M6_anis_del_mono-scaled.jpg',
    'https://bus.bdnmedia.cat/wp-content/uploads/2024/06/B12_can_ruti-scaled.jpg',
    'https://bus.bdnmedia.cat/wp-content/uploads/2024/06/arc_de_triomf-scaled.jpg'
  ];

  useEffect(() => {
    const savedFavorites = localStorage.getItem('favoriteStops');
    if (savedFavorites) {
      setFavoriteStops(JSON.parse(savedFavorites));
    }
  }, []);

  const handleStopSelectFromMap = (stopId: string) => {
    setSelectedStopFromMap(stopId);
    // Scroll to the search section
    const searchSection = document.getElementById('search-section');
    if (searchSection) {
      searchSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header headerImages={headerImages} />

      <main className="container mx-auto px-4 py-8">
        <Incidencies />
        
        <MapView onStopSelect={handleStopSelectFromMap} />
        
        <div id="search-section">
        <CercaID 
          favoriteStops={favoriteStops}
          setFavoriteStops={setFavoriteStops}
          showFavorites={showFavorites}
          setShowFavorites={setShowFavorites}
          selectedStopFromMap={selectedStopFromMap}
        />
        </div>
      </main>

      <Footer headerImages={headerImages} />
    </div>
  );
}

export default App;