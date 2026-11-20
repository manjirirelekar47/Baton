import React, { useState } from "react";

export interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "loading"> {
  src: string;
  webpSrc?: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}

/**
 * OptimizedImage component for high performance, zero layout shift (CLS),
 * modern WebP support with fallback, and explicit priority/LCP optimization.
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  webpSrc,
  alt,
  width,
  height,
  priority = false,
  className = "",
  onError,
  decoding = "async",
  ...rest
}) => {
  const [hasError, setHasError] = useState(false);

  // Derive WebP source if not explicitly provided
  const computedWebpSrc = webpSrc || (src.endsWith(".png") ? src.replace(/\.png$/, ".webp") : undefined);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    if (onError) {
      onError(e);
    }
  };

  return (
    <picture className="inline-block">
      {!hasError && computedWebpSrc && (
        <source srcSet={computedWebpSrc} type="image/webp" />
      )}
      <img
        src={hasError ? "/logo.png" : src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        // @ts-expect-error fetchpriority is standard in modern HTML / React 18.3+
        fetchpriority={priority ? "high" : "auto"}
        decoding={decoding}
        className={className}
        onError={handleError}
        {...rest}
      />
    </picture>
  );
};
