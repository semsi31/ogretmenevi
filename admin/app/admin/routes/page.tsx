"use client";
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

type Route = {
  id: string; code: string; title?: string; description?: string; pdf_url?: string; image_url?: string; series?: string; is_published: boolean;
};

export default function RoutesPage() {
  if (typeof window !== 'undefined') {
    window.location.replace('/admin/ulasim');
  }
  return null;
}


