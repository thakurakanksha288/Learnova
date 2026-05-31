export function extractNotificationsFromResponse(response) {
  const notifications =
    response?.data?.notifications ?? response?.notifications;

  return Array.isArray(notifications) ? notifications : [];
}
