import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import AzureAd from "next-auth/providers/azure-ad";

import type { NextAuthConfig, Session } from 'next-auth';

export const config = {
  theme: {
    logo: 'https://next-auth.js.org/img/logo/logo-sm.png',
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          access_type: 'offline',
          prompt: 'consent',
          scope: [
            'openid',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/calendar',
            // Add more scope URLs as needed
          ].join(' '),
          response_type: 'code',
        },
      },
    }),
    AzureAd({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      tenantId: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID,
    })
  ],
  basePath: '/api/auth',
  callbacks: {
    authorized({ request, auth }) {
      return !!auth;
    },
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          access_token: account.access_token,
          issued_at: Date.now(),
          expires_at: Date.now() + Number(account.expires_in) * 1000,
          refresh_token: account.refresh_token,
          provider: account.provider,
        };
      } else if (Date.now() < Number(token.expires_at)) {
        return token;
      } else {
        console.log('Access token expired, getting new one');
        try {
          let response;
          if (token.provider === 'azure-ad') {
            response = await fetch(`https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/oauth2/v2.0/token`, {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID as string,
                client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET as string,
                grant_type: 'refresh_token',
                refresh_token: token.refresh_token as string,
              }),
              method: 'POST',
            });
          } else if (token.provider === 'google') {
            response = await fetch('https://oauth2.googleapis.com/token', {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: process.env.AUTH_GOOGLE_ID as string,
                client_secret: process.env.AUTH_GOOGLE_SECRET as string,
                grant_type: 'refresh_token',
                refresh_token: token.refresh_token as string,
              }),
              method: 'POST',
            });
          } else {
            throw new Error('Unknown provider');
          }

          const tokens = await response.json();

          if (!response.ok) throw tokens;

          return {
            ...token,
            access_token: tokens.access_token,
            expires_at: Date.now() + Number(tokens.expires_in) * 1000,
            refresh_token: tokens.refresh_token ?? token.refresh_token,
          };
        } catch (error) {
          console.error('Error refreshing access token', error);
          return { ...token, error: 'RefreshAccessTokenError' as const };
        }
      }
    },
    async session({ session, token }) {
      console.log('Incoming session info: ', session);
      return {
        ...session,
        accessToken: String(token.access_token),
        refreshToken: String(token.refresh_token),
        accessTokenIssuedAt: Number(token.issued_at),
        accessTokenExpiresAt: Number(token.expires_at),
        provider: token.provider as string,
      } satisfies EnrichedSession;
    },
  },
} satisfies NextAuthConfig;

export interface EnrichedSession extends Session {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  accessTokenIssuedAt: number;
  provider: string;
}

export const { handlers, auth, signIn, signOut } = NextAuth(config);