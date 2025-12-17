import React, { useState } from 'react';
import { Hero } from './components/Hero';
import { Marquee } from './components/Marquee';
import { ProductCard } from './components/ProductCard';
import { AboutSection } from './components/AboutSection';
import { PRODUCTS, COMPANY_INFO } from './constants';
import { Store, Send, CheckCircle, AlertCircle, Filter } from 'lucide-react';
import { validateEmail, validateWhatsAppUrl } from './utils/validation';

function App() {
  const [email, setEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'error' | 'success'>('idle');
  const [activeCategory, setActiveCategory] = useState<string>('todos');

  // Garante que o link do WhatsApp é válido antes de renderizar nos botões
  const safeWhatsappLink = validateWhatsAppUrl(COMPANY_INFO.whatsappLink) 
    ? COMPANY_INFO.whatsappLink 
    : '#';

  const categories = [
    { id: 'todos', label: 'Todos' },
    { id: 'doces', label: 'Doces' },
    { id: 'combos', label: 'Combos' },
    // { id: 'queijos', label: 'Queijos' } // Pode ser ativado quando houver produtos exclusivos de queijo
  ];

  const filteredProducts = activeCategory === 'todos' 
    ? PRODUCTS 
    : PRODUCTS.filter(p => p.category === activeCategory);

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      setNewsletterStatus('error');
      return;
    }

    // Simulação de envio
    setNewsletterStatus('success');
    setEmail('');
    
    // Resetar status após 3 segundos
    setTimeout(() => {
      setNewsletterStatus('idle');
    }, 3000);
  };

  return (
    <main className="min-h-screen bg-roca-cream text-roca-dark selection:bg-roca-rust selection:text-white">
      {/* Navigation / Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 py-4 bg-roca-cream/90 backdrop-blur-md border-b-2 border-roca-dark">
        <div className="flex items-center gap-2">
            <Store className="w-6 h-6 text-roca-rust" />
            <span className="font-mono font-bold uppercase tracking-tighter">Bodega da Roça</span>
        </div>
        <a 
            href={safeWhatsappLink}
            target={safeWhatsappLink !== '#' ? "_blank" : undefined}
            rel="noopener noreferrer"
            className={`font-mono text-xs md:text-sm uppercase hover:text-roca-rust underline decoration-roca-rust decoration-2 underline-offset-4 ${safeWhatsappLink === '#' ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            WhatsApp
        </a>
      </header>

      {/* Spacing for fixed header */}
      <div className="h-[60px]"></div>

      <Hero />
      
      <Marquee text="Doces Caseiros • Queijos Artesanais • Sabores da Terra" />

      {/* Catalogue Filter & Grid */}
      <section id="catalogo" className="w-full border-b-2 border-roca-dark bg-white">
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 py-8 px-6 border-b-2 border-roca-dark bg-roca-cream">
            <span className="font-mono text-sm uppercase tracking-widest flex items-center gap-2 opacity-60 mr-0 md:mr-4">
              <Filter className="w-4 h-4" /> Filtrar por:
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-6 py-2 border-2 border-roca-dark font-mono text-xs md:text-sm uppercase tracking-wider transition-all duration-300 ${
                    activeCategory === cat.id 
                      ? 'bg-roca-dark text-roca-cream shadow-[4px_4px_0px_0px_rgba(196,93,56,1)] translate-y-[-2px]' 
                      : 'bg-transparent hover:bg-roca-dark hover:text-roca-cream'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-h-[400px]">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((section) => (
              <ProductCard 
                key={section.id} 
                section={section} 
                whatsappLink={safeWhatsappLink} 
              />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-12 text-center opacity-50">
               <AlertCircle className="w-12 h-12 mb-4 text-roca-rust" />
               <p className="font-serif text-2xl">Nenhum produto encontrado nesta categoria.</p>
            </div>
          )}
        </div>
      </section>

      <Marquee text="Entregamos em toda a região • Produtos Frescos • Feito com Amor" reverse />

      <AboutSection />

      {/* Footer */}
      <footer className="bg-roca-dark text-roca-cream pt-12 md:pt-24 pb-12 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
          
          <h2 className="font-serif text-4xl md:text-6xl mb-8">Bodega Gostosuras da Roça</h2>
          
          {/* Newsletter Section with Validation */}
          <div className="w-full max-w-md mb-12">
            <p className="font-mono text-sm uppercase mb-4 opacity-70">Receba novidades e ofertas exclusivas</p>
            <form onSubmit={handleNewsletterSubmit} className="relative">
              <div className="flex border-b border-roca-cream/30 focus-within:border-roca-rust transition-colors">
                <input 
                  type="text" 
                  placeholder="Seu melhor e-mail" 
                  className="bg-transparent w-full py-3 outline-none placeholder:text-roca-cream/30 font-sans"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (newsletterStatus === 'error') setNewsletterStatus('idle');
                  }}
                />
                <button 
                  type="submit" 
                  className="uppercase font-mono text-xs hover:text-roca-rust transition-colors flex items-center gap-2"
                >
                  Inscrever <Send className="w-3 h-3" />
                </button>
              </div>
              
              {/* Validation Messages */}
              <div className="absolute top-full left-0 mt-2 text-xs font-mono flex items-center gap-2 h-6">
                {newsletterStatus === 'error' && (
                  <span className="text-red-400 flex items-center gap-1 animate-pulse">
                    <AlertCircle className="w-3 h-3" /> E-mail inválido
                  </span>
                )}
                {newsletterStatus === 'success' && (
                  <span className="text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Inscrito com sucesso!
                  </span>
                )}
              </div>
            </form>
          </div>

          <div className="flex flex-col md:flex-row justify-center items-center gap-8 font-mono text-sm uppercase opacity-70">
              <a href="#" className="hover:text-roca-rust transition-colors">Instagram</a>
              <a href="#" className="hover:text-roca-rust transition-colors">Facebook</a>
              <a href={safeWhatsappLink} target={safeWhatsappLink !== '#' ? "_blank" : undefined} rel="noopener noreferrer" className="hover:text-roca-rust transition-colors">WhatsApp</a>
          </div>
          
          <p className="mt-12 font-mono text-xs opacity-40">
              © {new Date().getFullYear()} Bodega Gostosuras da Roça. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}

export default App;