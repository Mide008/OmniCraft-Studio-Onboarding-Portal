// src/components/Logo.tsx
import Image from 'next/image';

interface LogoProps {
  theme: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Logo({ theme, size = 'md', className = '' }: LogoProps) {
  const src = theme === 'dark' ? '/logos/logo-dark.svg' : '/logos/logo-light.svg';

  const dimensions = {
    sm: { width: 100, height: 30 },
    md: { width: 140, height: 42 },
    lg: { width: 180, height: 54 },
  };

  const { width, height } = dimensions[size];

  return (
    <Image
      src={src}
      alt="OmniCraft Studios"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}