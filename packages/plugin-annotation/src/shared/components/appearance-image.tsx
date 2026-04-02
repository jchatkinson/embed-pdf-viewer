import type { AnnotationAppearanceImage } from '@embedpdf/models';
import { useEffect, useRef, useState, CSSProperties } from '@framework';

interface AppearanceImageProps {
  appearance: AnnotationAppearanceImage<Blob>;
  style?: CSSProperties;
}

/**
 * Renders a pre-rendered annotation appearance stream image as an img URL.
 * Purely visual -- pointer events are always disabled; hit-area SVG handles interaction.
 */
export function AppearanceImage({ appearance, style }: AppearanceImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }
    const url = URL.createObjectURL(appearance.data);
    setImageUrl(url);
    urlRef.current = url;

    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [appearance.data]);

  return imageUrl ? (
    <img
      src={imageUrl}
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        userSelect: 'none',
        ...style,
      }}
    />
  ) : null;
}
