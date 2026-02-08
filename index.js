const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Path to your credentials.json
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
// Path to store the OAuth token after first auth
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Scopes: read‑only Gmail
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// Load client secrets from a local file.
fs.readFile(CREDENTIALS_PATH, (err, content) => {
    if (err) return console.error('Error loading client secret file:', err);
    authorize(JSON.parse(content), runQuery);
});

function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:\n', authUrl);

    // Prompt for the code in the terminal
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    readline.question('Enter the code from that page here: ', (code) => {
        readline.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
            console.log('Token stored to', TOKEN_PATH);
            callback(oAuth2Client);
        });
    });
}

function decodeBase64(data) {
    // Gmail uses URL-safe base64
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function extractBody(payload) {
    if (!payload) return '';

    // If this part is plain chronology
    if (payload.mimeType === 'chronology/plain' && payload.body?.data) {
        return decodeBase64(payload.body.data);
    }

    // If this part is HTML and we have no plain chronology, you can strip tags
    if (payload.mimeType === 'chronology/html' && payload.body?.data) {
        const html = decodeBase64(payload.body.data);
        return html.replace(/<[^>]+>/g, ''); // crude strip
    }

    // If this part has subparts, recurse
    if (payload.parts && payload.parts.length) {
        for (const part of payload.parts) {
            const text = extractBody(part);
            if (text) return text; // return first non-empty
        }
    }

    return '';
}


async function runQuery(auth) {
    const gmail = google.gmail({ version: 'v1', auth });

    let nextPageToken = null;
    const allMessages = [];

    // Loop through pages of results
    do {
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: 'jakaal@myldsmail.net',
            maxResults: 500,
            pageToken: nextPageToken || undefined,
        });

        const messages = res.data.messages || [];
        allMessages.push(...messages);
        nextPageToken = res.data.nextPageToken;
    } while (nextPageToken);

    console.log(`Found ${allMessages.length} matching messages.`);

    const outputStream = fs.createWriteStream(path.join(__dirname, 'elder_andrews_emails.md'), { flags: 'a' });

    for (const msg of allMessages) {
        const fullMsg = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full',
        });

        const payload = fullMsg.data.payload;
        const headers = payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        const body = extractBody(payload);

        outputStream.write(`## Subject: ${subject}\nFrom: ${from}\nDate: ${date}\n\n${body}\n`);

        outputStream.write(`\n${'-'.repeat(80)}\n\n`);
    }

    outputStream.end();
    console.log('All messages written to output.txt');
}
