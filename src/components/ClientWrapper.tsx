
"use client";

import { useQueueWorker } from "@/hooks/useQueueWorker";
import NotificationToast from "@/components/NotificationToast";

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const { notifications, removeNotification } = useQueueWorker();

  return (
    <>
      <NotificationToast notifications={notifications} onRemove={removeNotification} />
      {children}
    </>
  );
}
