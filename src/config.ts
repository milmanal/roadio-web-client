// Static client config. Runtime/server-driven config comes from the backend
// `Configuration` object (see src/types). This is just build-time constants.

// IMPORTANT: the backend parses `version` as a PEP440 package version
// (packaging.version.Version). Non-PEP440 strings like "0.1.0-web" make /v2/*
// routes 500. Keep this numeric/dotted and >= the backend's minimum.
export const APP_VERSION = '3.0.0'

// All backend calls are prefixed with /api and forwarded by the Vite dev proxy
// (which injects HTTP Basic auth). In production this prefix must be served by
// an equivalent reverse proxy / BFF.
export const API_PREFIX = '/api'

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''

// Default locale; backend serves mixed Hebrew/English. 'he' is RTL.
export const DEFAULT_LOCALE = 'he'
