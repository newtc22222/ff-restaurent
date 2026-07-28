import type { User } from '@/api/types';

export const uniqueUsers = (users: User[], fallback: User): User[] => {
  const byId = new Map<string, User>();
  [...users, fallback].forEach((member) => byId.set(member.id, member));
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
