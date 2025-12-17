import React from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import { ProductSection, CompanyInfo } from '../types';

interface ProductCardProps {
  section: ProductSection;
  whatsappLink: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ section, whatsappLink }) => {
  const isCombo = section.offerType === 'combo';

  // Função para determinar o título da categoria dinamicamente
  const getCategoryDisplayTitle = (category: string) => {
    switch (category) {
      case 'doces':
        return 'Doces de Leite Artesanais';
      case 'combos':
        return 'Combos & Promoções';
      case 'queijos':
        return 'Queijos da Fazenda';
      default:
        return 'Seleção Especial';
    }
  };

  // Gera link direto com mensagem pré-definida
  const getDirectWhatsAppLink = () => {
    // Extrai apenas os números do link original (ex: wa.me/c/55...)
    const phoneMatch = whatsappLink.match(/\d+/);
    const phoneNumber = phoneMatch ? phoneMatch[0] : '';
    
    if (!phoneNumber) return whatsappLink;

    const message = `Olá! Gostaria de encomendar: *${section.title}* (${section.price})`;
    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  };

  const buyLink = getDirectWhatsAppLink();

  return (
    <div className="flex flex-col h-full border-r-2 border-roca-dark last:border-r-0 hover:bg-white transition-colors duration-300 group">
      {/* Header */}
      <div className="p-6 md:p-8 border-b-2 border-roca-dark bg-white group-hover:bg-roca-cream transition-colors">
        <div className="flex justify-between items-start mb-4">
          <span className="font-mono text-xs uppercase bg-roca-dark text-white px-2 py-1 rounded-sm">
            {section.offerType === 'combo' ? 'Oferta Especial' : 'Clássicos'}
          </span>
          <span className="font-serif text-3xl font-bold text-roca-rust">{section.price}</span>
        </div>
        <h3 className="text-3xl md:text-4xl font-sans font-bold leading-tight mb-3 uppercase tracking-tight">
          {section.title}
        </h3>
        
        {/* Título Dinâmico da Categoria (H2) */}
        <h2 className="font-mono text-xs font-bold text-roca-rust uppercase tracking-widest mb-1 border-l-2 border-roca-rust pl-2">
          {getCategoryDisplayTitle(section.category)}
        </h2>

        <p className="font-serif italic text-lg text-gray-600">{section.subtitle}</p>
      </div>

      {/* Image Preview */}
      <div className="h-48 overflow-hidden border-b-2 border-roca-dark relative">
        <img 
          src={`https://picsum.photos/seed/${section.imageSeed}/600/400`} 
          alt={section.title}
          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-100 group-hover:scale-105" 
        />
        {isCombo && (
           <div className="absolute bottom-0 right-0 bg-roca-rust text-white font-mono text-xs px-3 py-1 flex items-center gap-1 shadow-lg">
             <span className="text-base leading-none">🧀</span>
             <span>+ QUEIJO GRÁTIS</span>
           </div>
        )}
      </div>

      {/* List */}
      <div className="p-6 md:p-8 flex-grow flex flex-col justify-between">
        <div>
          {section.description && (
            <p className="font-mono text-sm mb-6 border-l-2 border-roca-rust pl-3">
              {section.description}
            </p>
          )}

          <ul className="space-y-3 mb-8">
            {section.items.map((item, idx) => (
              <li key={idx} className="flex items-start">
                <Check className="w-4 h-4 mt-1 mr-2 text-roca-rust flex-shrink-0" />
                <span className="font-sans font-medium text-lg leading-snug">{item.name}</span>
              </li>
            ))}
          </ul>

          {section.extraInfo && (
            <div className="bg-roca-cream p-4 border border-roca-dark mb-6">
              {section.extraInfo.map((info, idx) => (
                <p key={idx} className={`font-mono text-sm ${idx === 0 ? 'font-bold uppercase mb-2' : 'text-gray-700'}`}>
                  {info}
                </p>
              ))}
            </div>
          )}
        </div>

        <a 
          href={buyLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-4 border-2 border-roca-dark font-bold font-mono uppercase hover:bg-roca-dark hover:text-white transition-all duration-300 mt-auto shadow-[4px_4px_0px_0px_rgba(26,24,22,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(26,24,22,1)] active:translate-y-[4px] active:shadow-none"
        >
          <ShoppingBag className="w-5 h-5" />
          Comprar
        </a>
      </div>
    </div>
  );
};