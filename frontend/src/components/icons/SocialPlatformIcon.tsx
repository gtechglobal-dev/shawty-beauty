type Props = {
  platform: string
  size?: number
  className?: string
}

function Icon({ size = 16, className, children }: { size?: number; className?: string; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export default function SocialPlatformIcon({ platform, size = 16, className }: Props) {
  switch (platform.toLowerCase()) {
    case 'instagram':
      return (
        <Icon size={size} className={className}>
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </Icon>
      )
    case 'facebook':
      return (
        <Icon size={size} className={className}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </Icon>
      )
    case 'tiktok':
      return (
        <Icon size={size} className={className}>
          <path d="M9 12a4 4 0 1 0 4 4V4c.5 2.5 2.2 4.2 5 4.8" />
        </Icon>
      )
    case 'x (twitter)':
    case 'x':
    case 'twitter':
      return (
        <Icon size={size} className={className}>
          <path d="M4 4l6.6 7.6L4.5 20h2.5l4.7-5.4L13.9 20H20l-6.8-7.9L19.3 4h-2.5l-4.4 5.1L9.9 4H4z" />
        </Icon>
      )
    case 'youtube':
      return (
        <Icon size={size} className={className}>
          <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
          <path d="m10 15 5-3-5-3z" />
        </Icon>
      )
    case 'linkedin':
      return (
        <Icon size={size} className={className}>
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4V8h4v1.5" />
          <rect width="4" height="12" x="2" y="9" />
          <circle cx="4" cy="4" r="2" />
        </Icon>
      )
    case 'snapchat':
      return (
        <Icon size={size} className={className}>
          <path d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 1.2.3 2.3.9 3.2-.4 1-.9 1.7-1.6 2 2.4.6 4.2.5 4.7 2.6.5 1.7 1.5 2.6 2.5 2.6s2-.9 2.5-2.6c.5-2.1 2.3-2 4.7-2.6-.7-.3-1.2-1-1.6-2 .6-.9.9-2 .9-3.2A6.5 6.5 0 0 0 12 2.5z" />
          <circle cx="9.5" cy="10.5" r="1" />
          <circle cx="14.5" cy="10.5" r="1" />
        </Icon>
      )
    case 'threads':
      return (
        <Icon size={size} className={className}>
          <path d="M12 3c5 0 9 4 9 9s-4 9-9 9S3 17 3 12s4-9 9-9z" />
          <path d="M12 7.5a4.5 4.5 0 1 0 4.5 4.5c0-3-1.5-4.5-3-5.7" />
        </Icon>
      )
    case 'whatsapp': {
      const brandGreen = '#25D366'
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={brandGreen} className={className} aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
        </svg>
      )
    }
    default:
      return null
  }
}