"use client";
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ExplorePage() {
  if (typeof window !== 'undefined') {
    window.location.replace('/admin/kesfet');
  }
  return null;
}


