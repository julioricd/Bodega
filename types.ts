export interface ProductItem {
  name: string;
  isNew?: boolean;
}

export interface ProductSection {
  id: string;
  title: string;
  subtitle?: string;
  price: string;
  items: ProductItem[];
  description?: string;
  offerType?: 'standard' | 'combo';
  extraInfo?: string[];
  imageSeed?: number;
  category: 'doces' | 'queijos' | 'combos';
}

export interface CompanyInfo {
  name: string;
  tagline: string;
  whatsappLink: string;
  description: string[];
  features: string[];
}