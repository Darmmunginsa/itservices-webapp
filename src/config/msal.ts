import type { Configuration, PopupRequest } from '@azure/msal-browser'

const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || '0bab07cf-65e6-487c-89af-c917fc1a5a13'
const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'd569b991-89fc-4a62-9df5-eb361abcef40'

// Hardcode production URI — for SPA, redirectUri is not a secret
const PROD_URI  = 'https://darmmunginsa.github.io/itservices-webapp/'
const LOCAL_URI = 'http://localhost:5173'

export const REDIRECT_URI = window.location.hostname === 'localhost' ? LOCAL_URI : PROD_URI

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: REDIRECT_URI,
  },
  cache: {
    cacheLocation: 'localStorage',
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

export const SHAREPOINT_URL = import.meta.env.VITE_SHAREPOINT_URL || 'https://rpaexpert.sharepoint.com/sites/iTServicesCo.Ltd'
export const SHAREPOINT_API = `${SHAREPOINT_URL}/_api/web/lists/getbytitle`
