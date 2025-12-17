import React from 'react';

interface MarqueeProps {
  text: string;
  reverse?: boolean;
  className?: string;
}

export const Marquee: React.FC<MarqueeProps> = ({ text, reverse = false, className = "" }) => {
  return (
    <div className={`relative flex overflow-hidden border-y-2 border-roca-dark bg-roca-dark text-roca-cream py-3 ${className}`}>
      <div className={`animate-marquee${reverse ? '-reverse' : ''} whitespace-nowrap flex items-center`}>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">{text}</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">✸</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">{text}</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">✸</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">{text}</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">✸</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">{text}</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">✸</span>
      </div>
      <div className={`absolute top-0 animate-marquee${reverse ? '-reverse' : ''} whitespace-nowrap flex items-center translate-x-[100%]`}>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">{text}</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">✸</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">{text}</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">✸</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">{text}</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">✸</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">{text}</span>
        <span className="text-xl md:text-3xl font-mono uppercase tracking-widest mx-4">✸</span>
      </div>
    </div>
  );
};