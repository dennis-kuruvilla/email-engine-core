import { Injectable } from '@nestjs/common';
import { AuthorizationCode } from 'simple-oauth2';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class MicrosoftAuthService {
  private client: AuthorizationCode;

  constructor() {
    this.client = new AuthorizationCode({
      client: {
        id: process.env.MICROSOFT_CLIENT_ID,
        secret: process.env.MICROSOFT_CLIENT_SECRET,
      },
      auth: {
        tokenHost: 'https://login.microsoftonline.com',
        authorizePath: '/consumers/oauth2/v2.0/authorize',
        tokenPath: '/consumers/oauth2/v2.0/token',
      },
    });
  }

  getAuthorizationUrl(userId: string): string {
    const state = JSON.stringify({ userId });
    const authorizationUri = this.client.authorizeURL({
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
      scope: ['Mail.Read', 'User.Read'].join(' '),
      state: encodeURIComponent(state),
    });
    return authorizationUri;
  }

  decodeState(state: string): string {
    const decodedState = JSON.parse(decodeURIComponent(state));
    return decodedState.userId;
  }

  async getTokenFromCode(code: string): Promise<any> {
    const tokenParams = {
      code,
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
      scope: ['Mail.Read', 'User.Read'].join(' '),
    };
    const accessToken = await this.client.getToken(tokenParams);
    return accessToken.token;
  }

  async getEmailFromGraph(accessToken: string): Promise<string | null> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    return data.mail;
  }

  async fetchEmails(accessToken: string) {
    const response = await axios.get(
      'https://graph.microsoft.com/v1.0/me/messages',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return response.data;
  }
}
