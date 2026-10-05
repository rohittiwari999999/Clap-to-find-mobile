# Privacy Policy for Clap to Find Phone: Siren Pro

**Last Updated:** October 2026

This Privacy Policy explains how **Clap to Find Phone: Siren Pro** ("we", "our", or "the application") handles user information and device permissions. We are committed to protecting your privacy and ensuring transparency regarding how hardware capabilities are utilized.

---

## 1. Zero Personal Data Collection

**Clap to Find Phone: Siren Pro** is built with strict privacy-by-design principles:
- We **do not collect, harvest, store, or transmit** any personally identifiable information (PII).
- We **do not collect** names, email addresses, phone numbers, location data, or device identifiers.
- The application operates **100% locally on your device** and does not require an account or registration.

---

## 2. Permissions & Hardware Usage

To provide its core functionality, the app requests the following Android runtime permissions:

### A. Microphone Permission (`android.permission.RECORD_AUDIO`)
- **Purpose**: Required strictly to detect ambient acoustic transients (such as hand claps).
- **Ephemeral Processing**: The incoming audio stream is analyzed in real-time in volatile device RAM solely to measure amplitude and spectral spikes.
- **NO Audio Recording**: Audio data is **NEVER recorded, NEVER stored in persistent memory, and NEVER transmitted over the internet**. Audio frames are discarded milliseconds after acoustic amplitude calculation.

### B. Camera Permission (`android.permission.CAMERA`)
- **Purpose**: Required exclusively to control the device's camera LED flash (Torch / Flashlight) for the visual strobe alert.
- **NO Photography**: The app never activates camera image sensors, captures photos, or records video.

### C. Vibration Permission (`android.permission.VIBRATE`)
- **Purpose**: Enables the device's internal vibration motor to pulse during an active alarm alert.

### D. Foreground Service & Notification Permissions (`android.permission.FOREGROUND_SERVICE`, `android.permission.POST_NOTIFICATIONS`)
- **Purpose**: In accordance with Google Play and Android 14+ background execution guidelines, an ongoing persistent notification is displayed while the detector is active, ensuring transparent user awareness and preventing the operating system from terminating the acoustic listener when the screen is locked.

---

## 3. Data Sharing & Third Parties

- We do **not** sell, rent, or share any data with third parties.
- The app contains **no third-party tracking SDKs**, analytics cookies, or behavioral advertising trackers.

---

## 4. Children’s Privacy

Because the application collects no personal information whatsoever, it complies with the Children’s Online Privacy Protection Act (COPPA) and General Data Protection Regulation (GDPR). It is safe for users of all age groups.

---

## 5. Changes to This Privacy Policy

We may update our Privacy Policy periodically to reflect new Android OS requirements. Any updates will be published with a revised "Last Updated" date.

---

## 6. Contact Us

If you have any questions or feedback regarding this Privacy Policy, please contact:
- **Developer Email**: `sarita.abhinav.t@gmail.com`
- **Application**: Clap to Find Phone: Siren Pro
