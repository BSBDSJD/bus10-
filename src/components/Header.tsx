import React, { useState, useEffect } from 'react';

interface HeaderProps {
  headerImages: string[];
}

const Header: React.FC<HeaderProps> = ({ headerImages }) => {
  const [currentHeaderImage, setCurrentHeaderImage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeaderImage((current) => (current + 1) % headerImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [headerImages.length]);

  return (
    <header className="relative h-36 overflow-hidden rounded-b-2xl">
      <div className="absolute inset-0">
        <img
          src={headerImages[currentHeaderImage]}
          alt="TUSA Bus"
          className="w-full h-full object-cover transition-opacity duration-500"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <h1 className="text-4xl font-bold text-white text-center">
            INFO TUSA
          </h1>
        </div>
      </div>
    </header>
  );
};

export default Header;