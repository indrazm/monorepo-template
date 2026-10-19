import type { NotificationType } from "@repo/contracts/notifications";
import {
  Bell,
  ChartNoAxesColumnIncreasing,
  Clock,
  Eye,
  Flame,
  Gift,
  Megaphone,
  MessageCircle,
  PartyPopper,
  Play,
  ShoppingCart,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

// Brand-consistent SVG icons for every notification type (emojis render
// differently per OS/font and look out of place in the dashboard).
export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  recent_sales: ShoppingCart,
  counter: TrendingUp,
  combo: ChartNoAxesColumnIncreasing,
  live_visitors: Eye,
  review: Star,
  social_counter: Users,
  youtube: Play,
  custom: MessageCircle,
  low_stock: Flame,
  countdown: Clock,
  popup: PartyPopper,
  bar: Megaphone,
  spin_to_win: Gift,
};

export function NotificationTypeIcon({
  type,
  className,
}: {
  type: NotificationType;
  className?: string;
}) {
  const Icon = NOTIFICATION_TYPE_ICONS[type] ?? Bell;
  return <Icon className={className} aria-hidden="true" />;
}
