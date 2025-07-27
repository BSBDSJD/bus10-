import React from 'react';

interface FooterProps {
  headerImages: string[];
}

const Footer: React.FC<FooterProps> = ({ headerImages }) => {
  return (
    <footer className="relative py-8 mt-12">
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={headerImages[0]}
          alt="Background"
          className="w-full h-full object-cover filter blur-sm scale-105"
        />
        <div className="absolute inset-0 bg-black bg-opacity-75"></div>
      </div>
      <div className="relative container mx-auto px-4 text-center text-white">
        <p className="text-sm">
          © {new Date().getFullYear()} Badalona Mèdia. Font de dades AMB Mobilitat.
        </p>
      </div>
    </footer>
  );
};

export default Footer;