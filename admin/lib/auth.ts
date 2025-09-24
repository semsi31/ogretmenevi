// lib/auth.ts
"use client";

import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';

export type Role = 'viewer' | 'editor' | 'admin';

export function useRole(): Role {
	const [role, setRole] = useState<Role>('viewer');
	useEffect(() => {
		(async () => {
			try {
				const session: any = await getSession();
				const r = (session?.role as Role) || readRoleCookie();
				setRole(validRole(r));
			} catch {
				setRole('viewer');
			}
		})();
	}, []);
	return role;
}

export const canEdit = (role: Role) => role === 'editor' || role === 'admin';
export const canDelete = (role: Role) => role === 'admin';

function readRoleCookie(): Role | undefined {
	const cookie = typeof document !== 'undefined' ? document.cookie : '';
	const m = cookie.match(/(?:^|; )role=([^;]+)/);
	return m ? (decodeURIComponent(m[1]) as Role) : undefined;
}

function validRole(r?: string): Role {
	return r === 'admin' || r === 'editor' || r === 'viewer' ? (r as Role) : 'viewer';
}
