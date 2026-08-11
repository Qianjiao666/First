import { mountAnnouncementBanner } from "/MKJ/announcements/announcements.js";
import { mountNotificationBell } from "/MKJ/shared/notification-bell.js";

function mountWidgets() {
  const runtime = globalThis.MKJApp;
  const announcementSlots = document.querySelectorAll(
    "[data-forum-announcement-slot], [data-task-announcement-slot]",
  );
  for (const slot of announcementSlots) {
    void mountAnnouncementBanner({ root: slot, runtime }).catch(() => {
      slot.replaceChildren();
    });
  }

  const notificationSlots = document.querySelectorAll(
    "[data-forum-notification-slot], [data-task-notification-slot]",
  );
  for (const slot of notificationSlots) {
    mountNotificationBell({ root: slot, runtime });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => setTimeout(mountWidgets, 0), { once: true });
} else {
  setTimeout(mountWidgets, 0);
}
