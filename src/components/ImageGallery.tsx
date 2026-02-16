import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Image as ImageIcon } from "lucide-react";

export interface SearchImage {
  url: string;
  thumbnailUrl?: string;
  alt?: string;
  source?: string;
  sourceUrl?: string;
}

interface ImageGalleryProps {
  images: SearchImage[];
  maxDisplay?: number;
  className?: string;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  maxDisplay = 6,
  className = "",
}) => {
  const [selectedImage, setSelectedImage] = useState<SearchImage | null>(null);
  const [loadErrors, setLoadErrors] = useState<Set<string>>(new Set());

  if (images.length === 0) return null;

  const displayImages = images.slice(0, maxDisplay).filter(img => !loadErrors.has(img.url));

  const handleImageError = (url: string) => {
    setLoadErrors(prev => new Set([...prev, url]));
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className={`bg-black/20 backdrop-blur-sm rounded-xl p-4 ${className}`}
      >
        <div className="flex items-center gap-2 text-white/70 text-sm mb-3">
          <ImageIcon className="w-4 h-4" />
          <span>Images ({images.length})</span>
        </div>
        
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {displayImages.map((image, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
              onClick={() => setSelectedImage(image)}
            >
              <img
                src={image.thumbnailUrl || image.url}
                alt={image.alt || "Search result image"}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                onError={() => handleImageError(image.url)}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-white" />
              </div>
            </motion.div>
          ))}
        </div>
        
        {images.length > maxDisplay && (
          <p className="text-white/50 text-xs mt-2 text-center">
            +{images.length - maxDisplay} more images
          </p>
        )}
      </motion.div>

      {/* Full Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] bg-[#1F2023] rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              
              <img
                src={selectedImage.url}
                alt={selectedImage.alt || "Full size image"}
                className="max-w-full max-h-[80vh] object-contain"
              />
              
              {(selectedImage.source || selectedImage.sourceUrl) && (
                <div className="p-4 border-t border-white/10">
                  <p className="text-white/60 text-sm">
                    Source: {selectedImage.source || "Unknown"}
                  </p>
                  {selectedImage.sourceUrl && (
                    <a
                      href={selectedImage.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 mt-1"
                    >
                      Visit source <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ImageGallery;
