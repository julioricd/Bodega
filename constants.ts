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
    imageSeed: 101
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
    imageSeed: 202
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
    imageSeed: 303
  }
];