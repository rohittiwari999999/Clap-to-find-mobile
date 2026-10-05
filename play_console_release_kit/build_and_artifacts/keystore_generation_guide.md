# Android Release Keystore Generation Guide

Google Play requires that all apps be digitally signed with an upload key. Our GitHub Actions workflow automatically generates a signing key if one isn't provided, but if you want to generate your own personal permanent key, follow this guide.

---

## 1. How to Generate Your Own Keystore Locally

Run this command in your computer's terminal (or Git Bash / Android Studio terminal):

```bash
keytool -genkey -v -keystore my-upload-key.jks \
  -storepass your_secure_password \
  -alias my-key-alias \
  -keypass your_secure_password \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Abhinav, OU=Mobile, O=AppDev, L=Delhi, S=Delhi, C=IN"
```

> **IMPORTANT**: Keep `my-upload-key.jks` and your passwords safe! Google Play requires this key for all future app updates.

---

## 2. Converting Keystore to Base64 for GitHub Actions

To let GitHub Actions use your keystore securely without committing private keys to the repository:

**On Mac / Linux:**
```bash
base64 -w 0 my-upload-key.jks > keystore_base64.txt
```

**On Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("my-upload-key.jks")) | Out-File -Encoding ASCII keystore_base64.txt
```

---

## 3. Adding Secrets to GitHub Repository

1. Open your GitHub Repository: `https://github.com/rohittiwari999999/clap-to-find-phone`
2. Go to **Settings** -> **Secrets and variables** -> **Actions**
3. Click **"New repository secret"** and add:
   - `KEYSTORE_BASE64`: The full text from `keystore_base64.txt`
   - `KEY_ALIAS`: `my-key-alias`
   - `KEY_PASSWORD`: `your_secure_password`
   - `STORE_PASSWORD`: `your_secure_password`

When GitHub Actions runs, it will decode this secret and produce an officially signed `.aab` for Google Play!
