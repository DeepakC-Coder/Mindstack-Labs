import React, { useEffect, useRef } from 'react';

/**
 * Chemistry Lab Page
 * Embeds the EDTA Titration Virtual Laboratory
 */
const ChemistryLab: React.FC = () => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        // Ensure the iframe fills the container properly
        const handleResize = () => {
            if (iframeRef.current) {
                iframeRef.current.style.height = '100%';
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div className="w-full h-screen overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
            <iframe
                ref={iframeRef}
                src="/chemistry-lab/lab.html"
                title="Virtual Chemistry Lab - EDTA Titration"
                className="w-full h-full border-0"
                style={{
                    height: '100vh',
                    width: '100%',
                }}
                allow="fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            />
        </div>
    );
};

export default ChemistryLab;
