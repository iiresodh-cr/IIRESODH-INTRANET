// src/config/firebaseWeb.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const webFirebaseConfig = {
  apiKey: "AIzaSyBPacnZAdGJeCr-z-dQkin9AqQy59bs1eo",
  authDomain: "iiresodh-web.firebaseapp.com",
  projectId: "iiresodh-web",
  storageBucket: "iiresodh-web.firebasestorage.app",
  messagingSenderId: "943078828913",
  appId: "1:943078828913:web:e430d4c2b369ce060ee4d0",
};

const WEB_APP_NAME = "iiresodh-web-app";

const webApp = getApps().some(app => app.name === WEB_APP_NAME)
  ? getApp(WEB_APP_NAME)
  : initializeApp(webFirebaseConfig, WEB_APP_NAME);

export const webAuth = getAuth(webApp);
export const webStorage = getStorage(webApp);
export const webFunctions = getFunctions(webApp);
export const webDb = getFirestore(webApp);

export default webApp;
