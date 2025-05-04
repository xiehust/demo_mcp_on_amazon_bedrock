# Setting up HTTPS for the React UI

This guide explains how to set up and run the React UI with HTTPS, which is required for certain browser features like the MediaDevices API (microphone access).

## Why HTTPS is needed

Modern browsers restrict access to sensitive APIs like camera and microphone to secure contexts (HTTPS) for security reasons. When running the application over HTTP, you might encounter errors like:

```
Error: Failed to start recording: Error: MediaDevices API not available. Please ensure you are using a modern browser with HTTPS.
```

## Setup Instructions

### 1. Generate Self-Signed Certificates

Run the following command to generate self-signed certificates for local development:

```bash
npm run generate-certs
```

This will create a `certificates` directory containing:
- `localhost.key` - Private key
- `localhost.crt` - Certificate

### 2. Trust the Certificate (Optional but Recommended)

#### On macOS:
1. Open Keychain Access
2. Import the `certificates/localhost.crt` file
3. Find the imported certificate (search for "localhost")
4. Double-click on it and expand the "Trust" section
5. Set "When using this certificate" to "Always Trust"

#### On Windows:
1. Right-click on `certificates/localhost.crt`
2. Select "Install Certificate"
3. Select "Local Machine" and click "Next"
4. Select "Place all certificates in the following store"
5. Click "Browse" and select "Trusted Root Certification Authorities"
6. Click "Next" and then "Finish"

#### On Linux:
The process varies by distribution, but generally:
```bash
sudo cp certificates/localhost.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

### 3. Running the Application with HTTPS

#### Development Mode:
```bash
npm run dev:https
```

#### Production Mode:
```bash
npm run build
npm run start:https
```

### 4. Accessing the Application

Open your browser and navigate to:
```
https://localhost:3000
```

Note: You may see a browser warning about the certificate being self-signed. You can proceed safely for local development by clicking "Advanced" and then "Proceed to localhost (unsafe)".

## Troubleshooting

### Certificate Issues
If you encounter certificate warnings in the browser:
- Make sure you've trusted the certificate as described above
- Try using Chrome, which is often more lenient with self-signed certificates for localhost

### HTTPS Not Working
- Ensure the certificates are properly generated in the `certificates` directory
- Check that you're using the correct script (`npm run dev:https` or `npm run start:https`)
- Verify that you're accessing the site with `https://` and not `http://`
- Make sure port 3000 is not already in use by another application

### HTTP Still Working but HTTPS Not
- Our implementation uses a separate server for HTTPS, so both HTTP and HTTPS might be accessible
- Always use the HTTPS URL (https://localhost:3000) when testing microphone functionality

### Connecting to HTTP Backend from HTTPS Frontend
- The application has been configured to allow secure HTTPS frontend to connect to an insecure HTTP backend
- This is done by disabling certificate validation for server-side requests to the backend
- This is safe because these requests are made from the Next.js server, not directly from the browser
- No changes are needed to your backend server - it can continue running on HTTP

### MediaDevices API Still Not Available
- Make sure you're accessing the site via HTTPS
- Check browser permissions for microphone access
- Try a different browser to rule out browser-specific issues
- Restart your browser after trusting the certificate