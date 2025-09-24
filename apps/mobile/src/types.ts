export type Slider = { id: string; title?: string | null; image_url: string };

export type Restaurant = {
  id: string;
  name: string;
  cuisine?: string | null;
  phone?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  image_url?: string | null;
  is_sponsor?: number | boolean;
  is_published?: number | boolean;
};

export type TransportRoute = {
  id: string;
  code: string;
  title?: string | null;
  description?: string | null;
  pdf_url?: string | null;
  image_url?: string | null;
  series?: string | null;
  is_published?: number | boolean;
};

export type ExplorePlace = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  cover_url?: string | null;
};


