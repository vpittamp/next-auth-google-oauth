import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { auth, EnrichedSession } from 'auth';
import { Client } from '@microsoft/microsoft-graph-client';

export async function GET(request: Request) {
  const session = (await auth()) as EnrichedSession;

  console.log('Session inside the route ', session);

  if (!session) {
    return new Response('Unauthorized', {
      status: 401,
    });
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  const accessToken = session?.accessToken;
  const refreshToken = session?.refreshToken;
  

  const client = Client.init({
        authProvider: (done) =>
          done(
            null,
            accessToken // WHERE DO WE GET THIS FROM?
          ),
      });
  
  const sendMail = {
        message: {
          subject: 'Meet for lunch?',
          body: { contentType: 'Text', content: 'The new cafeteria is open.' },
          toRecipients: [
            { emailAddress: { address: 'vpittamp@gmail.com' } },
          ],
        },
      };
  
  const userDetails = await client.api('/me/sendMail').post(sendMail);

  // return void
  return new Response('Mail sent successfully', {
    status: 200,
  });
}
