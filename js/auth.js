/**
 * @fileoverview Google OAuth 2.0 authentication module for Ayam Goreng Ledger.
 * Handles sign-in/sign-out, token management, and user profile retrieval
 * using Google Identity Services (GIS) and the Google API Client Library (gapi).
 *
 * Exposes a global `AyamAuth` object.
 */

const AyamAuth = (() => {
  // ---------------------------------------------------------------------------
  // Private state
  // ---------------------------------------------------------------------------

  /** @type {google.accounts.oauth2.TokenClient|null} */
  let tokenClient = null;

  /** Whether the gapi client library has been initialised. */
  let gapiInited = false;

  /** Whether the Google Identity Services library has been loaded. */
  let gisInited = false;

  /** Callback invoked whenever the auth state changes: (isSignedIn, user) */
  let onAuthChangeCallback = null;

  /** @type {{ name: string, email: string, picture: string }|null} */
  let currentUser = null;

  /** OAuth 2.0 scopes required by the application. */
  const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
  ].join(' ');

  /** Discovery documents for the Google APIs we use. */
  const DISCOVERY_DOCS = [
    'https://sheets.googleapis.com/$discovery/rest?version=v4',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  ];

  /** Maximum number of silent-refresh retries before giving up. */
  const MAX_REFRESH_RETRIES = 2;

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Fetch the authenticated user's profile from the Google UserInfo endpoint.
   *
   * @param {string} accessToken - A valid OAuth 2.0 access token.
   * @returns {Promise<{ name: string, email: string, picture: string }>}
   * @private
   */
  async function _fetchUserInfo(accessToken) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error(`UserInfo request failed with status ${res.status}`);
      }

      const info = await res.json();
      return {
        name: info.name || 'User',
        email: info.email || '',
        picture: info.picture || '',
      };
    } catch (err) {
      console.warn('[AyamAuth] Could not fetch user info:', err);
      return { name: 'User', email: '', picture: '' };
    }
  }

  /**
   * Wrap `tokenClient.requestAccessToken` in a promise so callers can await it.
   *
   * @param {{ prompt: string }} opts – Options forwarded to `requestAccessToken`.
   * @returns {Promise<google.accounts.oauth2.TokenResponse>}
   * @private
   */
  function _requestTokenAsync(opts) {
    return new Promise((resolve, reject) => {
      // Temporarily override the callback to capture the response.
      const origCb = tokenClient.callback;
      tokenClient.callback = (tokenResponse) => {
        tokenClient.callback = origCb; // restore
        if (tokenResponse.error !== undefined) {
          reject(new Error(`Token error: ${tokenResponse.error}`));
        } else {
          resolve(tokenResponse);
        }
      };
      tokenClient.error_callback = (err) => {
        tokenClient.callback = origCb;
        reject(new Error(err.type || 'Token request failed'));
      };
      tokenClient.requestAccessToken(opts);
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    /**
     * Called by the gapi `<script>` tag's `onload` attribute.
     * Loads and initialises the gapi client with the required discovery docs.
     */
    handleGapiLoad() {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS });
          gapiInited = true;
          console.info('[AyamAuth] gapi client initialised.');
          this._maybeReady();
        } catch (err) {
          console.error('[AyamAuth] gapi client init failed:', err);
        }
      });
    },

    /**
     * Called by the GIS `<script>` tag's `onload` attribute.
     * Marks GIS as loaded. Actual token-client initialisation happens in
     * {@link init} once the CLIENT_ID is known.
     */
    handleGisLoad() {
      gisInited = true;
      console.info('[AyamAuth] GIS library loaded.');
      this._maybeReady();
    },

    /**
     * Initialise the auth module with a Google OAuth Client ID.
     * Must be called once from your application entry-point (e.g. `app.js`).
     *
     * @param {string} clientId – Google OAuth 2.0 Client ID.
     * @param {(isSignedIn: boolean, user: object|null) => void} onAuthChange –
     *   Callback invoked when the authentication state changes.
     */
    init(clientId, onAuthChange) {
      if (!clientId) {
        console.error('[AyamAuth] init() called without a clientId.');
        return;
      }

      onAuthChangeCallback = onAuthChange;

      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: async (tokenResponse) => {
          if (tokenResponse.error !== undefined) {
            console.error('[AyamAuth] Token callback error:', tokenResponse);
            if (onAuthChangeCallback) onAuthChangeCallback(false, null);
            return;
          }

          currentUser = await _fetchUserInfo(tokenResponse.access_token);
          if (onAuthChangeCallback) onAuthChangeCallback(true, currentUser);
        },
      });

      console.info('[AyamAuth] Initialised with client ID.');
    },

    /**
     * Trigger the Google sign-in flow.
     * If no valid token exists, the user will see the consent screen.
     * If a token already exists (e.g. page refresh), it tries a silent refresh.
     */
    signIn() {
      if (!gapiInited || !gisInited) {
        console.warn('[AyamAuth] Google APIs not yet loaded. Cannot sign in.');
        return;
      }

      if (!tokenClient) {
        console.error('[AyamAuth] Auth not initialised. Call init() first.');
        return;
      }

      const existingToken = gapi.client.getToken();
      if (existingToken === null) {
        // First sign-in → show consent prompt
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        // Token exists → attempt silent refresh
        tokenClient.requestAccessToken({ prompt: '' });
      }
    },

    /**
     * Sign the current user out and revoke the access token.
     */
    signOut() {
      const token = gapi.client.getToken();
      if (token !== null) {
        try {
          google.accounts.oauth2.revoke(token.access_token, () => {
            console.info('[AyamAuth] Token revoked.');
          });
        } catch (err) {
          console.warn('[AyamAuth] Token revocation failed (non-critical):', err);
        }
        gapi.client.setToken(null);
      }
      currentUser = null;
      if (onAuthChangeCallback) onAuthChangeCallback(false, null);
    },

    /**
     * Check whether the user currently has a valid token.
     *
     * @returns {boolean}
     */
    isSignedIn() {
      try {
        return gapi.client.getToken() !== null;
      } catch {
        return false;
      }
    },

    /**
     * Get the current user's profile information.
     *
     * @returns {{ name: string, email: string, picture: string }|null}
     */
    getUser() {
      return currentUser;
    },

    /**
     * Ensure that a valid access token is available.
     *
     * If the current token has expired or is missing, this method silently
     * requests a new one. This should be called before any API request that
     * might fail with a 401.
     *
     * @param {number} [retryCount=0] – Internal retry counter.
     * @returns {Promise<string>} Resolves with a valid access token.
     * @throws {Error} If a new token cannot be obtained.
     */
    async ensureToken(retryCount = 0) {
      const token = gapi.client.getToken();

      // If we have a token, try a lightweight validation
      if (token && token.access_token) {
        try {
          const res = await fetch(
            'https://www.googleapis.com/oauth2/v3/tokeninfo?' +
              new URLSearchParams({ access_token: token.access_token }),
          );
          if (res.ok) {
            return token.access_token; // still valid
          }
        } catch {
          // Token check failed – fall through to refresh
        }
      }

      // Token missing or expired → request a new one silently
      if (retryCount >= MAX_REFRESH_RETRIES) {
        throw new Error('[AyamAuth] Unable to obtain a valid token after retries.');
      }

      if (!tokenClient) {
        throw new Error('[AyamAuth] Auth not initialised. Call init() first.');
      }

      try {
        const tokenResponse = await _requestTokenAsync({ prompt: '' });
        currentUser = await _fetchUserInfo(tokenResponse.access_token);
        if (onAuthChangeCallback) onAuthChangeCallback(true, currentUser);
        return tokenResponse.access_token;
      } catch (err) {
        console.warn(`[AyamAuth] Token refresh attempt ${retryCount + 1} failed:`, err);
        return this.ensureToken(retryCount + 1);
      }
    },

    /**
     * Execute an async API call with automatic 401 retry.
     *
     * Wraps any function that returns a promise, catches 401 errors, refreshes
     * the token, and retries the call once.
     *
     * @template T
     * @param {() => Promise<T>} apiCall – A function that performs the API request.
     * @returns {Promise<T>}
     */
    async withTokenRefresh(apiCall) {
      try {
        return await apiCall();
      } catch (err) {
        const status = err?.result?.error?.code || err?.status;
        if (status === 401) {
          console.info('[AyamAuth] 401 received – refreshing token and retrying…');
          await this.ensureToken();
          return await apiCall();
        }
        throw err;
      }
    },

    /**
     * Internal: invoked once both gapi and GIS are loaded.
     * @private
     */
    _maybeReady() {
      if (gapiInited && gisInited) {
        console.info('[AyamAuth] Both gapi and GIS ready.');
      }
    },
  };
})();
