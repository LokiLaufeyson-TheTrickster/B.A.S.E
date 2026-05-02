'use client';

import React from 'react';
import { VICE_50 } from '@/lib/vice50';

export default function Marquee() {
  // Duplicate for seamless scroll
  const items = [...VICE_50, ...VICE_50];

  return (
    <div className="marquee-bar">
      <div className="marquee-track">
        {items.map((quote, i) => (
          <React.Fragment key={i}>
            <span className="marquee-item">{quote}</span>
            <span className="marquee-separator">◆</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
