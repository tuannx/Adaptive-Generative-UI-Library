import React from 'react';
import { Alert, Button, Dropdown, Form, Input, Modal, Space, Tabs, Tag, Typography } from 'antd';
import { LockOutlined, LoginOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import type { SecurityScheme } from '@aikitstudio/agul-core';
import type { AgulAuthState } from './controller.js';
import { requestToken } from './oauth.js';

const AuthContext = React.createContext<AgulAuthState | null>(null);
export const AgulAuthProvider = AuthContext.Provider;

/** The auth state of the surrounding `<AGULRenderer>`: user, grants, sign-in and sign-out. */
export function useAgulAuth(): AgulAuthState | null {
  return React.useContext(AuthContext);
}

const REASON_TEXT: Record<string, string> = {
  required: 'This API needs you to sign in.',
  expired: 'Your session has expired or was rejected. Sign in again to continue.',
};

function schemeLabel(name: string, scheme: SecurityScheme): string {
  if (scheme.type === 'http') return scheme.scheme === 'basic' ? `${name} (username & password)` : `${name} (token)`;
  if (scheme.type === 'apiKey') return `${name} (API key)`;
  if (scheme.type === 'openIdConnect') return `${name} (OpenID Connect)`;
  if (scheme.type === 'oauth2') return `${name} (OAuth 2)`;
  return name;
}

/** "Sign in" button or the signed-in user's menu, for the header. */
export function AuthMenu() {
  const auth = useAgulAuth();
  if (!auth || Object.keys(auth.schemes).length === 0) return null;

  if (!auth.user) {
    return (
      <Button size="small" type="primary" icon={<LoginOutlined />} onClick={() => auth.openSignIn('manual')} data-testid="agul-signin">
        Sign in
      </Button>
    );
  }

  const authorities = [...(auth.grants?.authorities ?? [])].filter((item) => item !== 'openid').slice(0, 8);
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          {
            key: 'who',
            disabled: true,
            label: (
              <div style={{ maxWidth: 260 }}>
                <Typography.Text strong>{auth.user.name}</Typography.Text>
                {authorities.length > 0 && (
                  <div style={{ marginTop: 4 }} data-testid="agul-user-authorities">
                    {authorities.map((item) => (
                      <Tag key={item} style={{ marginBottom: 4 }}>
                        {item}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          { type: 'divider' },
          { key: 'signout', icon: <LogoutOutlined />, label: <span data-testid="agul-signout">Sign out</span>, onClick: auth.signOut },
        ],
      }}
    >
      <Button size="small" icon={<UserOutlined />} data-testid="agul-user-menu">
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', verticalAlign: 'bottom' }}>
          {auth.user.name}
        </span>
      </Button>
    </Dropdown>
  );
}

/** The sign-in dialog opened from the header, or automatically when the API answers 401. */
export function SignInModal() {
  const auth = useAgulAuth();
  if (!auth || Object.keys(auth.schemes).length === 0) return null;
  return (
    <Modal
      open={auth.signIn.open}
      title={
        <Space>
          <LockOutlined /> Sign in
        </Space>
      }
      footer={null}
      onCancel={auth.closeSignIn}
      destroyOnHidden
      data-testid="agul-signin-modal"
    >
      <SignInPanel />
    </Modal>
  );
}

/** One tab per security scheme, each with the form its flow needs. */
export function SignInPanel() {
  const auth = useAgulAuth();
  if (!auth) return null;
  const entries = Object.entries(auth.schemes);
  const notice = auth.signIn.error ?? (auth.signIn.reason ? REASON_TEXT[auth.signIn.reason] : undefined);

  return (
    <div data-testid="agul-signin-panel">
      {notice && (
        <Alert
          style={{ marginBottom: 16 }}
          type={auth.signIn.error ? 'error' : 'info'}
          showIcon
          title={notice}
          data-testid="agul-signin-notice"
        />
      )}
      {entries.length === 1 ? (
        <SchemeForm name={entries[0][0]} scheme={entries[0][1]} />
      ) : (
        <Tabs
          items={entries.map(([name, scheme]) => ({
            key: name,
            label: schemeLabel(name, scheme),
            children: <SchemeForm name={name} scheme={scheme} />,
          }))}
        />
      )}
    </div>
  );
}

function useSubmit() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const run = async (task: () => Promise<void> | void) => {
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function SchemeForm({ name, scheme }: { name: string; scheme: SecurityScheme }) {
  const auth = useAgulAuth()!;
  const { busy, error, run } = useSubmit();
  const errorAlert = error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} data-testid="agul-signin-error" />;
  const description = scheme.description && <Typography.Paragraph type="secondary">{scheme.description}</Typography.Paragraph>;

  if (scheme.type === 'apiKey') {
    if (scheme.in === 'cookie') {
      return <Alert type="info" showIcon title={`${name} uses the "${scheme.name}" cookie, which the API's own login sets.`} />;
    }
    return (
      <Form layout="vertical" onFinish={({ value }) => auth.setCredential(name, { kind: 'apiKey', value: String(value).trim() })}>
        {description}
        <Form.Item name="value" label={`${scheme.name} (${scheme.in})`} rules={[{ required: true, whitespace: true, message: 'Enter the API key' }]}>
          <Input.Password autoFocus data-testid="agul-signin-apikey" />
        </Form.Item>
        <Button type="primary" htmlType="submit" data-testid="agul-signin-submit">
          Save key
        </Button>
      </Form>
    );
  }

  if (scheme.type === 'http' && scheme.scheme === 'basic') {
    return (
      <Form
        layout="vertical"
        onFinish={({ username, password }) => auth.setCredential(name, { kind: 'basic', username: String(username), password: String(password ?? '') })}
      >
        {description}
        <UsernamePassword />
        <Button type="primary" htmlType="submit" data-testid="agul-signin-submit">
          Sign in
        </Button>
      </Form>
    );
  }

  if (scheme.type === 'http') {
    return (
      <Form layout="vertical" onFinish={({ token }) => auth.setCredential(name, { kind: 'token', accessToken: String(token).trim().replace(/^Bearer\s+/i, '') })}>
        {description}
        <Form.Item name="token" label={`${scheme.bearerFormat ?? 'Bearer'} token`} rules={[{ required: true, whitespace: true, message: 'Paste a token' }]}>
          <Input.TextArea autoFocus rows={3} data-testid="agul-signin-token" />
        </Form.Item>
        <Button type="primary" htmlType="submit" data-testid="agul-signin-submit">
          Use token
        </Button>
      </Form>
    );
  }

  if (scheme.type === 'openIdConnect' || scheme.type === 'oauth2') {
    const flows = scheme.type === 'oauth2' ? scheme.flows : undefined;
    const redirectFlow = scheme.type === 'openIdConnect' ? 'openIdConnect' : flows?.authorizationCode ? 'authorizationCode' : flows?.implicit ? 'implicit' : undefined;
    const needsClientId = !auth.options.oauth?.clientId;
    const scopes = auth.scopesFor(name);

    return (
      <Form
        layout="vertical"
        initialValues={{ clientId: auth.options.oauth?.clientId }}
        onFinish={(values) =>
          run(async () => {
            const clientId = values.clientId ?? auth.options.oauth?.clientId;
            if (values.username !== undefined && flows?.password?.tokenUrl) {
              const credential = await requestToken(flows.password.tokenUrl, {
                grant_type: 'password',
                username: values.username,
                password: values.password,
                client_id: clientId,
                client_secret: auth.options.oauth?.clientSecret,
                scope: scopes.join(' '),
              });
              auth.setCredential(name, credential);
            } else if (values.clientSecret !== undefined && flows?.clientCredentials?.tokenUrl) {
              const credential = await requestToken(flows.clientCredentials.tokenUrl, {
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: values.clientSecret,
                scope: scopes.join(' '),
              });
              auth.setCredential(name, credential);
            } else if (redirectFlow) {
              await auth.startRedirect(name, redirectFlow, clientId);
            }
          })
        }
      >
        {description}
        {errorAlert}
        {scopes.length > 0 && (
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            Scopes: {scopes.join(' ')}
          </Typography.Paragraph>
        )}
        {needsClientId && (
          <Form.Item name="clientId" label="Client ID" rules={[{ required: true, whitespace: true, message: 'Enter the client id' }]}>
            <Input data-testid="agul-signin-client-id" />
          </Form.Item>
        )}
        {flows?.password && !redirectFlow && <UsernamePassword />}
        {flows?.clientCredentials && !redirectFlow && !flows.password && (
          <Form.Item name="clientSecret" label="Client secret" rules={[{ required: true }]} extra="Only for testing: a secret typed into a browser is not secret.">
            <Input.Password />
          </Form.Item>
        )}
        <Button type="primary" htmlType="submit" loading={busy} icon={<LoginOutlined />} data-testid="agul-signin-submit">
          {redirectFlow ? `Continue with ${name}` : 'Sign in'}
        </Button>
      </Form>
    );
  }

  return <Alert type="warning" showIcon title={`${name} (${scheme.type}) can't be used from a browser.`} />;
}

function UsernamePassword() {
  return (
    <>
      <Form.Item name="username" label="Username" rules={[{ required: true, whitespace: true, message: 'Enter your username' }]}>
        <Input autoFocus autoComplete="username" data-testid="agul-signin-username" />
      </Form.Item>
      <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password' }]}>
        <Input.Password autoComplete="current-password" data-testid="agul-signin-password" />
      </Form.Item>
    </>
  );
}
