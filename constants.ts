import { ProductSection, CompanyInfo } from './types';

export const COMPANY_INFO: CompanyInfo = {
  name: "BODEGA GOSTOSURAS DA ROÇA",
  tagline: "Trazendo para a cidade o verdadeiro sabor da roça!",
  whatsappLink: "https://wa.me/c/5522999388376",
  description: [
    "Produzidos artesanalmente por pequenos produtores, nossos doces, queijos e delícias carregam tradição, carinho e aquele gostinho especial do interior.",
    "Reviva memórias ou descubra novos sabores com nossas gostosuras. Na Bodega Gostosuras da Roça, cada detalhe é feito com amor e tradição."
  ],
  features: [
    "Queijos frescos e curados",
    "Mel puro e derivados",
    "Pães e bolos caseiros",
    "Goiabada, doce de leite e cocada",
    "Café torrado na hora",
    "Embutidos e defumados",
    "Manteiga de garrafa",
    "Cachaça artesanal e licores"
  ]
};

export const PRODUCTS: ProductSection[] = [
  {
    id: "doce-leite-premium",
    title: "Nossos Doces de Leite",
    subtitle: "A pura tradição mineira",
    price: "R$ 30,00",
    offerType: "standard",
    category: 'doces',
    items: [
      { name: "Doce de leite tradicional" },
      { name: "Doce de leite raspinha de limão" },
      { name: "Doce de leite com morango" },
      { name: "Doce de leite maracujá" },
      { name: "Doce de leite com amendoim" },
      { name: "Doce de leite com nozes" },
      { name: "Doce de leite com coco" },
      { name: "Doce de leite coco com cacau" },
      { name: "Doce de leite maracujá com cacau" }
    ],
    imageUrl: "https://images.unsplash.com/photo-1589119908995-c6837fa14848?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "cocadas-artesanais",
    title: "Cocadas de Forno",
    subtitle: "Cremosidade e sabor tropical",
    price: "R$ 15,00",
    offerType: "standard",
    category: 'doces',
    items: [
      { name: "Cocada branca tradicional" },
      { name: "Cocada queimada" },
      { name: "Cocada com maracujá" },
      { name: "Cocada com doce de leite" },
      { name: "Cocada cremosa de colher" }
    ],
    imageUrl: "https://images.unsplash.com/photo-1590089415225-403ed3f56829?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "sobremesas-imperiais",
    title: "Sobremesas de Colher",
    subtitle: "Afeto em cada mordida",
    price: "R$ 25,00",
    offerType: "standard",
    category: 'doces',
    items: [
      { name: "Ambrosia tradicional mineira" },
      { name: "Pudim de leite condensado (inteiro)" },
      { name: "Pudim de leite (fatia generosa)" },
      { name: "Arroz doce com canela" },
      { name: "Quindim artesanal" }
    ],
    imageUrl: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "combo-doce-queijo",
    title: "Combo Doce e Queijo",
    subtitle: "O par perfeito da roça",
    description: "Comprou um doce de leite, leva o queijo provolone desidratado.",
    price: "R$ 29,99",
    offerType: "combo",
    category: 'combos',
    items: [
      { name: "Doce de leite tradicional" },
      { name: "Doce de leite com coco" },
      { name: "Doce de leite com limão" },
      { name: "Doce de leite com cacau" }
    ],
    extraInfo: ["Inclui Queijo Provolone Desidratado"],
    imageUrl: "https://images.unsplash.com/photo-1485962391944-82a5f3a0c6c7?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "lata-queijo",
    title: "Combo Latas e Sabores",
    subtitle: "Doces cremosos + Provolone temperado",
    description: "Comprou a lata de doce, leva o queijo provolone especial.",
    price: "R$ 29,99",
    offerType: "combo",
    category: 'combos',
    items: [
      { name: "Doce de abóbora com coco" },
      { name: "Mangada cremosa" },
      { name: "Doce de banana cremoso" },
      { name: "Doce de goiaba cremoso Light" }
    ],
    extraInfo: [
      "Escolha seu Provolone:",
      "Lemon Pepper",
      "Pimenta",
      "Alho",
      "Chimichurri"
    ],
    imageUrl: "https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&q=80&w=800"
  }
];