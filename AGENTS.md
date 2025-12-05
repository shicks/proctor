# **Proctor Timer \- Project Documentation**

## **1\. Project Overview**

**Proctor Timer** is a specialized, mobile-first web application designed for test proctors. Its primary function is to countdown a specific duration (default: 30 mins) and provide audible and physical (haptic) alerts at specific checkpoints (e.g., 15, 10, 5 minutes remaining).

**Core Constraint:** The application is designed to run reliably on mobile devices even when the user places the phone in their pocket, which typically triggers aggressive battery-saving measures by the OS that kill JavaScript execution.

## **2\. Technical Architecture**

### **Architecture: Multi-File PWA**

The application is a Progressive Web App structured with separate files for maintainability and clarity.

*   **`index.html`**: The main HTML entry point.
*   **`styles.css`**: Custom styles for the application. Tailwind CSS is used via CDN for utility classes.
*   **`app.js`**: Contains the main application logic, including UI manipulation, state management, and event handling.
*   **`worker.js`**: A dedicated Web Worker that manages the countdown timer on a separate thread to prevent it from being paused by the OS.
*   **`manifest.json`**: The PWA manifest file, enabling "Add to Home Screen" functionality.

### **Key Components**

#### **A. The "Pocket Mode" (Fake Sleep)**

Mobile browsers (iOS Safari & Android Chrome) pause JavaScript execution when the hardware screen lock is pressed. To bypass this:

1. **UI Overlay:** A full-screen, black overlay (\#pocket-overlay) simulates a screen-off state to save battery on OLED screens.  
2. **Wake Lock API:** The navigator.wakeLock API is used to prevent the physical screen from actually turning off.  
3. **User Instruction:** The user is explicitly warned *not* to press the hardware power button.

#### **B. The Audio Subsystem Hack**

Even with a Wake Lock, background tabs or inactive interactions can sometimes be throttled.

* **Strategy:** We initialize an AudioContext and play a continuous loop of generated **White Noise** at a very low volume (effectively silent to the human ear but "active" to the OS).  
* **Purpose:** This tricks the operating system into classifying the browser tab as "Media Playback," granting it higher priority and preventing background throttling.

#### **C. Web Worker Timer**

* **Implementation:** The timer logic resides in the `worker.js` file and runs on a separate thread.
* **Reason:** The main thread can be blocked by UI rendering or user interaction. Workers are more resistant to timing drift.
* **Loading:** The worker is instantiated in `app.js` via `new Worker('worker.js')`.

#### **D. PWA Manifest**

* **Implementation:** A static `manifest.json` file is linked in the `<head>` of `index.html`.
* **Purpose:** Allows Android devices to "Install App" and launch in standalone mode (no browser address bar).

## **3\. Configuration & State**

* **Input Format:** TotalMinutes, Alert1, Alert2, Alert3... (e.g., 30, 15, 10, 5).  
* **Persistence:** Configuration is saved to localStorage under the key proctorConfig.  
* **Safety:** The configuration input is disabled while the timer is running.

## **4\. File Structure**

*   **`index.html`**: The main HTML file containing the user interface structure.
*   **`styles.css`**: Contains all custom CSS rules for the application.
*   **`app.js`**: Handles user interactions, UI updates, and communication with the worker.
*   **`worker.js`**: Manages the core timer logic in the background.
*   **`manifest.json`**: Provides PWA metadata.

## **5\. Known Limitations & Edge Cases**

* **Hardware Lock:** If the user ignores instructions and presses the physical power button, the timer **will pause** on most devices.  
* **Audio Policy:** The user *must* interact with the page (click Start) to unlock the AudioContext. The app handles this, but it relies on that initial gesture.  
* **iOS Installation:** iOS does not fully support PWA manifest files for "Add to Home Screen" in all versions, but the `<link rel="apple-touch-icon">` provides the icon.
