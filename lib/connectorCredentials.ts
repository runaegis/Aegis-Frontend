import { CONNECTORS, type ConnectorId } from '@/components/ui/ConnectorMark';
import type { ConnectorCatalogItem, PrivateConnectorCredentialStatus } from '@/lib/types';

export type CredentialFieldDef = {
  key: string;
  label: string;
  description: string | null;
  required: boolean;
  secret: boolean;
  placeholder?: string;
  inputType?: 'text' | 'password' | 'url';
};

const FALLBACK_PRIVATE_SCHEMAS: Record<
  string,
  {
    required: string[];
    properties: Record<
      string,
      {
        title: string;
        description: string;
        placeholder?: string;
        secret?: boolean;
        type?: 'text' | 'password' | 'url';
      }
    >;
  }
> = {
  github: {
    required: ['github_pat'],
    properties: {
      github_pat: {
        title: 'GitHub PAT',
        description: 'Personal access token used to call GitHub on your behalf.',
        placeholder: 'ghp_…',
        secret: true,
        type: 'password',
      },
    },
  },
  postgres: {
    required: ['connection_string'],
    properties: {
      connection_string: {
        title: 'Connection string',
        description: 'PostgreSQL connection URL for your database user.',
        placeholder: 'postgresql://user:password@host:5432/dbname',
        secret: true,
        type: 'password',
      },
    },
  },
  mongodb: {
    required: ['connection_string'],
    properties: {
      connection_string: {
        title: 'Connection string',
        description: 'MongoDB connection URI for your database user.',
        placeholder: 'mongodb+srv://user:password@cluster/dbname',
        secret: true,
        type: 'password',
      },
    },
  },
  linear: {
    required: ['api_key'],
    properties: {
      api_key: {
        title: 'API key',
        description: 'Personal Linear API key.',
        placeholder: 'lin_api_…',
        secret: true,
        type: 'password',
      },
    },
  },
  jira: {
    required: ['url', 'username', 'api_token'],
    properties: {
      url: {
        title: 'Jira URL',
        description: 'Your Jira base URL.',
        placeholder: 'https://your-company.atlassian.net',
        secret: false,
        type: 'url',
      },
      username: {
        title: 'Jira username',
        description: 'Usually the email address tied to your Jira account.',
        placeholder: 'you@company.com',
        secret: false,
        type: 'text',
      },
      api_token: {
        title: 'Jira API token',
        description: 'API token used for Jira REST calls.',
        placeholder: '••••••••••••',
        secret: true,
        type: 'password',
      },
    },
  },
  terraform: {
    required: ['url', 'api_token'],
    properties: {
      url: {
        title: 'Terraform URL',
        description: 'Terraform Cloud or Terraform Enterprise base URL.',
        placeholder: 'https://app.terraform.io',
        secret: false,
        type: 'url',
      },
      api_token: {
        title: 'Terraform API token',
        description: 'Terraform API token used for Terraform API access.',
        placeholder: '••••••••••••',
        secret: true,
        type: 'password',
      },
    },
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isKnownConnectorId(key: string): key is ConnectorId {
  return Object.prototype.hasOwnProperty.call(CONNECTORS, key);
}

export function parsePrivateCredentialFields(
  connectorKey: string,
  catalogItem: ConnectorCatalogItem | null,
): CredentialFieldDef[] {
  const raw = catalogItem?.private_config_schema ?? null;
  const schema = asRecord(raw);
  const properties = asRecord(schema?.properties);
  const requiredRaw = schema?.required;
  const required = Array.isArray(requiredRaw)
    ? requiredRaw.filter((v): v is string => typeof v === 'string')
    : [];

  const fallback = FALLBACK_PRIVATE_SCHEMAS[connectorKey];
  const keys = properties ? Object.keys(properties) : fallback ? Object.keys(fallback.properties) : [];

  return keys
    .map((key): CredentialFieldDef | null => {
      const p = properties ? asRecord(properties[key]) : null;
      const f = fallback?.properties?.[key];
      const label =
        (typeof p?.title === 'string' && p.title.trim()) ||
        f?.title ||
        key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const description =
        (typeof p?.description === 'string' ? p.description : null) ??
        (typeof f?.description === 'string' ? f.description : null);

      const lower = key.toLowerCase();
      const secret = !!f?.secret || /token|pat|secret|password|key|connection/.test(lower);

      const inputType: CredentialFieldDef['inputType'] =
        f?.type ?? (lower.includes('url') ? 'url' : secret ? 'password' : 'text');

      const placeholder =
        f?.placeholder ?? (typeof p?.examples === 'string' ? p.examples : undefined);

      return {
        key,
        label,
        description,
        required: required.includes(key) || !!fallback?.required.includes(key),
        secret,
        placeholder,
        inputType,
      };
    })
    .filter((f): f is CredentialFieldDef => f !== null)
    .sort((a, b) => Number(b.required) - Number(a.required) || a.label.localeCompare(b.label));
}

export function connectorNeedsAttention(
  status: PrivateConnectorCredentialStatus | null | undefined,
): boolean {
  if (!status) return false;
  return Boolean(status.last_error) || Boolean(status.revoked_at);
}

export function connectorAttentionLabel(
  status: PrivateConnectorCredentialStatus | null | undefined,
): string | null {
  if (!status) return null;
  const error = status.last_error?.trim();
  if (error) return error;
  if (status.revoked_at) return 'revoked';
  return null;
}
