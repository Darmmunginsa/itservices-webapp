import type { Configuration, PopupRequest } from '@azure/msal-browser'

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID || 'common'}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
}

export const loginRequest: PopupRequest = {
  scopes: [
    'User.Read',
    'Sites.ReadWrite.All',
    'Calendars.ReadWrite',
  ],
}

export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphCalendarEndpoint: 'https://graph.microsoft.com/v1.0/me/calendarView',
  graphEventsEndpoint: 'https://graph.microsoft.com/v1.0/me/events',
}

export const SHAREPOINT_URL = import.meta.env.VITE_SHAREPOINT_URL || ''
export const SHAREPOINT_API = `${SHAREPOINT_URL}/_api/web/lists/getbytitle`
