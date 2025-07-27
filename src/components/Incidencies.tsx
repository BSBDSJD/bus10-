import React, { useState, useEffect } from 'react';
import { AlertTriangle, Plus, MinusSquare } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import Lightbox from "yet-another-react-lightbox";
import Modal from './Modal';

interface Disruption {
  date: string;
  description: string;
  affectedStops: string;
  highlined: boolean;
  affectedCities: string;
  affectedLines: string;
  title: string;
  id: number;
  image?: string;
  expandedDetail?: boolean;
}

const Incidencies: React.FC = () => {
  const [showDisruptions, setShowDisruptions] = useState(false);
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [showOldDisruptions, setShowOldDisruptions] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDisruption, setSelectedDisruption] = useState<Disruption | null>(null);

  useEffect(() => {
    fetchDisruptions();
  }, []);

  const fetchDisruptions = async () => {
    try {
      const response = await fetch('https://bdnmedia.cat/proxy.php?endpoint=disruptions');
      const data = await response.json();
      if (data._embedded && Array.isArray(data._embedded.disruptions)) {
        const badalonaDisruptions = data._embedded.disruptions
          .filter((d: Disruption) => d.affectedCities.includes('Badalona'))
          .map((d: Disruption) => ({
            ...d,
            expandedDetail: false,
            image: d.highlined ? 'https://bus.bdnmedia.cat/wp-content/uploads/2024/06/disruption.jpg' : undefined
          }))
          .sort((a: Disruption, b: Disruption) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setDisruptions(badalonaDisruptions);
      }
    } catch (error) {
      console.error('Error fetching disruptions:', error);
    }
  };

  const openDisruptionModal = (disruption: Disruption) => {
    setSelectedDisruption(disruption);
  };

  const renderDisruptions = () => {
    if (!disruptions.length) {
      return (
        <div className="text-center text-gray-500 py-4">
          No hi ha incidències actualment
        </div>
      );
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const currentDisruptions = disruptions.filter(d => new Date(d.date) > thirtyDaysAgo);
    const oldDisruptions = disruptions.filter(d => new Date(d.date) <= thirtyDaysAgo);

    return (
      <AnimatePresence>
        {showDisruptions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentDisruptions.map((disruption) => (
                <motion.div
                  key={disruption.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="text-yellow-500 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-bold text-lg mb-2">{disruption.title || 'Sense títol'}</h3>
                        <p className="text-sm text-gray-500 mb-2">
                          {new Date(disruption.date).toLocaleDateString('ca-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <div className="mb-2">
                          {disruption.affectedLines?.split('Línies: ')[1]?.split(', ').map((line) => (
                            line && (
                              <span
                                key={line}
                                className={`inline-block px-2 py-1 rounded-md text-sm font-semibold mr-2 mb-2 ${
                                  line.trim().startsWith('N') ? 'bg-blue-800 text-white' : 'bg-yellow-400 text-black'
                                }`}
                              >
                                {line.trim()}
                              </span>
                            )
                          ))}
                        </div>
                        {disruption.description && (
                          <div className="prose prose-sm max-w-none mb-2">
                            <div
                              className="overflow-hidden line-clamp-3"
                              dangerouslySetInnerHTML={{ __html: disruption.description }}
                            />
                            <button
                              onClick={() => openDisruptionModal(disruption)}
                              className="text-yellow-500 hover:text-yellow-600 text-sm font-medium mt-1"
                            >
                              Veure més
                            </button>
                          </div>
                        )}
                        {disruption.image && (
                          <div className="mt-2">
                            <img
                              src={disruption.image}
                              alt={disruption.title}
                              className="w-full h-48 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setSelectedImage(disruption.image)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {oldDisruptions.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4"
              >
                <button
                  onClick={() => setShowOldDisruptions(!showOldDisruptions)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg"
                >
                  {showOldDisruptions ? 'Amagar incidències antigues' : `Mostrar incidències antigues (${oldDisruptions.length})`}
                </button>

                <AnimatePresence>
                  {showOldDisruptions && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 opacity-75"
                    >
                      {oldDisruptions.map((disruption) => (
                        <motion.div
                          key={disruption.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white rounded-lg shadow-md"
                        >
                          <div className="p-4">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="text-yellow-500 flex-shrink-0 mt-1" />
                              <div>
                                <h3 className="font-bold text-lg mb-2">{disruption.title || 'Sense títol'}</h3>
                                <p className="text-sm text-gray-500 mb-2">
                                  {new Date(disruption.date).toLocaleDateString('ca-ES', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </p>
                                <div className="mb-2">
                                  {disruption.affectedLines?.split('Línies: ')[1]?.split(', ').map((line) => (
                                    line && (
                                      <span
                                        key={line}
                                        className={`inline-block px-2 py-1 rounded-md text-sm font-semibold mr-2 mb-2 ${
                                          line.trim().startsWith('N') ? 'bg-blue-800 text-white' : 'bg-yellow-400 text-black'
                                        }`}
                                      >
                                        {line.trim()}
                                      </span>
                                    )
                                  ))}
                                </div>
                                {disruption.description && (
                                  <div className="prose prose-sm max-w-none mb-2">
                                    <div
                                      className="overflow-hidden line-clamp-3"
                                      dangerouslySetInnerHTML={{ __html: disruption.description }}
                                    />
                                    <button
                                      onClick={() => openDisruptionModal(disruption)}
                                      className="text-yellow-500 hover:text-yellow-600 text-sm font-medium mt-1"
                                    >
                                      Veure més
                                    </button>
                                  </div>
                                )}
                                {disruption.image && (
                                  <div className="mt-2">
                                    <img
                                      src={disruption.image}
                                      alt={disruption.title}
                                      className="w-full h-48 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => setSelectedImage(disruption.image)}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={24} className="text-yellow-500" />
            <h2 className="text-2xl font-bold">Afectacions del servei</h2>
          </div>
          <button
            onClick={() => setShowDisruptions(!showDisruptions)}
            className="text-gray-600 hover:text-gray-800"
          >
            {showDisruptions ? <MinusSquare size={24} /> : <Plus size={24} />}
          </button>
        </div>
        {renderDisruptions()}
      </div>

      {selectedImage && (
        <Lightbox
          open={true}
          close={() => setSelectedImage(null)}
          slides={[{ src: selectedImage }]}
        />
      )}

      {selectedDisruption && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDisruption(null)}
          title={selectedDisruption.title || 'Sense títol'}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {new Date(selectedDisruption.date).toLocaleDateString('ca-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
            <div className="mb-4">
              {selectedDisruption.affectedLines?.split('Línies: ')[1]?.split(', ').map((line) => (
                line && (
                  <span
                    key={line}
                    className={`inline-block px-2 py-1 rounded-md text-sm font-semibold mr-2 mb-2 ${
                      line.trim().startsWith('N') ? 'bg-blue-800 text-white' : 'bg-yellow-400 text-black'
                    }`}
                  >
                    {line.trim()}
                  </span>
                )
              ))}
            </div>
            {selectedDisruption.description && (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedDisruption.description }}
              />
            )}
            {selectedDisruption.image && (
              <div className="mt-4">
                <img
                  src={selectedDisruption.image}
                  alt={selectedDisruption.title}
                  className="max-w-full h-auto rounded-md cursor-pointer mx-auto block"
                  onClick={() => setSelectedImage(selectedDisruption.image)}
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default Incidencies;