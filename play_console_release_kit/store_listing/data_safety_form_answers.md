# Google Play Console: Data Safety Form Answers

When submitting your app in Google Play Console under **Policy and programs** -> **App content** -> **Data safety**, follow these exact answers to pass verification on your first attempt without policy flags.

---

## Question 1: Data collection and security
- **Does your app collect or share any of the required user data types?**  
  👉 Select: **No**  
  *(Explanation: All acoustic audio analysis is processed purely in transient RAM on-device and is never collected, stored, or transmitted).*

- **Is all of the user data collected by your app encrypted in transit?**  
  👉 Select: **Not applicable** (Since no data is collected).

- **Do you provide a way for users to request that their data is deleted?**  
  👉 Select: **Not applicable** (Since no data is collected).

---

## Question 2: Special Permissions Declarations

### Microphone Declaration (`RECORD_AUDIO`)
Google Play may ask why your app accesses the microphone:
- **Core Feature**: The microphone is used exclusively for the real-time acoustic detection of hand claps while the detector is active.
- **Audio Recording**: Audio is **NOT** recorded or saved to storage.
- **Data Transfer**: No audio data is uploaded off the device.
- **Ephemeral Processing**: Yes, audio samples exist in RAM for less than 1 second to calculate sound level decibels, then are destroyed.

### Foreground Service Declaration (Android 14 / API 34+)
Google Play requires declaring foreground service types for apps targeting Android 14+:
- **Foreground Service Type**: `microphone`
- **Use Case Description**:
  > *"The foreground service with microphone type is used exclusively to maintain background acoustic listening while the phone is locked or screen is off, enabling users to find their lost phone by clapping. The user is provided an ongoing persistent notification with a one-tap Stop button."*

---

## Question 3: Ads Declaration
- **Does your app contain ads?**  
  👉 Select: **No** (unless you integrate Google AdMob or banner ads in the future).

---

## Question 4: Target Audience and Content
- **Target Age Group**: Select **18 and over**, **13-17** (or 13+).  
  *(Do not select under 13 unless you want to comply with the strict Designed for Families policy).*
- **Appeal to Children**: Select **No**.
- **Financial Features**: Select **My app doesn't provide any financial features**.
- **Government Apps**: Select **No**.
- **Health & Medical**: Select **No**.
