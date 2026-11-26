export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  /** home-auth avatar URL; null when the user has none (the initial is shown instead). */
  avatarUrl: string | null;
}
