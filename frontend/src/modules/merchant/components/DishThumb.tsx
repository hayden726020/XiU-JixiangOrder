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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8.2" />
            <circle cx="12" cy="12" r="4.4" />
            <path d="M4 20l2.4-2.4M17.6 6.4L20 4" />
          </svg>
        </span>
      )}
    </span>
  );
}