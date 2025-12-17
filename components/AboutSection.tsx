import React from 'react';
import { Star } from 'lucide-react';
import { COMPANY_INFO } from '../constants';

export const AboutSection: React.FC = () => {
  return (
    <section id="sobre" className="relative w-full border-b-2 border-roca-dark bg-roca-green text-roca-cream">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Left: Narrative */}
        <div className="p-8 md:p-16 border-b-2 lg:border-b-0 lg:border-r-2 border-roca-dark/20">
            <h2 className="text-4xl md:text-6xl font-serif mb-8 text-roca-gold">
              Tradição &<br/>Afeto
            </h2>
            <div className="space-y-6 text-lg md:text-xl font-sans leading-relaxed opacity-90">
              {COMPANY_INFO.description.map((desc, idx) => (
                <p key={idx}>{desc}</p>
              ))}
            </div>
            
            <div className="mt-12 p-6 border border-roca-gold/30 rounded-sm bg-roca-dark/20 backdrop-blur-sm">
                <p className="font-mono text-sm text-roca-gold mb-2 uppercase tracking-widest">Nossa Missão</p>
                <p className="font-serif italic text-2xl">
                    "{COMPANY_INFO.tagline}"
                </p>
            </div>
        </div>

        {/* Right: Features List */}
        <div className="p-8 md:p-16 bg-roca-cream text-roca-dark">
            <h3 className="font-mono uppercase text-sm tracking-widest mb-8 border-b-2 border-roca-rust inline-block pb-1">
                Nossas Delícias
            </h3>
            
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {COMPANY_INFO.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start group">
                        <Star className="w-5 h-5 text-roca-rust mr-3 mt-1 fill-current group-hover:rotate-180 transition-transform duration-500" />
                        <span className="font-serif text-xl">{feature}</span>
                    </li>
                ))}
            </ul>

            <div className="mt-12 pt-8 border-t-2 border-roca-dark flex flex-col md:flex-row justify-between items-center gap-4">
                <span className="font-mono text-xs uppercase">Siga-nos nas redes</span>
                <a 
                    href={COMPANY_INFO.whatsappLink} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-3 bg-roca-rust text-white font-mono uppercase text-sm hover:bg-roca-dark transition-colors"
                >
                    Fale Conosco
                </a>
            </div>
        </div>
      </div>
    </section>
  );
};