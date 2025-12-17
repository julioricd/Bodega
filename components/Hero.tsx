import React from 'react';
import { ArrowDownRight } from 'lucide-react';
import { COMPANY_INFO } from '../constants';

export const Hero: React.FC = () => {
  return (
    <section className="relative w-full border-b-2 border-roca-dark">
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[80vh]">
        
        {/* Left Text Content */}
        <div className="lg:col-span-8 p-6 md:p-12 lg:p-16 flex flex-col justify-between border-r-0 lg:border-r-2 border-roca-dark bg-roca-cream">
          <div>
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif font-semibold leading-[0.9] tracking-tighter mb-8">
              SABOR <br/>
              <span className="italic text-roca-rust">DA ROÇA</span> <br/>
              DE VERDADE.
            </h1>
          </div>
          
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-end">
             <div className="max-w-sm">
               <p className="font-mono text-lg leading-relaxed uppercase border-l-2 border-roca-rust pl-4 mb-6">
                 {COMPANY_INFO.tagline}
               </p>
               <p className="text-xl font-sans">
                 Doces artesanais, queijos curados e o afeto da produção familiar brasileira.
               </p>
             </div>
             <a 
               href="#catalogo"
               className="group flex items-center justify-center w-full md:w-auto px-8 py-4 bg-roca-dark text-roca-cream font-mono uppercase hover:bg-roca-rust transition-colors duration-300"
             >
               Ver Catálogo
               <ArrowDownRight className="ml-2 w-5 h-5 group-hover:rotate-45 transition-transform" />
             </a>
          </div>
        </div>

        {/* Right Image/Visual */}
        <div className="lg:col-span-4 relative overflow-hidden h-[500px] lg:h-auto border-t-2 lg:border-t-0 border-roca-dark">
          <img 
            src="https://images.unsplash.com/photo-1541336032412-2048a678540d?auto=format&fit=crop&q=80&w=1200" 
            alt="Seleção colorida e apetitosa de doces e queijos artesanais" 
            className="absolute inset-0 w-full h-full object-cover transition-all duration-1000 scale-105 hover:scale-100"
          />
          <div className="absolute inset-0 bg-roca-rust/5 mix-blend-multiply pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 p-4 bg-roca-dark text-white font-mono text-[10px] w-full flex justify-between items-center">
            <span>BODEGA GOSTOSURAS DA ROÇA</span>
            <span className="opacity-50 tracking-[0.2em]">ARTESANAL • NATURAL</span>
          </div>
        </div>

      </div>
    </section>
  );
};