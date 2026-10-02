import { useStore } from '@nanostores/react';
import type { Artwork } from '../lib/artworks';
import { $activeId } from '../stores/gallery';

interface Props {
  artworks: Artwork[];
}

export default function ArtworkIndex({ artworks }: Props) {
  const activeId = useStore($activeId);

  return (
    <ol className="list" onPointerLeave={() => $activeId.set(null)}>
      {artworks.map((artwork) => (
        <li key={artwork.id}>
          <button
            type="button"
            className="row"
            data-active={activeId === artwork.id}
            aria-label={`${artwork.number} ${artwork.title ?? 'Untitled'} ${artwork.author ?? ''}`.trim()}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') $activeId.set(artwork.id);
            }}
            onFocus={() => $activeId.set(artwork.id)}
            onBlur={() => $activeId.set(null)}
            onClick={() => $activeId.set(artwork.id)}
          >
            <span className="num">{artwork.number}</span>
            <img
              src={artwork.image.src}
              alt=""
              width={artwork.image.width}
              height={artwork.image.height}
              loading="lazy"
              decoding="async"
            />
            <span className="title">{artwork.title}</span>
            <span className="author">{artwork.author}</span>
            <span className="date">{artwork.date}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
