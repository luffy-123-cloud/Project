import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import app from './firebaseConfig';
import { env } from '../../config/env';

// VAPID key is required to receive push notifications.
// Users must generate this from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates
const VAPID_KEY = env.firebaseVapidKey || '';

export const requestNotificationPermission = async (userId: string) => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('Firebase Cloud Messaging is not supported in this browser.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messaging = getMessaging(app);
      
      // Get the registration token.
      const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
      
      if (currentToken) {
        // Send the token to your server and update the UI if necessary
        await saveTokenToFirestore(userId, currentToken);
        return currentToken;
      } else {
        console.warn('No registration token available. Request permission to generate one.');
      }
    } else {
      console.warn('Notification permission denied.');
    }
  } catch (error) {
    console.error('An error occurred while retrieving token. ', error);
  }
  return null;
};

const saveTokenToFirestore = async (userId: string, token: string) => {
  if (!userId) return;
  try {
    const tokenRef = doc(db, `users/${userId}/tokens`, token);
    await setDoc(tokenRef, {
      token,
      createdAt: new Date().toISOString(),
      platform: 'web',
    }, { merge: true });
  } catch (error) {
    console.error('Error saving token to Firestore:', error);
  }
};

export const listenForForegroundMessages = (callback: (payload: any) => void) => {
  isSupported().then((supported) => {
    if (supported) {
      const messaging = getMessaging(app);
      onMessage(messaging, (payload) => {
        callback(payload);
      });
    }
  });
};
