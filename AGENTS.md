# **Proctor Timer \- Project Documentation**

## **1\. Project Overview**

**Proctor Timer** is a specialized, mobile-first web application designed for test proctors. Its primary function is to countdown a specific duration (default: 30 mins) and provide audible and physical (haptic) alerts at specific checkpoints (e.g., 15, 10, 5 minutes remaining).

**Core Constraint:** The application is designed to run reliably on mobile devices even when the user places the phone in their pocket, which typically triggers aggressive battery-saving measures by the OS that kill JavaScript execution.

## **2\. Technical Architecture**

### **Current State: Single-File PWA**

For portability and immediate preview capability, the application is currently bundled into a **single HTML file** (index.html).

* **HTML/CSS:** Tailwind CSS (via CDN) and standard HTML5.  
* **JavaScript:** Inline script tag containing all logic.  
* **Web Worker:** Injected dynamically via a Blob URL.  
* **Manifest:** Injected dynamically via a Data URI.  
* **Icons:** Base64 encoded SVGs within the HTML head.

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

* **Implementation:** The timer logic resides in a Web Worker.  
* **Reason:** The main thread can be blocked by UI rendering or user interaction. Workers run on a separate thread and are generally more resistant to timing drift.  
* **Blob Loading:** Currently loaded via URL.createObjectURL(blob) string injection. In a multi-file setup, this should be new Worker('worker.js').

#### **D. Dynamic Manifest (PWA)**

* **Implementation:** A manifest.json object is defined in JavaScript, stringified, and assigned to a \<link rel="manifest"\> tag using a Data URI.  
* **Purpose:** Allows Android devices to "Install App" and launch in standalone mode (no browser address bar) without needing an external JSON file.

## **3\. Configuration & State**

* **Input Format:** TotalMinutes, Alert1, Alert2, Alert3... (e.g., 30, 15, 10, 5).  
* **Persistence:** Configuration is saved to localStorage under the key proctorConfig.  
* **Safety:** The configuration input is disabled while the timer is running.

## **4\. Current File Structure (Virtual)**

Although physically one file, the code is logically structured as:

1. **\<head\>:** PWA Meta tags, Base64 Icons, Tailwind CDN.  
2. **\<body\>:**  
   * **Config Section:** Input fields.  
   * **Visuals:** SVG Circle Progress Ring.  
   * **Controls:** Start/Stop/Pocket Mode buttons.  
   * **Overlay:** The hidden \#pocket-overlay div.  
3. **\<script\>:**  
   * manifestContent (JSON)  
   * workerScript (String/Blob)  
   * App Logic (State management, AudioContext, WakeLock)

## **5\. Known Limitations & Edge Cases**

* **Hardware Lock:** If the user ignores instructions and presses the physical power button, the timer **will pause** on most devices.  
* **Audio Policy:** The user *must* interact with the page (click Start) to unlock the AudioContext. The app handles this, but it relies on that initial gesture.  
* **iOS Installation:** iOS does not fully support the Data URI Manifest for "Add to Home Screen" icon definitions in all versions, but the \<link rel="apple-touch-icon"\> provides the icon.

## **6\. Handoff Instructions for Next Agent**

**Migration to Multi-File Structure (Recommended for Jules/Sandbox):**

Since the environment supports multiple files, please **refactor** index.html into the following structure to improve maintainability and caching:

1. **manifest.json**:  
   * Extract the content from the manifestContent JS object.  
   * Replace the \<link rel="manifest"\> data URI in HTML with \<link rel="manifest" href="manifest.json"\>.  
2. **worker.js**:  
   * Extract the content of workerScript string (excluding the string quotes).  
   * Update JS initialization to: const worker \= new Worker('worker.js');.  
3. **styles.css**:  
   * Extract the \<style\> block content (Tailwind can remain CDN or be installed via package manager).  
4. **app.js**:  
   * Extract the main logic from the \<script\> tag.  
5. **index.html**:  
   * Clean up the file to only contain markup and links to the above resources.
