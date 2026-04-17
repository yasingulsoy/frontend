export type SophosIdType = "organization" | "partner" | "tenant" | string;

/**
 * whoami `apiHosts`: tenant için `dataRegion` = gerçek tenant API host’u (bölgesel);
 * `global` çoğunlukla yalnızca org/partner dizin API’leri içindir.
 */
export type WhoAmIResponse = {
  id: string;
  idType: SophosIdType;
  apiHosts?: {
    global?: string;
    dataRegion?: string;
  } & Record<string, string | undefined>;
};

export type TenantRow = {
  id: string;
  name?: string;
  apiHost: string;
  dataRegion?: string;
};

export type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  errorCode?: string;
  message?: string;
};
