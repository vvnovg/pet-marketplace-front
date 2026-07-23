"use client";

import { useState } from "react";
import type { ListingImage } from "@/types/api";

export function ImageGallery({ images }: { images: ListingImage[] }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return <div className="aspect-[4/3] rounded-lg bg-muted" />;
  }
  const current = images[active] ?? images[0]!;
  return (
    <div className="space-y-2">
      <div className="aspect-[4/3] rounded-lg bg-muted overflow-hidden">
        <img src={current.url} alt="" className="h-full w-full object-cover" />
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => setActive(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded border-2 ${i === active ? "border-primary" : "border-transparent"}`}>
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}