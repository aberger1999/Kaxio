import { Inbox } from '@novu/react';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { notificationsApi } from '../api/client';

export default function NotificationInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: preferences } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationsApi.getPreferences,
    staleTime: 60_000,
    retry: 1,
  });

  if (!user) return null;
  if (preferences?.inAppNotificationsEnabled === false) return null;
  const subscriberId = String(user.email || '').trim().toLowerCase();
  if (!subscriberId) return null;

  return (
    <Inbox
      applicationIdentifier="ykMRI4nxQVda"
      subscriberId={subscriberId}
      socketUrl="wss://socket.novu.co"
      routerPush={(path) => navigate(path)}
      placement="bottom-end"
      appearance={{
        variables: {
          colorPrimary: '#7c3aed',
          colorForeground: '#0f0e17',
        },
      }}
      renderBell={(unreadCount) => (
        <button
          className="relative flex items-center justify-center bg-primary hover:bg-primary-dark !text-black dark:!text-white text-sm px-3 py-2 rounded-lg transition-colors"
          title="Notifications"
        >
          <Bell size={16} className="!text-black dark:!text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}
    />
  );
}
