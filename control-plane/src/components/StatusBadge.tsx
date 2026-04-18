import { cn } from '@/lib/utils'
import { ShieldCheck, ShieldAlert, ShieldQuestion, ShieldX } from 'lucide-react'

type Status = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const configs: Record<Status, { label: string; className: string; icon: React.ReactNode }> = {
    healthy: {
      label: 'Healthy',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: <ShieldCheck className="w-3 h-3" />,
    },
    degraded: {
      label: 'Degraded',
      className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      icon: <ShieldAlert className="w-3 h-3" />,
    },
    unhealthy: {
      label: 'Unhealthy',
      className: 'bg-red-500/10 text-red-400 border-red-500/20',
      icon: <ShieldX className="w-3 h-3" />,
    },
    unknown: {
      label: 'Unknown',
      className: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      icon: <ShieldQuestion className="w-3 h-3" />,
    },
  }

  const config = configs[status] ?? configs.unknown

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        config.className,
        status === 'healthy' && 'animate-pulse-subtle',
        className
      )}
    >
      {config.icon}
      {config.label}
    </span>
  )
}
