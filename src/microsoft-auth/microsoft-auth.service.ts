import { Injectable } from '@nestjs/common';
import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';

@Injectable()
export class MicrosoftAuthService {
  private msalClient: ConfidentialClientApplication;

  constructor() {
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        //set tenatnId to 'consumers' for personal accounts
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      },
    });
  }

  async getAuthorizationUrl(userId: string) {
    const state = encodeURIComponent(JSON.stringify({ userId }));
    const authCodeUrlParams = {
      scopes: ['https://outlook.office.com/IMAP.AccessAsUser.All'],
      redirectUri: process.env.MICROSOFT_REDIRECT_URI,
      state: state,
    };
    return await this.msalClient.getAuthCodeUrl(authCodeUrlParams);
  }

  decodeState(state: string): string {
    const decodedState = JSON.parse(decodeURIComponent(state));
    return decodedState.userId;
  }

  async getTokenFromCode(code: string): Promise<any> {
    const tokenRequest = {
      code: code,
      scopes: ['https://outlook.office.com/IMAP.AccessAsUser.All'],
      redirectUri: process.env.MICROSOFT_REDIRECT_URI,
    };

    const response = await this.msalClient.acquireTokenByCode(tokenRequest);
    return response;
  }

  async getEmailFromGraph(accessToken: string): Promise<string | null> {
    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.mail;
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
