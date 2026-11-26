import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrentUser } from '../../domain/user';
import { PageHeader } from './PageHeader';

let currentUser: CurrentUser | null = null;
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: currentUser,
    loading: false,
    logout: vi.fn<() => Promise<void>>(),
  }),
}));

const user = (avatarUrl: string | null): CurrentUser => ({
  id: 'u1',
  email: 'ada@example.test',
  name: 'Ada',
  avatarUrl,
});

function renderHeader() {
  return render(
    <MemoryRouter>
      <PageHeader />
    </MemoryRouter>,
  );
}

describe('PageHeader avatar', () => {
  beforeEach(() => {
    currentUser = null;
  });

  it('shows the avatar image, the button name unchanged', () => {
    currentUser = user('https://auth.example.test/avatars/u1');
    const { container } = renderHeader();

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://auth.example.test/avatars/u1');
    expect(img).toHaveAttribute('alt', '');
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeVisible();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('falls back to the initial without avatar', () => {
    currentUser = user(null);
    const { container } = renderHeader();

    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Account menu' }),
    ).toHaveTextContent('A');
  });

  it('falls back to the initial when the image fails to load', () => {
    currentUser = user('https://auth.example.test/avatars/u1');
    const { container } = renderHeader();

    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Account menu' }),
    ).toHaveTextContent('A');
  });

  it('tries a new URL after a failed one', () => {
    currentUser = user('https://auth.example.test/avatars/u1');
    const { container, rerender } = renderHeader();
    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    currentUser = user('https://auth.example.test/avatars/u1?v=2');
    rerender(
      <MemoryRouter>
        <PageHeader />
      </MemoryRouter>,
    );

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://auth.example.test/avatars/u1?v=2',
    );
  });
});
