import { IconSoup } from './MerchantIcons';

interface DishThumbProps {
  src: string | null;
  alt: string;
  size?: 'sm' | 'md';
}

export default function DishThumb({ src, alt, size = 'md' }: DishThumbProps) {
  return (
    <span className={`dish-thumb dish-thumb--${size}`}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : (
        <span className="dish-thumb__empty" aria-hidden="true">
          <IconSoup size={size === 'sm' ? 16 : 22} />
        </span>
      )}
    </span>
  );
}