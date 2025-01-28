# Email Engine Core

This is a backend service developed using NestJS.

## Functionalities

- **User Authentication Endpoints**: 
  - Uses PostgreSQL to store user information.
  - Uses Elasticsearch to store bulk email information.

- **Outlook Mail Linking and Syncing**:
  - Users can link their Outlook mail through OAuth2.
  - Access tokens are stored in the database.
  - Email sync and real-time sync happen in the background using Bull queues (Redis is implemented for the queues to work).
  - The process is scalable as syncing is done in batches of 50 and in the background.

- **IMAP Protocol**:
  - Fetches emails and gets real-time updates.
  - Currently supports Outlook only but is written to be extendable to other providers.

- **Elasticsearch**:
  - Indexes email and mailbox data.
  - Automatically creates indexes on app startup.

- **WebSockets**:
  - Sends real-time email updates to the client.

## Steps to Run

1. Copy `.env.example` into `.env.docker`.

2. Add the following environment variables for the Microsoft registered app you are using:
   - `MICROSOFT_CLIENT_ID`
   - `MICROSOFT_TENANT_ID`
   - `MICROSOFT_CLIENT_SECRET`
   - `MICROSOFT_REDIRECT_URI`

3. Run the following command to start the service, PostgreSQL, Elasticsearch, and Redis:
  ```
docker-compose up
```

4. Refer to the email-core-requests.http file to see the sample HTTP requests you can make. You can install the HTTP client in VS Code to run those in the editor itself.
