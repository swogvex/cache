import { useRef } from 'react';
import { useStore } from '@nanostores/react';
import type { Artwork } from '../lib/artworks';
import { $activeId, $mode, $openId, releaseActive } from '../stores/gallery';
import CursorPreview from './CursorPreview';
import Lightbox from './Lightbox';
import StagePanel from './StagePanel';

interface Props {
  artworks: Artwork[];
}

export default function ArtworkIndex({ artworks }: Props) {
  const activeId = useStore($activeId);
  const mode = useStore($mode);
  const pointerType = useRef('mouse');

  return (
    <>
      <div className="gallery" data-mode={mode} data-bounce>
        <ol className="list" onPointerLeave={releaseActive}>
          {artworks.map((artwork) => (
            <li key={artwork.id}>
              <button
                type="button"
                className="row"
                data-artwork-id={artwork.id}
                data-active={activeId === artwork.id}
                aria-label={`${artwork.number} ${artwork.title ?? 'Untitled'} ${artwork.author ?? ''}`.trim()}
                onPointerDown={(event) => {
                  pointerType.current = event.pointerType;
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') $activeId.set(artwork.id);
                }}
                onFocus={(event) => {
                  if (event.currentTarget.matches(':focus-visible')) $activeId.set(artwork.id);
                }}
                onBlur={releaseActive}
                onClick={() => {
                  // En stage con pantalla táctil, el primer toque previsualiza y el segundo abre.
                  if (
                    $mode.get() === 'stage' &&
                    pointerType.current !== 'mouse' &&
                    $activeId.get() !== artwork.id
                  ) {
                    $activeId.set(artwork.id);
                    return;
                  }
                  $openId.set(artwork.id);
                }}
              >
                <span className="num">{artwork.number}</span>
                <span className="title">{artwork.title}</span>
                <span className="author">{artwork.author}</span>
                <span className="date">{artwork.date}</span>
              </button>
            </li>
          ))}
        </ol>
        {mode === 'stage' && <StagePanel artworks={artworks} />}
      </div>
      <CursorPreview artworks={artworks} />
      <Lightbox artworks={artworks} />
    </>
  );
}
